import crypto from 'node:crypto'
import type { PoolClient } from 'pg'
import type { AuthUser } from '../types/express'
import { PropertySyncService, type ExternalProperty, type SearchParams } from './propertySync.service'

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
  bedrooms AS rooms,
  bathrooms,
  status,
  description,
  assigned_to,
  source,
  source_url,
  source_agency_name,
  source_agency_phone,
  created_at,
  updated_at
`

export const ensurePropertiesModuleSchema = async (db: PoolClient) => {
  await db.query(`
    ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_status_check;
    ALTER TABLE properties ADD COLUMN IF NOT EXISTS zip TEXT;
    ALTER TABLE properties ADD COLUMN IF NOT EXISTS operation TEXT NOT NULL DEFAULT 'sale';
    ALTER TABLE properties ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE properties ADD COLUMN IF NOT EXISTS assigned_to UUID;
    ALTER TABLE properties ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'internal';
    ALTER TABLE properties ADD COLUMN IF NOT EXISTS source_url TEXT;
    ALTER TABLE properties ADD COLUMN IF NOT EXISTS source_agency_name TEXT;
    ALTER TABLE properties ADD COLUMN IF NOT EXISTS source_agency_phone TEXT;
    ALTER TABLE properties ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE properties ADD CONSTRAINT properties_status_check
      CHECK (status IN ('draft', 'active', 'reserved', 'sold', 'rented', 'archived'));
    ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_source_check;
    ALTER TABLE properties ADD CONSTRAINT properties_source_check
      CHECK (source IN ('internal', 'kyero', 'sooprema', 'other'));

    CREATE TABLE IF NOT EXISTS property_images (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      path TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS property_shortlist (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES public.users(id),
      contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
      property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
      external_data JSONB,
      status TEXT DEFAULT 'investigating'
        CHECK (status IN ('investigating', 'visit_pending', 'interested', 'discarded')),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS properties_source_idx ON properties(source);
    CREATE INDEX IF NOT EXISTS properties_operation_idx ON properties(operation);
    CREATE INDEX IF NOT EXISTS properties_city_idx ON properties(city);
    CREATE INDEX IF NOT EXISTS property_shortlist_contact_id_idx ON property_shortlist(contact_id);
  `)
}

export const listProperties = async (db: PoolClient, filters: PropertyFilters) => {
  await ensurePropertiesModuleSchema(db)
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
  add('source', filters.source === 'all' ? undefined : filters.source)

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
    `SELECT ${propertySelect} FROM properties ${where}
     ORDER BY source = 'internal' DESC, created_at DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, filters.limit, offset]
  )

  return { properties: rows, total: count.rows[0]?.total ?? 0, page: filters.page, limit: filters.limit }
}

export const createProperty = async (db: PoolClient, data: PropertyInput, user: AuthUser) => {
  await ensurePropertiesModuleSchema(db)
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
  await ensurePropertiesModuleSchema(db)
  const property = await db.query(`SELECT ${propertySelect} FROM properties WHERE id = $1 AND active = true`, [id])
  if (!property.rows[0]) return null
  const images = await db.query('SELECT id, url, path, created_at FROM property_images WHERE property_id = $1 ORDER BY created_at', [id])
  return { ...property.rows[0], images: images.rows }
}

export const updateProperty = async (db: PoolClient, id: string, data: Partial<PropertyInput>) => {
  await ensurePropertiesModuleSchema(db)
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

export const addPropertyImage = async (db: PoolClient, id: string, file?: Express.Multer.File, user?: AuthUser) => {
  await ensurePropertiesModuleSchema(db)
  const filename = file?.originalname ?? `image-${Date.now()}.jpg`
  const path = `${user?.tenant_slug ?? 'tenant'}/${id}/${filename}`
  const url = `/storage/${path}`
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

export const parseSearchQuery = (query: string): SearchParams => {
  const text = query.toLowerCase()
  const numbers = [...text.matchAll(/\d+[.,]?\d*\s*k?/g)].map((match) => match[0])
  const price = numbers
    .map((value) => value.includes('k') ? Number(value.replace(/\D/g, '')) * 1000 : Number(value.replace(/\D/g, '')))
    .find((value) => value > 1000)
  const rooms = text.match(/(\d+)\s*(hab|habitaciones|dormitorios)/)?.[1]
  const type = ['piso', 'chalet', 'villa', 'apartamento', 'local'].find((word) => text.includes(word))
  const operation = text.includes('alquiler') || text.includes('renta') ? 'rent' : text.includes('compra') || text.includes('venta') ? 'sale' : undefined
  const knownCities = ['javea', 'xabia', 'denia', 'moraira', 'calpe', 'madrid', 'valencia']
  const city = knownCities.find((word) => text.includes(word))
  const features = text
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word.length > 3 && ![type, operation, city, 'menos', 'vistas', 'habitaciones'].includes(word))

  return { type, operation, city, price_max: price, rooms_min: rooms ? Number(rooms) : undefined, features }
}

export const searchProperties = async (db: PoolClient, query: string) => {
  const keywords = parseSearchQuery(query)
  const internal = await listProperties(db, {
    type: keywords.type,
    operation: keywords.operation,
    city: keywords.city,
    price_max: keywords.price_max,
    rooms_min: keywords.rooms_min,
    source: 'internal',
    page: 1,
    limit: 50
  })
  const external = await new PropertySyncService().searchExternal(keywords)
  return { keywords, internal: internal.properties, external }
}

export const externalId = (property: ExternalProperty) =>
  crypto.createHash('sha1').update(property.source_url).digest('hex')

export const createShortlistItem = async (db: PoolClient, data: ShortlistInput, user: AuthUser) => {
  await ensurePropertiesModuleSchema(db)
  const { rows } = await db.query(
    `INSERT INTO property_shortlist (user_id, contact_id, property_id, external_data, notes)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [user.id, data.contact_id, data.property_id ?? null, data.external_data ?? null, data.notes ?? null]
  )
  return rows[0]
}

export const listShortlist = async (db: PoolClient, contactId?: string) => {
  await ensurePropertiesModuleSchema(db)
  const values: unknown[] = []
  const where = contactId ? 'WHERE ps.contact_id = $1' : ''
  if (contactId) values.push(contactId)
  const { rows } = await db.query(
    `SELECT ps.*, c.full_name AS contact_name, p.title AS property_title, p.source AS property_source, p.price AS property_price
     FROM property_shortlist ps
     LEFT JOIN contacts c ON c.id = ps.contact_id
     LEFT JOIN properties p ON p.id = ps.property_id
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
