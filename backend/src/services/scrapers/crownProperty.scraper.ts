import crypto from 'node:crypto'
import axios from 'axios'
import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import type { AnyNode } from 'domhandler'
import type { ExternalProperty } from '../propertySync.service'

const CROWN_URL = 'https://www.crown-property.com/venta/javea/'
const MAX_LISTING_PAGES = 30
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'

export const cache = {
  data: [] as ExternalProperty[],
  lastFetch: 0,
  isBuilding: false,
  TTL: 30 * 60 * 1000
}

type DetectedPropertyType = 'apartment' | 'house' | 'villa' | 'land' | 'commercial' | 'garage'
const typeSearchOrder: DetectedPropertyType[] = ['land', 'commercial', 'garage', 'villa', 'house', 'apartment']

const typeDictionary: Record<DetectedPropertyType, string[]> = {
  apartment: [
    'piso', 'apartamento', 'apto', 'estudio', 'bajo', 'loft',
    'atico', 'duplex',
    'apartment', 'flat', 'studio', 'penthouse',
    'wohnung', 'dachgeschoss',
    'appartement'
  ],
  house: [
    'casa', 'casita', 'adosado', 'pareado', 'unifamiliar',
    'pueblo', 'casa de pueblo',
    'house', 'townhouse', 'terraced', 'semi detached',
    'village house', 'cottage', 'town house',
    'haus', 'reihenhaus', 'doppelhaus', 'stadthaus',
    'haus im dorf',
    'huis', 'rijtjeshuis', 'twee onder een kap', 'woning',
    'maison', 'pavillon', 'maison de village',
    'mitoyenne', 'jumelee'
  ],
  villa: [
    'villa', 'chalet', 'finca', 'cortijo', 'masia',
    'manor', 'estate', 'country house',
    'landhaus', 'anwesen',
    'landhuis', 'herenhuis',
    'manoir', 'bastide', 'mas'
  ],
  land: [
    'parcela', 'terreno', 'solar', 'finca rustica',
    'suelo',
    'land', 'plot', 'terrain', 'site', 'building plot',
    'rustic land',
    'grundstuck', 'parzelle', 'baugrundstuck',
    'grond', 'perceel', 'kavel', 'bouwgrond',
    'parcelle', 'terrain a batir', 'fonds'
  ],
  commercial: [
    'local', 'comercial', 'oficina', 'negocio', 'nave',
    'local comercial',
    'commercial', 'office', 'shop', 'retail', 'warehouse',
    'business', 'premises',
    'gewerbe', 'buro', 'laden', 'geschaft', 'lager', 'halle',
    'bedrijf', 'kantoor', 'winkel', 'pand', 'loods',
    'commerce', 'bureau', 'boutique', 'entrepot'
  ],
  garage: [
    'garaje', 'trastero', 'almacen', 'plaza de garaje',
    'garage', 'parking', 'storage', 'parking space',
    'parkplatz', 'stellplatz', 'lager',
    'parkeerplaats', 'berging', 'opslag',
    'place de parking', 'cave'
  ]
}

const operationDictionary: Record<'sale' | 'rent', string[]> = {
  sale: ['venta', 'compra', 'sale', 'buy', 'kauf', 'koop', 'achat'],
  rent: ['alquiler', 'rent', 'miete', 'huur', 'location']
}
const shortSearchTerms = new Set(['mar', 'sea', 'mer', 'zee'])

export type CrownSearchKeywords = {
  price_max?: number
  surface_min?: number
  rooms_min?: number
  type?: DetectedPropertyType
  operation?: 'sale' | 'rent'
  terms: string[]
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isCacheValid(): boolean {
  return cache.lastFetch > 0 && Date.now() - cache.lastFetch < cache.TTL
}

export const getCrownCacheAgeMinutes = () =>
  cache.lastFetch ? Math.floor((Date.now() - cache.lastFetch) / 60000) : null

export const getCrownCacheStatus = () => ({
  count: cache.data.length,
  isBuilding: cache.isBuilding,
  lastFetch: cache.lastFetch,
  ageMinutes: getCrownCacheAgeMinutes(),
  sample: cache.data.slice(0, 2)
})

const parseNumber = (text?: string | null) => {
  if (!text) return null
  const clean = text.replace(/m\s*2/gi, '').replace(/m²/gi, '')
  const value = Number(clean.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''))

  return Number.isFinite(value) ? value : null
}

