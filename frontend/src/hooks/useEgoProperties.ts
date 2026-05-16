import { useEffect, useState } from 'react'
import type { ExternalProperty, SearchKeywords } from '@/types/properties'

const EGO_URL = 'https://websiteapi.egorealestate.com/v1/Properties'
const VICENS_ASH_VUI = '575457f0-1f9a-4d39-bdc8-82853e68ffae'

type EgoRaw = Record<string, unknown>

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const firstString = (raw: EgoRaw, keys: string[]) => {
  for (const key of keys) {
    const value = asString(raw[key])
    if (value) return value
  }

  return ''
}

const firstNumber = (raw: EgoRaw, keys: string[]) => {
  for (const key of keys) {
    const value = raw[key]
    const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d.-]/g, ''))
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  return null
}

const collectImageUrls = (value: unknown, urls = new Set<string>()) => {
  if (!value) return urls

  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value) && value.includes('images.egorealestate.com')) urls.add(value)
    return urls
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectImageUrls(item, urls))
    return urls
  }

  if (typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) => collectImageUrls(item, urls))
  }

  return urls
}

const extractItems = (payload: unknown): EgoRaw[] => {
  if (Array.isArray(payload)) return payload.filter((item): item is EgoRaw => Boolean(item && typeof item === 'object'))
  if (!payload || typeof payload !== 'object') return []

  const record = payload as Record<string, unknown>
  for (const key of ['Properties', 'properties', 'Items', 'items', 'Data', 'data', 'Results', 'results']) {
    if (Array.isArray(record[key])) {
      return (record[key] as unknown[]).filter((item): item is EgoRaw => Boolean(item && typeof item === 'object'))
    }
  }

  return []
}

const detectType = (title: string, description: string) => {
  const text = normalize(`${title} ${description}`)
  const words = text.split(' ')
  const has = (terms: string[]) => terms.some((term) => words.includes(term))

  if (has(['parcela', 'terreno', 'solar', 'plot', 'land'])) return 'land'
  if (has(['local', 'oficina', 'commercial', 'office', 'shop'])) return 'commercial'
  if (has(['garaje', 'garage', 'parking'])) return 'garage'
  if (has(['villa', 'chalet', 'finca'])) return 'villa'
  if (has(['casa', 'house', 'townhouse', 'bungalow'])) return 'house'
  if (has(['piso', 'apartamento', 'apartment', 'flat', 'studio'])) return 'apartment'

  return 'villa'
}

const normalizeProperty = (raw: EgoRaw): ExternalProperty => {
  const ref = firstString(raw, ['ID', 'Id', 'PropertyID', 'PropertyId', 'Reference', 'Ref']) || crypto.randomUUID()
  const title = firstString(raw, ['Title', 'Name']) || 'Propiedad Vicens Ash'
  const description = firstString(raw, ['Description', 'Observations'])
  const city = firstString(raw, ['City', 'Location']) || 'Jávea'
  const zone = firstString(raw, ['Zone', 'Area', 'District']) || city
  const images = Array.from(collectImageUrls(raw.Images ?? raw.Photos ?? raw))
  const detectedType = detectType(title, description)
  const sourceUrl = firstString(raw, ['URL', 'Url', 'Link', 'WebUrl', 'WebURL']) || `ego-vicens:${ref}`
  const searchText = normalize(`${title} ${description} ${city} ${zone}`)

  return {
    id: `vicens_ash_${ref}`,
    ref,
    title,
    price: firstNumber(raw, ['Price', 'SalePrice']) ?? 0,
    city,
    zone,
    surface_m2: firstNumber(raw, ['BuildArea', 'BuiltArea', 'Area']),
    plot_m2: firstNumber(raw, ['PlotArea', 'Plot']),
    rooms: firstNumber(raw, ['Bedrooms', 'Beds']),
    bathrooms: firstNumber(raw, ['Bathrooms', 'Baths']),
    image_url: images[0] ?? '',
    source_url: sourceUrl,
    source: 'vicens_ash',
    source_agency_name: 'Vicens Ash',
    source_agency_phone: '+34 965 791 091',
    operation: 'sale',
    type: detectedType,
    detected_type: detectedType,
    description,
    search_text: searchText,
    badge: 'Vicens Ash'
  }
}

const passesFilters = (property: ExternalProperty, params: SearchKeywords) => {
  const type = params.type
  if (type && property.detected_type !== type && property.type !== type) return false
  if (params.operation && params.operation !== 'sale') return false
  if (params.price_max && property.price > params.price_max) return false
  if (params.rooms_min && property.rooms !== null && property.rooms !== undefined && property.rooms < params.rooms_min) return false
  if (params.bathrooms_min && property.bathrooms !== null && property.bathrooms !== undefined && property.bathrooms < params.bathrooms_min) return false
  if (params.surface_min && property.surface_m2 !== null && property.surface_m2 !== undefined && property.surface_m2 < params.surface_min) return false

  return true
}

const scoreProperty = (property: ExternalProperty, params: SearchKeywords) => {
  const text = property.search_text ?? ''
  const terms = [...(params.features ?? []), ...(params.raw_terms ?? []), ...(params.terms ?? [])].map(normalize).filter(Boolean)

  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0)
}

async function fetchEgoProperties(params: SearchKeywords): Promise<ExternalProperty[]> {
  const url = new URL(EGO_URL)
  url.searchParams.set('vui', VICENS_ASH_VUI)
  url.searchParams.set('nre', '50')
  url.searchParams.set('gather_attributes', '1')
  url.searchParams.set('dsrt', '1')
  url.searchParams.set('thumbnailsize', '11')
  url.searchParams.set('lng', 'en-gb')
  url.searchParams.set('oar', '1')

  const response = await fetch(url.toString())
  if (!response.ok) throw new Error(`Vicens Ash respondió ${response.status}`)

  const data = await response.json()
  const properties = extractItems(data).map(normalizeProperty).filter((property) => passesFilters(property, params))
  const scored = properties.map((property) => ({ property, score: scoreProperty(property, params) }))

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    if (a.score === 0 && b.score === 0) return a.property.price - b.property.price
    return 0
  })

  return scored.map((item) => item.property)
}

export function useEgoProperties(searchParams: SearchKeywords | null) {
  const [results, setResults] = useState<ExternalProperty[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const serializedParams = searchParams ? JSON.stringify(searchParams) : ''

  useEffect(() => {
    if (!serializedParams) {
      setResults([])
      setError(null)
      return
    }

    let cancelled = false
    const currentParams = JSON.parse(serializedParams) as SearchKeywords
    setLoading(true)
    setError(null)
    fetchEgoProperties(currentParams)
      .then((items) => {
        if (!cancelled) setResults(items)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [serializedParams])

  return { results, loading, error }
}
