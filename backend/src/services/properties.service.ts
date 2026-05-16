import crypto from 'node:crypto'
import type { PoolClient } from 'pg'
import { env } from '../config/env'
import type { AuthUser } from '../types/express'
import {
  getCrownCacheAgeMinutes,
  getCrownProperties,
  parseCrownSearchQuery,
  searchCrownProperties
} from './scrapers/crownProperty.scraper'
import type { ExternalProperty, SearchParams } from './propertySync.service'
import {
  hasAnyDetectedParameter,
  parseQuery,
  passesHardFilters,
  scoreProperty
} from './search/queryParser'

export type PropertyFilters = {
  type?: string
  operation?: string
  status?: string
  city?: string
  source?: string
  search?: string
  price_min?: number
  price_max?: number
  rooms_min?: number
  page: number
  limit: number
}

export type PropertyInput = {
  title: string
  address: string
  city: string
  zip?: string | null
  type: string
  operation: 'sale' | 'rent'
  price: number
  surface_m2?: number | null
  rooms?: number | null
  bathrooms?: number | null
  status?: string
  description?: string | null
  assigned_to?: string | null
}

export type ShortlistInput = {
  contact_id: string
  property_id?: string | null
  external_data?: Record<string, unknown> | null
  notes?: string | null
}

export class ShortlistDuplicateError extends Error {
  code = 'ALREADY_IN_SHORTLIST'

  constructor() {
    super('Esta propiedad ya está en el expediente de este cliente')
  }
}

type UploadedFile = {
  originalname: string
  mimetype: string
  buffer: Buffer
}

const propertySelect = `
  id,
  title,
  address,
  city,
  zip,
  property_type AS type,
  operation,
  price,
  sqm AS surface_m2,
  plot_m2,
  bedrooms AS rooms,
  bathrooms,
  status,
  description,
  assigned_to,
  source,
  source_url,
  source_agency_name,
  source_agency_phone,
  external_ref,
  external_badge,
  created_at,
  updated_at
`

const propertyListSelect = `
  ${propertySelect},
  COALESCE(
    (
      SELECT json_agg(pi ORDER BY pi.created_at)
      FROM property_images pi
      WHERE pi.property_id = properties.id
    ),
    '[]'::json
  ) AS images
`