const absoluteUrl = (url?: string) => {
  if (!url) return ''
  return new URL(url, CROWN_URL).toString()
}

const textOf = ($: CheerioAPI, node: cheerio.Cheerio<AnyNode>, selector: string) =>
  node.find(selector).first().text().replace(/\s+/g, ' ').trim()

const iconValue = ($: CheerioAPI, card: cheerio.Cheerio<AnyNode>, iconTitle: string) => {
  const icon = card.find(`.property-15__featuredicon img[title*="${iconTitle}"]`).first()
  if (!icon.length) return null

  return parseNumber(icon.closest('.property-15__featuredicon').text())
}

const refFromUrl = (url: string) => url.match(/(\d+)\/?$/)?.[1] ?? ''

const splitWords = (text: string) => text.split(/\s+/).filter(Boolean)

const includesWholeTerm = (text: string, term: string) => {
  const normalizedTerm = normalizeText(term)

  if (normalizedTerm.includes(' ')) {
    return new RegExp(`(^|\\s)${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\s)`).test(text)
  }

  return splitWords(text).some((word) => word === normalizedTerm)
}

function detectTypeFromTitle(title: string): DetectedPropertyType {
  const text = normalizeText(title)

  if (typeDictionary.land.some((term) => includesWholeTerm(text, term))) return 'land'
  if (typeDictionary.commercial.some((term) => includesWholeTerm(text, term))) return 'commercial'
  if (typeDictionary.garage.some((term) => includesWholeTerm(text, term))) return 'garage'
  if (typeDictionary.villa.some((term) => includesWholeTerm(text, term))) return 'villa'
  if (typeDictionary.house.some((term) => includesWholeTerm(text, term))) return 'house'
  if (typeDictionary.apartment.some((term) => includesWholeTerm(text, term))) return 'apartment'

  return 'house'
}

const mapCard = ($: CheerioAPI, element: AnyNode): ExternalProperty | null => {
  const card = $(element)
  const sourceUrl = absoluteUrl(card.find('a.property-15__background-link').first().attr('href'))
  const title = textOf($, card, '.property-15__title')
  const price = parseNumber(textOf($, card, '.property-15__price-text'))
  const location = textOf($, card, '.property-15__location')
  const imageUrl = absoluteUrl(card.find('img.property-15__background').first().attr('src'))
  const badge = textOf($, card, '.offer-band') || null

  if (!sourceUrl || !title || !price) return null

  const [, zone = location] = location.split(' - ').map((part) => part.trim())
  const searchText = normalizeText(`${title} ${zone} ${badge || ''}`)
  const detectedType = detectTypeFromTitle(title)

  return {
    id: crypto.createHash('sha1').update(sourceUrl).digest('hex'),
    ref: refFromUrl(sourceUrl),
    title,
    price,
    zone,
    city: 'Jávea',
    surface_m2: iconValue($, card, 'Build size'),
    rooms: iconValue($, card, 'Bedrooms'),
    bathrooms: iconValue($, card, 'Bathrooms'),
    image_url: imageUrl,
    images: imageUrl ? [{ url: imageUrl }] : [],
    source_url: sourceUrl,
    badge,
    search_text: searchText,
    source: 'crown_property',
    source_agency_name: 'Crown Property Jávea',
    source_agency_phone: '+34 965 791 091',
    operation: 'sale',
    type: detectedType,
    detected_type: detectedType,
    description: title
  }
}

const fetchListingPage = async (url: string) => {
  const { data } = await axios.get<string>(url, {
    headers: {
      'User-Agent': USER_AGENT
    },
    timeout: 10000
  })

  return cheerio.load(data)
}

const parseCards = ($: CheerioAPI) =>
  $('.property-15__card')
    .map((_, element) => mapCard($, element))
    .get()
    .filter((property): property is ExternalProperty => Boolean(property))

async function scrapeListing(): Promise<ExternalProperty[]> {
  const firstPage = await fetchListingPage(CROWN_URL)
  const pageCards = [parseCards(firstPage)]
  const seen = new Set<string>()

  for (let page = 2; page <= MAX_LISTING_PAGES; page += 1) {
    const $ = await fetchListingPage(`${CROWN_URL}pagina-${page}/`)
    const cards = parseCards($)

    if (!cards.length) break

    pageCards.push(cards)
  }

  return pageCards
    .flat()
    .filter((property) => {
      if (seen.has(property.source_url)) return false
      seen.add(property.source_url)

      return true
    })
}

