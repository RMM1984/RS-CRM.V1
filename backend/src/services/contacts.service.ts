import type { PoolClient } from 'pg'
import type { AuthUser } from '../types/express'

export type ContactFilters = {
  type?: string
  status?: string
  assigned_to?: string
  search?: string
  page: number
  limit: number
}

export type ContactInput = {
  name: string
  phone?: string | null
  email?: string | null
  type: string
  source?: string | null
  status?: string
  notes?: string | null
  assigned_to?: string | null
  client_profile?: string | null
  budget_min?: number | null
  budget_max?: number | null
  rooms_min?: number | null
  bathrooms_min?: number | null
  surface_min?: number | null
  price_per_m2_max?: number | null
  needs_renovation?: boolean | null
  needs_pool?: boolean | null
  needs_sea_view?: boolean | null
  needs_garden?: boolean | null
  needs_parking?: boolean | null
  preferred_zones?: string[] | null
  languages?: string[] | null
  requirements_text?: string | null
}

export type ContactUpdateInput = Partial<ContactInput>

export type InteractionInput = {
  type: 'call' | 'email' | 'note' | 'whatsapp' | 'visit'
  content: string
}

const contactSelect = `
  id,
  full_name AS name,
  phone,
  email,
  type,
  source,
  status,
  notes,
  assigned_to,
  client_profile,
  budget_min,
  budget_max,
  rooms_min,
  bathrooms_min,
  surface_min,
  price_per_m2_max,
  needs_renovation,
  needs_pool,
  needs_sea_view,
  needs_garden,
  needs_parking,
  preferred_zones,
  languages,
  requirements_text,
  active,
  created_at,
  updated_at
`

