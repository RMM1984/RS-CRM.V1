import crypto from 'node:crypto'
import axios from 'axios'
import type { PoolClient } from 'pg'
import { pool } from '../../config/db'
import { detectPropertyType, normalize, parseQuery, passesHardFilters, scoreProperty } from '../search/queryParser'
import type { ExternalProperty } from '../propertySync.service'

const BASE_URL = 'https://websiteapi.egorealestate.com/v1'
const PAGE_SIZE = 20
const RATE_LIMIT_MS = 2000
const MAX_RETRIES = 3
const VICENS_ASH_VUI = '575457f0-1f9a-4d39-bdc8-82853e68ffae'

type EgoAgency = {
  id: string
  name: string
  vui: string
  active: boolean
  last_sync_at: string | null
  total_properties: number
}

type NormalizedEgoProperty = {
  agency_id: string
  external_id: string
  title: string | null
  description: string | null
  price: number
  bedrooms: number | null
  bathrooms: number | null
  built_area: number | null
  plot_area: number | null
  lat: number | null
  lon: number | null
  property_type: string
  operation_type: string
  status: string
  city: string
  zone: string | null
  address: string | null
  images: Array<{ url: string; sort_order: number }>
  features: string[]
  search_text: string
  content_hash: string
  raw_json: Record<string, unknown>
  created_at_source: string | null
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function normalizeText(text: string) {
  return normalize(text)
}

export const ensureEgoSchema = async (db: PoolClient = pool as unknown as PoolClient) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ego_agencies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      vui TEXT UNIQUE NOT NULL,
      active BOOLEAN DEFAULT true,
      last_sync_at TIMESTAMPTZ,
      total_properties INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.ego_properties (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agency_id UUID REFERENCES public.ego_agencies(id),
      external_id TEXT NOT NULL,
      source_system TEXT DEFAULT 'ego_real_estate',
      title TEXT,
      description TEXT,
      price NUMERIC,
      bedrooms INTEGER,
      bathrooms INTEGER,
      built_area NUMERIC,
      plot_area NUMERIC,
      lat NUMERIC,
      lon NUMERIC,
      property_type TEXT,
      operation_type TEXT DEFAULT 'sale',
      status TEXT DEFAULT 'available',
      city TEXT,
      zone TEXT,
      address TEXT,
      images JSONB DEFAULT '[]',
      features JSONB DEFAULT '[]',
      search_text TEXT,
      content_hash TEXT,
      raw_json JSONB,
      created_at_source TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ,
      UNIQUE(agency_id, external_id)
    );

    CREATE TABLE IF NOT EXISTS public.ego_price_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id UUID REFERENCES public.ego_properties(id),
      price NUMERIC NOT NULL,
      previous_price NUMERIC,
      change_amount NUMERIC,
      change_percent NUMERIC,
      detected_at TIMESTAMPTZ DEFAULT now()
    );

    INSERT INTO public.ego_agencies (name, vui)
    VALUES ('Vicens Ash', '${VICENS_ASH_VUI}')
    ON CONFLICT (vui) DO NOTHING;
  `)
}

const firstValue = (raw: Record<string, unknown>, keys: string[]) =>
  keys.map((key) => raw[key]).find((value) => value !== undefined && value !== null && value !== '')

const asString = (value: unknown) => (value === undefined || value === null ? null : String(value).trim() || null)

const asNumber = (value: unknown) => {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(String(value).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''))

  return Number.isFinite(parsed) ? parsed : null
}

const asInteger = (value: unknown) => {
  const parsed = asNumber(value)

  return parsed === null ? null : Math.trunc(parsed)
}

const asDate = (value: unknown) => {
  const text = asString(value)
  if (!text) return null
  const date = new Date(text)

  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const walk = (value: unknown, visit: (item: unknown) => void) => {
  visit(value)

  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visit))
  } else if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) => walk(item, visit))
  }
}

const extractImages = (raw: Record<string, unknown>) => {
  const source = firstValue(raw, ['Images', 'Photos', 'Pictures', 'Media']) ?? raw
  const urls: string[] = []

  walk(source, (item) => {
    if (typeof item !== 'string') return
    if (item.includes('images.egorealestate.com') && /^https?:\/\//i.test(item)) {
      urls.push(item)
    }
  })

  return [...new Set(urls)].map((url, index) => ({ url, sort_order: index }))
}

const extractFeatures = (raw: Record<string, unknown>) => {
  const source = firstValue(raw, ['Attributes', 'Features', 'Amenities'])
  const features: string[] = []

  walk(source, (item) => {
    if (typeof item === 'string' && item.trim()) {
      features.push(item.trim())
    } else if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>
      const label = asString(firstValue(record, ['Name', 'Title', 'Value', 'Description', 'Text']))
      if (label) features.push(label)
    }
  })

  return [...new Set(features)]
}

export function generateHash(property: Pick<NormalizedEgoProperty, 'price' | 'title' | 'bedrooms' | 'bathrooms'>) {
  return crypto
    .createHash('md5')
    .update([property.price, property.title, property.bedrooms, property.bathrooms].join('|'))
    .digest('hex')
}

export function detectType(title: string | null, features: string[]) {
  return detectPropertyType(`${title ?? ''} ${features.join(' ')}`) ?? 'villa'
}

export function normalizeProperty(rawInput: Record<string, unknown>, agencyId: string): NormalizedEgoProperty {
  const raw = rawInput ?? {}
  const externalId = asString(firstValue(raw, ['ID', 'Id', 'PropertyID', 'PropertyId', 'Reference', 'Ref'])) ?? crypto.randomUUID()
  const title = asString(firstValue(raw, ['Title', 'Name'])) ?? 'Propiedad Vicens Ash'
  const description = asString(firstValue(raw, ['Description', 'Observations']))
  const price = asNumber(firstValue(raw, ['Price', 'SalePrice'])) ?? 0
  const bedrooms = asInteger(firstValue(raw, ['Bedrooms', 'Beds']))
  const bathrooms = asInteger(firstValue(raw, ['Bathrooms', 'Baths']))
  const builtArea = asNumber(firstValue(raw, ['BuildArea', 'BuiltArea', 'Area']))
  const plotArea = asNumber(firstValue(raw, ['PlotArea', 'Plot']))
  const lat = asNumber(firstValue(raw, ['GPSLat', 'Lat']))
  const lon = asNumber(firstValue(raw, ['GPSLon', 'Lon']))
  const city = asString(firstValue(raw, ['City', 'Location'])) ?? 'Jávea'
  const zone = asString(firstValue(raw, ['Zone', 'Area', 'District']))
  const address = asString(firstValue(raw, ['Address', 'Street']))
  const images = extractImages(raw)
  const features = extractFeatures(raw)
  const propertyType = detectType(title, features)
  const searchText = normalizeText(`${title} ${description ?? ''} ${features.join(' ')} ${city} ${zone ?? ''}`)
  const createdAtSource = asDate(firstValue(raw, ['CreatedAt', 'Created', 'DateCreated']))
  const normalized: NormalizedEgoProperty = {
    agency_id: agencyId,
    external_id: externalId,
    title,
    description,
    price,
    bedrooms,
    bathrooms,
    built_area: builtArea,
    plot_area: plotArea,
    lat,
    lon,
    property_type: propertyType,
    operation_type: 'sale',
    status: 'available',
    city,
    zone,
    address,
    images,
    features,
    search_text: searchText,
    content_hash: '',
    raw_json: raw,
    created_at_source: createdAtSource
  }
  normalized.content_hash = generateHash(normalized)

  return normalized
}

const extractPageItems = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) return payload.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
  if (!payload || typeof payload !== 'object') return []

  const record = payload as Record<string, unknown>
  const candidates = ['Properties', 'properties', 'Items', 'items', 'Data', 'data', 'Results', 'results']
  for (const key of candidates) {
    if (Array.isArray(record[key])) {
      return (record[key] as unknown[]).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    }
  }

  return []
}

export async function fetchPage(vui: string, offset: number) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const { data } = await axios.get(`${BASE_URL}/Properties`, {
        params: {
          vui,
          nre: PAGE_SIZE,
          offset,
          gather_attributes: 1,
          dsrt: 1,
          thumbnailsize: 11,
          lng: 'en-gb',
          oar: 1
        },
        timeout: 30000
      })

      return extractPageItems(data)
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      const delay = status === 429 ? 30000 : RATE_LIMIT_MS * 2 ** (attempt - 1)
      console.warn(`Ego fetch failed vui=${vui} offset=${offset} attempt=${attempt}/${MAX_RETRIES} status=${status ?? 'n/a'}`)

      if (attempt === MAX_RETRIES) throw error
      await sleep(delay)
    }
  }

  return []
}

export async function fetchAllProperties(vui: string) {
  let offset = 0
  const allProperties: Record<string, unknown>[] = []

  while (true) {
    const page = await fetchPage(vui, offset)
    if (!page.length) break

    allProperties.push(...page)
    if (page.length < PAGE_SIZE) break

    offset += PAGE_SIZE
    await sleep(RATE_LIMIT_MS)
  }

  return allProperties
}

const getAgency = async (vui: string) => {
  await ensureEgoSchema()
  const found = await pool.query<EgoAgency>('SELECT * FROM public.ego_agencies WHERE vui = $1', [vui])
  if (found.rows[0]) return found.rows[0]

  const created = await pool.query<EgoAgency>(
    `INSERT INTO public.ego_agencies (name, vui)
     VALUES ('Unknown', $1)
     RETURNING *`,
    [vui]
  )
  return created.rows[0]
}

export async function syncAgency(vui: string) {
  const agency = await getAgency(vui)
  console.log(`🔄 Sincronizando ${agency.name}...`)
  const rawProperties = await fetchAllProperties(vui)
  const currentExternalIds = new Set<string>()
  let inserted = 0
  let updated = 0
  let skipped = 0
  let deleted = 0

  for (const raw of rawProperties) {
    try {
      const normalized = normalizeProperty(raw, agency.id)
      currentExternalIds.add(normalized.external_id)
      const existing = await pool.query('SELECT * FROM public.ego_properties WHERE agency_id = $1 AND external_id = $2', [
        agency.id,
        normalized.external_id
      ])

      if (!existing.rows[0]) {
        await pool.query(
          `INSERT INTO public.ego_properties
           (agency_id, external_id, title, description, price, bedrooms, bathrooms, built_area, plot_area,
            lat, lon, property_type, operation_type, status, city, zone, address, images, features,
            search_text, content_hash, raw_json, created_at_source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
          [
            normalized.agency_id,
            normalized.external_id,
            normalized.title,
            normalized.description,
            normalized.price,
            normalized.bedrooms,
            normalized.bathrooms,
            normalized.built_area,
            normalized.plot_area,
            normalized.lat,
            normalized.lon,
            normalized.property_type,
            normalized.operation_type,
            normalized.status,
            normalized.city,
            normalized.zone,
            normalized.address,
            JSON.stringify(normalized.images),
            JSON.stringify(normalized.features),
            normalized.search_text,
            normalized.content_hash,
            JSON.stringify(normalized.raw_json),
            normalized.created_at_source
          ]
        )
        inserted += 1
        console.log(`✅ Nueva: ${normalized.title}`)
        continue
      }

      const current = existing.rows[0]
      if (current.content_hash !== normalized.content_hash) {
        const previousPrice = Number(current.price ?? 0)
        if (previousPrice !== normalized.price) {
          await pool.query(
            `INSERT INTO public.ego_price_history (property_id, price, previous_price, change_amount, change_percent)
             VALUES ($1,$2,$3,$4,$5)`,
            [
              current.id,
              normalized.price,
              previousPrice,
              normalized.price - previousPrice,
              previousPrice ? Number((((normalized.price - previousPrice) / previousPrice) * 100).toFixed(2)) : null
            ]
          )
        }

        await pool.query(
          `UPDATE public.ego_properties SET
             title = $2, description = $3, price = $4, bedrooms = $5, bathrooms = $6,
             built_area = $7, plot_area = $8, lat = $9, lon = $10, property_type = $11,
             operation_type = $12, status = $13, city = $14, zone = $15, address = $16,
             images = $17, features = $18, search_text = $19, content_hash = $20,
             raw_json = $21, created_at_source = $22, updated_at = now(), deleted_at = NULL
           WHERE id = $1`,
          [
            current.id,
            normalized.title,
            normalized.description,
            normalized.price,
            normalized.bedrooms,
            normalized.bathrooms,
            normalized.built_area,
            normalized.plot_area,
            normalized.lat,
            normalized.lon,
            normalized.property_type,
            normalized.operation_type,
            normalized.status,
            normalized.city,
            normalized.zone,
            normalized.address,
            JSON.stringify(normalized.images),
            JSON.stringify(normalized.features),
            normalized.search_text,
            normalized.content_hash,
            JSON.stringify(normalized.raw_json),
            normalized.created_at_source
          ]
        )
        updated += 1
        console.log(`🔄 Actualizada: ${normalized.title}`)
      } else {
        skipped += 1
      }
    } catch (error) {
      console.error('Ego property sync failed, continuing:', error)
    }
  }

  const existingActive = await pool.query(
    'SELECT id, title, external_id FROM public.ego_properties WHERE agency_id = $1 AND deleted_at IS NULL',
    [agency.id]
  )
  for (const property of existingActive.rows) {
    if (currentExternalIds.has(property.external_id)) continue

    await pool.query('UPDATE public.ego_properties SET deleted_at = now() WHERE id = $1', [property.id])
    deleted += 1
    console.log(`🗑 Eliminada del mercado: ${property.title}`)
  }

  const total = inserted + skipped + updated
  await pool.query(
    'UPDATE public.ego_agencies SET last_sync_at = now(), total_properties = $2 WHERE id = $1',
    [agency.id, total]
  )

  return { agency: agency.name, inserted, updated, skipped, deleted, total }
}