export async function buildCache() {
  if (cache.isBuilding) return
  cache.isBuilding = true

  try {
    const properties = await scrapeListing()
    cache.data = properties
    cache.lastFetch = Date.now()
  } catch (err) {
    console.error('Crown scrape failed:', err)
  } finally {
    cache.isBuilding = false
  }
}

export async function getCrownProperties(): Promise<ExternalProperty[]> {
  if (isCacheValid()) return cache.data

  if (cache.data.length > 0) {
    if (!cache.isBuilding) {
      void buildCache()
    }

    return cache.data
  }

  await buildCache()
  return cache.data
}

const parseMoney = (value: string) => {
  const raw = value.toLowerCase().replace(/\s/g, '')
  const amount = raw.includes('k')
    ? Number(raw.replace(',', '.').replace(/[^\d.]/g, ''))
    : Number(raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''))
  if (!Number.isFinite(amount)) return undefined

  return raw.includes('k') ? amount * 1000 : amount
}

export function parseCrownSearchQuery(query: string): CrownSearchKeywords {
  const rawQuery = query.toLowerCase()
  const text = normalizeText(query)
  const keywords: CrownSearchKeywords = { terms: [] }
  const consumed = new Set<string>()

  for (const type of typeSearchOrder) {
    const words = typeDictionary[type]
    if (words.some((word) => includesWholeTerm(text, word))) {
      keywords.type = type
      words.forEach((word) => consumed.add(word))
      break
    }
  }

  for (const [operation, words] of Object.entries(operationDictionary) as Array<[CrownSearchKeywords['operation'], string[]]>) {
    if (words.some((word) => text.includes(word))) {
      keywords.operation = operation
      words.forEach((word) => consumed.add(word))
      break
    }
  }

  const roomMatch = text.match(/(\d+)\s*(hab|bed|zimmer|slaap|chambre)/)
  if (roomMatch) {
    keywords.rooms_min = Number(roomMatch[1])
    consumed.add(roomMatch[1])
    consumed.add(roomMatch[2])
  }

  for (const match of rawQuery.matchAll(/(\d+(?:[.,]\d+)?)\s*k\b/g)) {
    const value = parseMoney(match[0])
    if (value) keywords.price_max = value
    consumed.add(normalizeText(match[1]))
  }

  for (const match of text.matchAll(/(\d+(?:[.,]\d+)?)\s*m\b/g)) {
    const value = Number(match[1].replace(',', '.'))
    if (value >= 10 && value <= 999) keywords.surface_min = value
    consumed.add(match[1])
  }

  for (const match of rawQuery.matchAll(/\b(?:\d{1,3}(?:[.\s]\d{3})+|\d{4,})\b/g)) {
    const value = parseMoney(match[0])
    if (value && value > 1000) keywords.price_max = value
  }

  keywords.terms = text
    .split(' ')
    .filter((term) => (term.length > 3 || shortSearchTerms.has(term)) && !consumed.has(term) && !/^\d/.test(term))

  return keywords
}

export function searchCrownProperties(query: string): ExternalProperty[] {
  const keywords = parseCrownSearchQuery(query)

  return cache.data
    .map((property) => {
      if (keywords.operation === 'rent') return null
      if (keywords.price_max !== undefined && property.price > keywords.price_max) return null
      if (
        keywords.surface_min !== undefined &&
        property.surface_m2 !== null &&
        property.surface_m2 < keywords.surface_min
      ) {
        return null
      }
      if (keywords.rooms_min !== undefined && property.rooms !== null && property.rooms < keywords.rooms_min) return null
      if (keywords.type && (property.detected_type ?? property.type) !== keywords.type) return null

      const score = keywords.terms.reduce(
        (total, term) => total + (property.search_text.includes(term) ? 1 : 0),
        0
      )

      return { property, score }
    })
    .filter((result): result is { property: ExternalProperty; score: number } => Boolean(result))
    .sort((a, b) => b.score - a.score)
    .map((result) => result.property)
}
