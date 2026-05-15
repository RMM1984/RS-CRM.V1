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
  active,
  created_at,
  updated_at
`

export const ensureContactsModuleSchema = async (db: PoolClient) => {
  await db.query(`
    ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_type_check;
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'activo';
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS assigned_to UUID;
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE contacts ADD CONSTRAINT contacts_type_check
      CHECK (type IN ('comprador', 'vendedor', 'inquilino', 'propietario', 'ambos'));

    CREATE TABLE IF NOT EXISTS contact_interactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('call', 'email', 'note', 'whatsapp', 'visit')),
      content TEXT NOT NULL,
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS contacts_active_idx ON contacts(active);
    CREATE INDEX IF NOT EXISTS contacts_type_idx ON contacts(type);
    CREATE INDEX IF NOT EXISTS contacts_status_idx ON contacts(status);
    CREATE INDEX IF NOT EXISTS contacts_assigned_to_idx ON contacts(assigned_to);
    CREATE INDEX IF NOT EXISTS contact_interactions_contact_id_idx
      ON contact_interactions(contact_id, created_at DESC);
  `)
}

export const listContacts = async (
  db: PoolClient,
  filters: ContactFilters,
  user: AuthUser
) => {
  await ensureContactsModuleSchema(db)

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
  await ensureContactsModuleSchema(db)

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
  await ensureContactsModuleSchema(db)
  const assignedTo = data.assigned_to ?? user.id
  const { rows } = await db.query(
    `INSERT INTO contacts (full_name, phone, email, type, source, status, notes, assigned_to, active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
    RETURNING ${contactSelect}`,
    [
      data.name,
      data.phone ?? null,
      data.email ?? null,
      data.type,
      data.source ?? null,
      data.status ?? 'activo',
      data.notes ?? null,
      assignedTo
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
  await ensureContactsModuleSchema(db)
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
  await ensureContactsModuleSchema(db)
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
  await ensureContactsModuleSchema(db)
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
  await ensureContactsModuleSchema(db)
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