export async function syncAllAgencies() {
  await ensureEgoSchema()
  const { rows } = await pool.query<EgoAgency>('SELECT * FROM public.ego_agencies WHERE active = true ORDER BY name')
  const summaries = []

  for (const agency of rows) {
    summaries.push(await syncAgency(agency.vui))
  }

  const total = summaries.reduce(
    (acc, item) => ({
      inserted: acc.inserted + item.inserted,
      updated: acc.updated + item.updated,
      skipped: acc.skipped + item.skipped,
      deleted: acc.deleted + item.deleted,
      total: acc.total + item.total
    }),
    { inserted: 0, updated: 0, skipped: 0, deleted: 0, total: 0 }
  )
  console.log('📊 Ego sync total:', total)

  return { summaries, total }
}

export async function getEgoStatus() {
  await ensureEgoSchema()
  const agencies = await pool.query(
    `SELECT name, vui, active, last_sync_at, total_properties
     FROM public.ego_agencies
     ORDER BY name`
  )
  const total = await pool.query(
    `SELECT count(*)::int AS total
     FROM public.ego_properties
     WHERE deleted_at IS NULL`
  )

  return {
    agencies: agencies.rows,
    total_ego_properties: total.rows[0]?.total ?? 0
  }
}

export async function searchEgoProperties(query: string, overrides?: { type?: string | null }): Promise<ExternalProperty[]> {
  await ensureEgoSchema()
  const parsed = parseQuery(query, overrides)
  if (parsed.operation === 'rent') return []
  const { rows } = await pool.query(
    `SELECT
       ep.id, ep.external_id, ep.title, ep.description, ep.price, ep.bedrooms, ep.bathrooms,
       ep.built_area, ep.plot_area, ep.city, ep.zone, ep.address, ep.images, ep.features,
       ep.search_text, ep.property_type, ep.operation_type, ep.lat, ep.lon, ep.deleted_at,
       ea.name AS agency_name
     FROM public.ego_properties ep
     JOIN public.ego_agencies ea ON ep.agency_id = ea.id
     WHERE ep.deleted_at IS NULL`
  )

  return rows
    .map((row) => {
      const images = Array.isArray(row.images) ? row.images : []
      const property: ExternalProperty = {
        id: row.id,
        ref: row.external_id,
        title: row.title ?? 'Propiedad Vicens Ash',
        price: Number(row.price ?? 0),
        zone: row.zone ?? row.address ?? row.city ?? 'Jávea',
        city: row.city ?? 'Jávea',
        surface_m2: row.built_area === null ? null : Number(row.built_area),
        plot_m2: row.plot_area === null ? null : Number(row.plot_area),
        rooms: row.bedrooms,
        bathrooms: row.bathrooms,
        image_url: images[0]?.url ?? '',
        images,
        source_url: `ego:${row.external_id}`,
        badge: row.agency_name,
        search_text: row.search_text ?? normalizeText(`${row.title ?? ''} ${row.zone ?? ''}`),
        source: 'ego_real_estate',
        source_agency_name: row.agency_name,
        source_agency_phone: undefined,
        operation: row.operation_type ?? 'sale',
        type: row.property_type ?? 'villa',
        detected_type: row.property_type ?? 'villa',
        description: row.description ?? undefined,
        deleted_at: row.deleted_at ?? null
      }

      return { property, score: scoreProperty(property, parsed) }
    })
    .filter(({ property }) => passesHardFilters(property, parsed))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      if (a.score === 0 && b.score === 0) return a.property.price - b.property.price
      return 0
    })
    .map(({ property }) => property)
}