export const listProperties = async (db: PoolClient, filters: PropertyFilters) => {
  const clauses = ['active = true']
  const values: unknown[] = []

  const add = (column: string, value?: unknown) => {
    if (value !== undefined && value !== '' && value !== 'all') {
      values.push(value)
      clauses.push(`${column} = $${values.length}`)
    }
  }

  add('property_type', filters.type)
  add('operation', filters.operation)
  add('status', filters.status)
  add('city', filters.city)
  if (filters.source && filters.source !== 'all') {
    if (filters.source === 'other') {
      clauses.push(`source <> 'internal'`)
    } else {
      add('source', filters.source)
    }
  }

  if (filters.search) {
    values.push(`%${filters.search}%`)
    clauses.push(`(title ILIKE $${values.length} OR address ILIKE $${values.length} OR city ILIKE $${values.length})`)
  }
  if (filters.price_min !== undefined) {
    values.push(filters.price_min)
    clauses.push(`price >= $${values.length}`)
  }
  if (filters.price_max !== undefined) {
    values.push(filters.price_max)
    clauses.push(`price <= $${values.length}`)
  }
  if (filters.rooms_min !== undefined) {
    values.push(filters.rooms_min)
    clauses.push(`bedrooms >= $${values.length}`)
  }

  const where = `WHERE ${clauses.join(' AND ')}`
  const offset = (filters.page - 1) * filters.limit
  const count = await db.query(`SELECT count(*)::int AS total FROM properties ${where}`, values)
  const { rows } = await db.query(
    `SELECT ${propertyListSelect} FROM properties ${where}
     ORDER BY source = 'internal' DESC, created_at DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, filters.limit, offset]
  )

  return { properties: rows, total: count.rows[0]?.total ?? 0, page: filters.page, limit: filters.limit }
}

export const createProperty = async (db: PoolClient, data: PropertyInput, user: AuthUser) => {
  const { rows } = await db.query(
    `INSERT INTO properties
    (title, address, city, zip, property_type, operation, price, sqm, bedrooms, bathrooms, status, description, assigned_to, source, active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'internal',true)
    RETURNING ${propertySelect}`,
    [
      data.title,
      data.address,
      data.city,
      data.zip ?? null,
      data.type,
      data.operation,
      data.price,
      data.surface_m2 ?? null,
      data.rooms ?? null,
      data.bathrooms ?? null,
      data.status ?? 'active',
      data.description ?? null,
      data.assigned_to ?? user.id
    ]
  )
  return rows[0]
}

export const getProperty = async (db: PoolClient, id: string) => {
  const property = await db.query(`SELECT ${propertySelect} FROM properties WHERE id = $1 AND active = true`, [id])
  if (!property.rows[0]) return null
  const images = await db.query('SELECT id, url, path, created_at FROM property_images WHERE property_id = $1 ORDER BY created_at', [id])
  return { ...property.rows[0], images: images.rows }
}

export const updateProperty = async (db: PoolClient, id: string, data: Partial<PropertyInput>) => {
  const existing = await getProperty(db, id)
  if (!existing) return null
  if (existing.source !== 'internal') return { forbidden: true }

  const map: Record<string, string> = {
    type: 'property_type',
    surface_m2: 'sqm',
    rooms: 'bedrooms'
  }
  const updates: string[] = []
  const values: unknown[] = [id]
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      values.push(value)
      updates.push(`${map[key] ?? key} = $${values.length}`)
    }
  })
  if (!updates.length) return existing
  const { rows } = await db.query(
    `UPDATE properties SET ${updates.join(', ')}, updated_at = now()
     WHERE id = $1 RETURNING ${propertySelect}`,
    values
  )
  return rows[0]
}

export const deleteProperty = async (db: PoolClient, id: string) => {
  const existing = await getProperty(db, id)
  if (!existing) return null
  if (existing.source !== 'internal') return { forbidden: true }
  const { rows } = await db.query(
    `UPDATE properties SET active = false, status = 'archived', updated_at = now()
     WHERE id = $1 RETURNING ${propertySelect}`,
    [id]
  )
  return rows[0]
}

export const addPropertyImage = async (db: PoolClient, id: string, file?: UploadedFile, user?: AuthUser) => {
  const filename = `${Date.now()}-${file?.originalname ?? 'image.jpg'}`
  const path = `${user?.tenant_slug ?? 'tenant'}/${id}/${filename}`
  let url = `/storage/property-images/${path}`

  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && file) {
    const storageUrl = `${env.SUPABASE_URL}/storage/v1/object/property-images/${path}`
    const response = await fetch(storageUrl, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': file.mimetype,
        'x-upsert': 'true'
      },
      body: file.buffer as unknown as BodyInit
    })

    if (!response.ok) {
      throw new Error(`Supabase Storage upload failed: ${await response.text()}`)
    }

    url = `${env.SUPABASE_URL}/storage/v1/object/public/property-images/${path}`
  }

  const { rows } = await db.query(
    'INSERT INTO property_images (property_id, url, path) VALUES ($1,$2,$3) RETURNING id, url, path, created_at',
    [id, url, path]
  )
  return rows[0]
}

export const deletePropertyImage = async (db: PoolClient, imageId: string) => {
  const { rows } = await db.query('DELETE FROM property_images WHERE id = $1 RETURNING id', [imageId])
  return rows[0] ?? null
}

type KeywordDictionary = Record<string, Record<string, string[]>>

const TYPE_KEYWORDS: Record<string, string[]> = {
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
  commercial: [
    'local', 'comercial', 'oficina', 'negocio', 'nave',
    'local comercial',
    'commercial', 'office', 'shop', 'retail', 'warehouse',
    'business', 'premises',
    'gewerbe', 'buro', 'laden', 'geschaft', 'lager', 'halle',
    'bedrijf', 'kantoor', 'winkel', 'pand', 'loods',
    'commerce', 'bureau', 'boutique', 'entrepot'
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
  garage: [
    'garaje', 'trastero', 'almacen', 'plaza de garaje',
    'garage', 'parking', 'storage', 'parking space',
    'parkplatz', 'stellplatz', 'lager',
    'parkeerplaats', 'berging', 'opslag',
    'place de parking', 'cave'
  ]
}

const operationKeywords: KeywordDictionary = {
  sale: {
    es: ['venta', 'vender', 'compra', 'comprar', 'adquirir'],
    en: ['sale', 'buy', 'purchase', 'buying', 'for sale'],
    de: ['kauf', 'kaufen', 'erwerb', 'zu verkaufen'],
    nl: ['koop', 'kopen', 'te koop', 'aankoop'],
    fr: ['vente', 'achat', 'acheter', 'a vendre']
  },
  rent: {
    es: ['alquiler', 'alquilar', 'arrendar', 'renta', 'arrendamiento'],
    en: ['rent', 'rental', 'lease', 'letting', 'to rent'],
    de: ['miete', 'mieten', 'vermietung', 'zu mieten'],
    nl: ['huur', 'huren', 'verhuur', 'te huur'],
    fr: ['location', 'louer', 'bail', 'a louer']
  }
}

const featureKeywords: KeywordDictionary = {
  sea_view: {
    es: ['mar', 'vista mar', 'vistas', 'playa', 'primera linea', 'marina'],
    en: ['sea', 'sea view', 'ocean', 'beach', 'seafront', 'waterfront'],
    de: ['meer', 'meerblick', 'strand', 'seeblick'],
    nl: ['zee', 'zeezicht', 'strand', 'waterkant'],
    fr: ['mer', 'vue mer', 'plage', 'bord de mer']
  },
  pool: {
    es: ['piscina', 'alberca'],
    en: ['pool', 'swimming pool'],
    de: ['pool', 'schwimmbad'],
    nl: ['zwembad', 'pool'],
    fr: ['piscine', 'bassin']
  },
  garden: {
    es: ['jardin', 'jardin privado', 'terraza', 'huerto'],
    en: ['garden', 'terrace', 'yard', 'outdoor'],
    de: ['garten', 'terrasse'],
    nl: ['tuin', 'terras'],
    fr: ['jardin', 'terrasse']
  }
}

const numberWords: Record<string, number> = {
  uno: 1,
  one: 1,
  eins: 1,
  een: 1,
  un: 1,
  dos: 2,
  two: 2,
  zwei: 2,
  twee: 2,
  deux: 2,
  tres: 3,
  three: 3,
  drei: 3,
  drie: 3,
  trois: 3,
  cuatro: 4,
  four: 4,
  vier: 4,
  quatre: 4,
  cinco: 5,
  five: 5,
  funf: 5,
  vijf: 5,
  cinq: 5,
  seis: 6,
  six: 6,
  sechs: 6,
  zes: 6
}

const knownAreaTerms = ['javea', 'xabia', 'denia', 'moraira', 'calpe', 'benissa', 'arenal', 'montanar', 'pueblo']

export const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const includesTerm = (text: string, term: string) => {
  const normalizedTerm = normalizeText(term)
  return new RegExp(`(^|\\W)${escapeRegExp(normalizedTerm)}($|\\W)`, 'i').test(text)
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const splitWords = (text: string) => text.split(/\s+/).filter(Boolean)
const typeMatchOrder = ['land', 'commercial', 'garage', 'villa', 'house', 'apartment']

const includesWholeTypeTerm = (text: string, term: string) => {
  const normalizedTerm = normalizeText(term)

  if (normalizedTerm.includes(' ')) {
    return new RegExp(`(^|\\s)${escapeRegExp(normalizedTerm)}($|\\s)`).test(text)
  }

  return splitWords(text).some((word) => word === normalizedTerm)
}

const findTypeMatch = (text: string) => {
  for (const value of typeMatchOrder) {
    const terms = TYPE_KEYWORDS[value] ?? []
    const term = terms.find((candidate) => includesWholeTypeTerm(text, candidate))

    if (term) {
      return { value, language: 'unknown', term: normalizeText(term) }
    }
  }

  return undefined
}

const normalizedSql = (column: string) =>
  `translate(lower(coalesce(${column}, '')), 'áàâäéèêëíìîïóòôöúùûüñ', 'aaaaeeeeiiiioooouuuun')`

const findDictionaryMatch = (text: string, dictionary: KeywordDictionary) => {
  for (const [value, languages] of Object.entries(dictionary)) {
    for (const [language, terms] of Object.entries(languages)) {
      const term = terms.find((candidate) => includesTerm(text, candidate))
      if (term) {
        return { value, language, term: normalizeText(term) }
      }
    }
  }

  return undefined
}

const findAllDictionaryMatches = (text: string, dictionary: KeywordDictionary) => {
  const matches: Array<{ value: string; language: string; term: string }> = []

  for (const [value, languages] of Object.entries(dictionary)) {
    for (const [language, terms] of Object.entries(languages)) {
      for (const term of terms) {
        if (includesTerm(text, term)) {
          matches.push({ value, language, term: normalizeText(term) })
          break
        }
      }
    }
  }

  return matches
}

const dictionaryTermsFor = (dictionary: KeywordDictionary, key: string) =>
  Object.values(dictionary[key] ?? {})
    .flat()
    .map((term) => normalizeText(term))

const detectRooms = (text: string) => {
  const numeric = text.match(/(\d+)\s*(hab|habitacion|habitaciones|dormitorio|dormitorios|bed|bedroom|bedrooms|zimmer|slaap|slaapkamer|slaapkamers|chambre|chambres)/i)

  if (numeric) {
    return Number(numeric[1])
  }

  const roomWords = ['hab', 'habitacion', 'habitaciones', 'dormitorio', 'dormitorios', 'bed', 'bedroom', 'bedrooms', 'zimmer', 'slaap', 'slaapkamer', 'slaapkamers', 'chambre', 'chambres']
  const tokens = text.split(/\s+/)

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const value = numberWords[tokens[index]]
    if (value && roomWords.some((word) => tokens[index + 1].startsWith(word))) {
      return value
    }
  }

  return undefined
}

const toNumber = (raw: string) => {
  const normalized = raw.replace(/\./g, '').replace(',', '.').replace(/\s/g, '')
  const multiplier = normalized.toLowerCase().endsWith('k') ? 1000 : 1
  return Number(normalized.replace(/[^\d.]/g, '')) * multiplier
}

const detectPriceMax = (text: string) => {
  const constrained = text.match(
    /(menos de|under|unter|minder dan|moins de|hasta|max|bis|tot|jusqu'?a)\s*(\d[\d.,\s]*\s*k?)/i
  )

  if (constrained) {
    return toNumber(constrained[2])
  }

  return [...text.matchAll(/\d[\d.,\s]*\s*k?/g)]
    .map((match) => toNumber(match[0]))
    .find((value) => value > 1000)
}

export const parseSearchQuery = (query: string, overrides?: { type?: string | null }): SearchParams => {
  const parsed = parseQuery(query, overrides)

  return {
    ...parsed,
    language_detected: parsed.detected_language
  }
}

export const searchProperties = async (db: PoolClient, query: string, overrides?: { type?: string | null }) => {
  const keywords = parseSearchQuery(query, overrides)
  const clauses = ["active = true", "status <> 'archived'"]
  const values: unknown[] = []

  if (keywords.type) {
    values.push(keywords.type)
    clauses.push(`property_type = $${values.length}`)
  }

  if (keywords.operation) {
    values.push(keywords.operation)
    clauses.push(`(operation = $${values.length} OR operation = 'both')`)
  }

  if (keywords.price_max != null) {
    values.push(keywords.price_max)
    clauses.push(`price <= $${values.length}`)
  }

  if (keywords.rooms_min != null) {
    values.push(keywords.rooms_min)
    clauses.push(`bedrooms >= $${values.length}`)
  }

  if (keywords.bathrooms_min != null) {
    values.push(keywords.bathrooms_min)
    clauses.push(`bathrooms >= $${values.length}`)
  }

  if (keywords.surface_min != null) {
    values.push(keywords.surface_min)
    clauses.push(`sqm >= $${values.length}`)
  }

  await getCrownProperties()
  const crownKeywords = parseCrownSearchQuery(query, overrides)
  const crownExternal = searchCrownProperties(query, overrides)
  const external = crownExternal
  let internal: unknown[] = []

  try {
    const { rows } = await db.query(
      `SELECT ${propertyListSelect}
       FROM properties
       WHERE ${clauses.join(' AND ')}
       ORDER BY source = 'internal' DESC, created_at DESC
       LIMIT 20`,
      values
    )
    const scored = rows
      .filter((property) => property.source === 'internal')
      .filter((property) => (hasAnyDetectedParameter(crownKeywords) ? passesHardFilters(property, crownKeywords) : true))
      .map((property) => ({ property, score: scoreProperty(property, crownKeywords) }))
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score
        if (a.score === 0 && b.score === 0) return Number(a.property.price) - Number(b.property.price)
        return 0
      })
    internal = scored.map((result) => result.property)
  } catch (error) {
    console.error('[PropertiesSearch] Internal DB search failed, returning Crown results only:', error)
  }

  return { keywords: { ...keywords, ...crownKeywords }, internal, external, cache_age_minutes: getCrownCacheAgeMinutes() }
}

export const externalId = (property: ExternalProperty) =>
  crypto.createHash('sha1').update(property.source_url).digest('hex')

export const createShortlistItem = async (db: PoolClient, data: ShortlistInput, user: AuthUser) => {

  if (data.property_id) {
    const { rows } = await db.query(
      'SELECT id FROM property_shortlist WHERE contact_id = $1 AND property_id = $2 LIMIT 1',
      [data.contact_id, data.property_id]
    )

    if (rows[0]) {
      throw new ShortlistDuplicateError()
    }
  } else {
    const sourceUrl =
      data.external_data && typeof data.external_data.source_url === 'string'
        ? data.external_data.source_url
        : null

    if (sourceUrl) {
      const { rows } = await db.query(
        `SELECT id FROM property_shortlist
         WHERE contact_id = $1
           AND external_data->>'source_url' = $2
         LIMIT 1`,
        [data.contact_id, sourceUrl]
      )

      if (rows[0]) {
        throw new ShortlistDuplicateError()
      }
    }
  }

  const { rows } = await db.query(
    `INSERT INTO property_shortlist (user_id, contact_id, property_id, external_data, notes)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [user.id, data.contact_id, data.property_id ?? null, data.external_data ?? null, data.notes ?? null]
  )
  return rows[0]
}