export const listContacts = async (
  db: PoolClient,
  filters: ContactFilters,
  user: AuthUser
) => {

  const clauses = ['active = true']
  const values: unknown[] = []

  if (filters.type) {
    values.push(filters.type)
    clauses.push(`type = $${values.length}`)
  }

  if (filters.status) {
    values.push(filters.status)
    clauses.push(`status = $${values.length}`)
  }

  if (user.role === 'agent') {
    values.push(user.id)
    clauses.push(`assigned_to = $${values.length}`)
  } else if (filters.assigned_to) {
    values.push(filters.assigned_to)
    clauses.push(`assigned_to = $${values.length}`)
  }

  if (filters.search) {
    values.push(`%${filters.search}%`)
    clauses.push(`(full_name ILIKE $${values.length} OR email ILIKE $${values.length} OR phone ILIKE $${values.length})`)
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const offset = (filters.page - 1) * filters.limit

  const countResult = await db.query(`SELECT count(*)::int AS total FROM contacts ${where}`, values)
  const contactsResult = await db.query(
    `SELECT ${contactSelect}
    FROM contacts
    ${where}
    ORDER BY created_at DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}`,
    [...values, filters.limit, offset]
  )

  return {
    contacts: contactsResult.rows,
    total: countResult.rows[0]?.total ?? 0,
    page: filters.page,
    limit: filters.limit
  }
}

export const getContact = async (db: PoolClient, id: string, user: AuthUser) => {

  const values: unknown[] = [id]
  const agentClause = user.role === 'agent' ? 'AND assigned_to = $2' : ''

  if (user.role === 'agent') {
    values.push(user.id)
  }

  const contactResult = await db.query(
    `SELECT ${contactSelect}
    FROM contacts
    WHERE id = $1 AND active = true ${agentClause}`,
    values
  )
  const contact = contactResult.rows[0]

  if (!contact) {
    return null
  }

  const interactions = await listInteractions(db, id, user, 10)

  return { ...contact, interactions }
}

export const createContact = async (
  db: PoolClient,
  data: ContactInput,
  user: AuthUser
) => {
  const assignedTo = data.assigned_to ?? user.id
  const { rows } = await db.query(
    `INSERT INTO contacts (
      full_name, phone, email, type, source, status, notes, assigned_to,
      client_profile, budget_min, budget_max, rooms_min, bathrooms_min, surface_min,
      price_per_m2_max, needs_renovation, needs_pool, needs_sea_view, needs_garden,
      needs_parking, preferred_zones, languages, requirements_text, active
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19,
      $20, $21, $22, $23, true
    )
    RETURNING ${contactSelect}`,
    [
      data.name,
      data.phone ?? null,
      data.email ?? null,
      data.type,
      data.source ?? null,
      data.status ?? 'activo',
      data.notes ?? null,
      assignedTo,
      data.client_profile ?? null,
      data.budget_min ?? null,
      data.budget_max ?? null,
      data.rooms_min ?? null,
      data.bathrooms_min ?? null,
      data.surface_min ?? null,
      data.price_per_m2_max ?? null,
      data.needs_renovation ?? false,
      data.needs_pool ?? false,
      data.needs_sea_view ?? false,
      data.needs_garden ?? false,
      data.needs_parking ?? false,
      data.preferred_zones ?? [],
      data.languages ?? [],
      data.requirements_text ?? null
    ]
  )

  return rows[0]
}

export const updateContact = async (
  db: PoolClient,
  id: string,
  data: ContactUpdateInput,
  user: AuthUser
) => {
  const updates: string[] = []
  const values: unknown[] = [id]

  const add = (column: string, value: unknown) => {
    if (value !== undefined) {
      values.push(value)
      updates.push(`${column} = $${values.length}`)
    }
  }

  add('full_name', data.name)
  add('phone', data.phone ?? undefined)
  add('email', data.email ?? undefined)
  add('type', data.type)
  add('source', data.source ?? undefined)
  add('status', data.status)
  add('notes', data.notes ?? undefined)
  add('client_profile', data.client_profile ?? undefined)
  add('budget_min', data.budget_min ?? undefined)
  add('budget_max', data.budget_max ?? undefined)
  add('rooms_min', data.rooms_min ?? undefined)
  add('bathrooms_min', data.bathrooms_min ?? undefined)
  add('surface_min', data.surface_min ?? undefined)
  add('price_per_m2_max', data.price_per_m2_max ?? undefined)
  add('needs_renovation', data.needs_renovation ?? undefined)
  add('needs_pool', data.needs_pool ?? undefined)
  add('needs_sea_view', data.needs_sea_view ?? undefined)
  add('needs_garden', data.needs_garden ?? undefined)
  add('needs_parking', data.needs_parking ?? undefined)
  add('preferred_zones', data.preferred_zones ?? undefined)
  add('languages', data.languages ?? undefined)
  add('requirements_text', data.requirements_text ?? undefined)

  if (user.role === 'admin') {
    add('assigned_to', data.assigned_to ?? undefined)
  }

  if (!updates.length) {
    return getContact(db, id, user)
  }

  const agentClause = user.role === 'agent' ? `AND assigned_to = $${values.length + 1}` : ''
  const queryValues = user.role === 'agent' ? [...values, user.id] : values
  const { rows } = await db.query(
    `UPDATE contacts
    SET ${updates.join(', ')}, updated_at = now()
    WHERE id = $1 AND active = true ${agentClause}
    RETURNING ${contactSelect}`,
    queryValues
  )

  return rows[0] ?? null
}

export const deleteContact = async (db: PoolClient, id: string, user: AuthUser) => {
  const values: unknown[] = [id]
  const agentClause = user.role === 'agent' ? 'AND assigned_to = $2' : ''

  if (user.role === 'agent') {
    values.push(user.id)
  }

  const { rows } = await db.query(
    `UPDATE contacts
    SET active = false, updated_at = now()
    WHERE id = $1 AND active = true ${agentClause}
    RETURNING ${contactSelect}`,
    values
  )

  return rows[0] ?? null
}

export const addInteraction = async (
  db: PoolClient,
  contactId: string,
  data: InteractionInput,
  user: AuthUser
) => {
  const contact = await getContact(db, contactId, user)

  if (!contact) {
    return null
  }

  const { rows } = await db.query(
    `INSERT INTO contact_interactions (contact_id, type, content, created_by)
    VALUES ($1, $2, $3, $4)
    RETURNING id, contact_id, type, content, created_by, created_at`,
    [contactId, data.type, data.content, user.id]
  )

  return rows[0]
}

export const listInteractions = async (
  db: PoolClient,
  contactId: string,
  user: AuthUser,
  limit?: number
) => {
  const values: unknown[] = [contactId]
  const agentClause = user.role === 'agent' ? 'AND c.assigned_to = $2' : ''

  if (user.role === 'agent') {
    values.push(user.id)
  }

  const limitClause = limit ? `LIMIT $${values.length + 1}` : ''
  const queryValues = limit ? [...values, limit] : values

  const { rows } = await db.query(
    `SELECT
      ci.id,
      ci.contact_id,
      ci.type,
      ci.content,
      ci.created_by,
      ci.created_at
    FROM contact_interactions ci
    JOIN contacts c ON c.id = ci.contact_id
    WHERE ci.contact_id = $1 AND c.active = true ${agentClause}
    ORDER BY ci.created_at DESC
    ${limitClause}`,
    queryValues
  )

  return rows
}
