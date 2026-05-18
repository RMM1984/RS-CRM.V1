import crypto from 'node:crypto'
import axios from 'axios'
import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import type { AnyNode } from 'domhandler'
import type { ExternalProperty } from '../propertySync.service'
import {
  detectPropertyType,
  parseQuery,
  passesHardFilters,
  scoreProperty,
  type ParsedQuery
} from '../search/queryParser'

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

type DetectedPropertyType = 'apartment' | 'house' | 'village_house' | 'townhouse' | 'villa' | 'land' | 'commercial' | 'garage'
const typeSearchOrder: DetectedPropertyType[] = ['land', 'commercial', 'garage', 'villa', 'house', 'apartment']

const typeDictionary: Partial<Record<DetectedPropertyType, string[]>> = {
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

export type CrownSearchKeywords = ParsedQuery

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

const isValidTitle = (value: string) => value.length > 5 && !/^\d+$/.test(value)

const titleOf = ($: CheerioAPI, card: cheerio.Cheerio<AnyNode>, sourceUrl: string) => {
  const selectors = [
    '.property-15__title',
    '.property-15__content-title',
    '.property-15__info-title',
    'h2',
    'h3',
    'a[title]',
    'a'
  ]

  for (const selector of selectors) {
    const element = card.find(selector).first()
    const text = element.text().replace(/\s+/g, ' ').trim() || element.attr('title')?.replace(/\s+/g, ' ').trim() || ''

    if (isValidTitle(text)) return text
  }

  const slug = sourceUrl
    .split('/')
    .filter(Boolean)
    .at(-1)
    ?.replace(/-\d+$/, '')
    .replace(/-/g, ' ')
    .trim()

  return slug && isValidTitle(slug) ? slug : 'Propiedad en Jávea'
}

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

const forcedLandTerms = [
  'parcela',
  'terreno',
  'solar',
  'plot',
  'land',
  'grundstuck',
  'grond',
  'terrain',
  'edificable',
  'rustica',
  'rustico',
  'finca rustica'
]

function detectTypeFromTitle(title: string): DetectedPropertyType {
  const normalizedTitle = normalizeText(title)

  if (forcedLandTerms.some((term) => includesWholeTerm(normalizedTitle, term))) {
    return 'land'
  }

  return (detectPropertyType(title) ?? 'villa') as DetectedPropertyType
}

const mapCard = ($: CheerioAPI, element: AnyNode): ExternalProperty | null => {
  const card = $(element)
  const sourceUrl = absoluteUrl(card.find('a.property-15__background-link').first().attr('href'))
  const title = titleOf($, card, sourceUrl)
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

export function parseCrownSearchQuery(query: string, overrides?: { type?: string | null }): CrownSearchKeywords {
  return parseQuery(query, overrides)
}

export function searchCrownProperties(query: string, overrides?: { type?: string | null }): ExternalProperty[] {
  const keywords = parseCrownSearchQuery(query, overrides)
  const scored = cache.data
    .filter((property) => keywords.type || keywords.price_max || keywords.rooms_exact || keywords.rooms_min || keywords.bathrooms_min || keywords.surface_min || keywords.features.length || keywords.raw_terms.length ? passesHardFilters(property, keywords) : true)
    .map((property) => ({ property, score: scoreProperty(property, keywords) }))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      if (a.score === 0 && b.score === 0) return a.property.price - b.property.price
      return 0
    })

  return keywords.operation === 'rent' ? [] : scored.map((result) => result.property)
}
