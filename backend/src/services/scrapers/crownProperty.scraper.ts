import crypto from 'node:crypto'
import axios from 'axios'
import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import type { AnyNode } from 'domhandler'
import type { ExternalProperty, SearchParams } from '../propertySync.service'

const CROWN_URL = 'https://www.crown-property.com/venta/javea/'

export const cache = {
  data: [] as ExternalProperty[],
  lastFetch: 0,
  TTL: 60 * 60 * 1000
}

export function isCacheValid(): boolean {
  return cache.data.length > 0 && Date.now() - cache.lastFetch < cache.TTL
}

export const getCrownCacheAgeMinutes = () =>
  cache.lastFetch ? Math.floor((Date.now() - cache.lastFetch) / 60000) : null

const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

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

const inferType = (title: string) => {
  const text = normalizeText(title)

  if (/(piso|apartamento|apto|estudio|atico|bajo)/.test(text)) return 'apartment'
  if (/(chalet|villa|casa|finca|adosado|townhouse)/.test(text)) return 'house'
  if (/(local|comercial|oficina|negocio)/.test(text)) return 'commercial'
  if (/(parcela|terreno|solar)/.test(text)) return 'land'
  if (/(garaje|parking|plaza)/.test(text)) return 'garage'

  return 'house'
}

const typeTerms: Record<string, RegExp> = {
  apartment: /(piso|apartamento|apto|estudio|atico|bajo|apartment|flat)/,
  house: /(chalet|villa|casa|finca|adosado|unifamiliar|house|townhouse|detached)/,
  commercial: /(local|comercial|oficina|negocio|commercial|office|shop)/,
  land: /(parcela|terreno|solar|land|plot)/,
  garage: /(garaje|parking|plaza|garage)/
}

const mapCard = ($: CheerioAPI, element: AnyNode): ExternalProperty | null => {
  const card = $(element)
  const sourceUrl = absoluteUrl(card.find('a.property-15__background-link').first().attr('href'))
  const title = textOf($, card, '.property-15__title')
  const price = parseNumber(textOf($, card, '.property-15__price-text'))
  const location = textOf($, card, '.property-15__location')
  const ref = textOf($, card, '.property-15__reference').replace(/^Ref\.\s*/i, '')
  const imageUrl = absoluteUrl(card.find('img.property-15__background').first().attr('src'))

  if (!sourceUrl || !title || !price) return null

  const [, zone = location] = location.split(' - ').map((part) => part.trim())

  return {
    id: crypto.createHash('sha1').update(sourceUrl).digest('hex'),
    ref,
    title,
    price,
    zone,
    city: 'Jávea',
    surface_m2: iconValue($, card, 'Build size') ?? undefined,
    rooms: iconValue($, card, 'Bedrooms') ?? undefined,
    bathrooms: iconValue($, card, 'Bathrooms') ?? undefined,
    image_url: imageUrl,
    images: imageUrl ? [{ url: imageUrl }] : [],
    source_url: sourceUrl,
    badge: textOf($, card, '.offer-band') || null,
    source: 'crown_property',
    source_agency_name: 'Crown Property Jávea',
    source_agency_phone: '+34 965 791 091',
    operation: 'sale',
    type: inferType(title),
    description: title
  }
}

export async function getCrownProperties(): Promise<ExternalProperty[]> {
  if (isCacheValid()) return cache.data

  try {
    const { data } = await axios.get<string>(CROWN_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
      },
      timeout: 10000
    })
    const $ = cheerio.load(data)
    const properties = $('.property-15__card')
      .map((_, element) => mapCard($, element))
      .get()
      .filter((property): property is ExternalProperty => Boolean(property))

    cache.data = properties
    cache.lastFetch = Date.now()

    return properties
  } catch (error) {
    console.error('[CrownPropertyScraper] Failed to scrape Crown Property', error)

    return cache.data.length ? cache.data : []
  }
}

export async function searchCrownProperties(params: SearchParams): Promise<ExternalProperty[]> {
  const properties = await getCrownProperties()
  const terms = [...(params.terms ?? []), ...(params.raw_terms ?? []), ...(params.features ?? [])]
    .map(normalizeText)
    .filter((term) => term.length > 2)

  return properties.filter((property) => {
    const title = normalizeText(property.title)
    const zone = normalizeText(property.zone ?? '')

    if (params.type && !(typeTerms[params.type] ?? /.*/).test(title)) return false
    if (params.price_max !== undefined && property.price > params.price_max) return false
    if (params.rooms_min !== undefined && (property.rooms ?? 0) < params.rooms_min) return false
    if (terms.length && !terms.some((term) => title.includes(term) || zone.includes(term))) return false

    return true
  })
}