export const listShortlist = async (db: PoolClient, contactId?: string) => {
  const values: unknown[] = []
  const where = contactId ? 'WHERE ps.contact_id = $1' : ''
  if (contactId) values.push(contactId)
  const { rows } = await db.query(
    `SELECT
       ps.*,
       c.full_name AS contact_name,
       p.title AS property_title,
       p.source AS property_source,
       p.price AS property_price,
       p.operation AS property_operation,
       p.bedrooms AS property_rooms,
       p.sqm AS property_surface_m2,
       p.source_url AS property_source_url,
       ego.deleted_at AS external_deleted_at,
       COALESCE(
         (
           SELECT json_agg(pi ORDER BY pi.created_at)
           FROM property_images pi
           WHERE pi.property_id = p.id
         ),
         '[]'::json
       ) AS property_images
     FROM property_shortlist ps
     LEFT JOIN contacts c ON c.id = ps.contact_id
     LEFT JOIN properties p ON p.id = ps.property_id
     LEFT JOIN public.ego_properties ego
       ON ps.property_id IS NULL
      AND (
        ego.external_id = ps.external_data->>'ref'
        OR ego.id::text = ps.external_data->>'id'
        OR ('ego:' || ego.external_id) = ps.external_data->>'source_url'
      )
     ${where}
     ORDER BY ps.created_at DESC`,
    values
  )
  return rows
}

export const updateShortlistItem = async (db: PoolClient, id: string, data: { status?: string; notes?: string | null }) => {
  const { rows } = await db.query(
    `UPDATE property_shortlist SET
      status = COALESCE($2, status),
      notes = COALESCE($3, notes)
     WHERE id = $1 RETURNING *`,
    [id, data.status ?? null, data.notes ?? null]
  )
  return rows[0] ?? null
}

export const deleteShortlistItem = async (db: PoolClient, id: string) => {
  const { rows } = await db.query('DELETE FROM property_shortlist WHERE id = $1 RETURNING id', [id])
  return rows[0] ?? null
}
