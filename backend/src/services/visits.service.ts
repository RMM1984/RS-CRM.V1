import crypto from 'node:crypto'
import type { PoolClient } from 'pg'
import { pool, quoteIdentifier } from '../config/db'
import { env } from '../config/env'
import type { AuthUser } from '../types/express'

export type VisitStatus = 'scheduled' | 'done' | 'cancelled' | 'no_show'

export type VisitFilters = {
  from?: string
  to?: string
  agent_id?: string
  status?: VisitStatus
  page: number
  limit: number
}

export type VisitInput = {
  title?: string | null
  scheduled_at: string
  duration_min?: number | null
  location?: string | null
  contact_id?: string | null
  property_id?: string | null
  operation_id?: string | null
  notes?: string | null
  status?: VisitStatus
}

let tenantSchemaReady = false
let publicSchemaReady = false

const visitSelect = `
  v.id,
  v.title,
  v.scheduled_at,
  v.duration_min,
  v.location,
  v.contact_id,
  v.property_id,
  v.operation_id,
  v.agent_id,
  v.status,
  v.notes,
  v.reminder_sent,
  v.ical_uid,
  v.created_at,
  v.updated_at,
  c.full_name AS contact_name,
  c.phone AS contact_phone,
  c.email AS contact_email,
  p.title AS property_title,
  p.address AS property_address,
  p.city AS property_city,
  p.price AS property_price,
  u.full_name AS agent_name,
  u.email AS agent_email
`

const safeDate = (date: string | Date) => new Date(date).toISOString()

const escapeIcs = (value?: string | null) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')

const formatIcsDate = (date: Date) =>
  date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')

const foldIcsLine = (line: string) => {
  const chunks: string[] = []
  let current = line

  while (current.length > 74) {
    chunks.push(current.slice(0, 74))
    current = ` ${current.slice(74)}`
  }

  chunks.push(current)
  return chunks.join('\r\n')
}

export const ensureVisitsSchema = async (db: PoolClient) => {
  if (tenantSchemaReady) return

  await db.query(`
    ALTER TABLE visits ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE visits ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
    UPDATE visits SET scheduled_at = COALESCE(scheduled_at, starts_at, now()) WHERE scheduled_at IS NULL;
    ALTER TABLE visits ALTER COLUMN scheduled_at SET NOT NULL;
    ALTER TABLE visits ADD COLUMN IF NOT EXISTS duration_min INTEGER DEFAULT 60;
    ALTER TABLE visits ADD COLUMN IF NOT EXISTS location TEXT;
    ALTER TABLE visits ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);
    ALTER TABLE visits ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id);
    ALTER TABLE visits ADD COLUMN IF NOT EXISTS operation_id UUID REFERENCES operations(id);
    ALTER TABLE visits ADD COLUMN IF NOT EXISTS agent_id UUID;
    ALTER TABLE visits ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';
    UPDATE visits SET status = 'done' WHERE status = 'completed';
    ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_status_check;
    ALTER TABLE visits ADD CONSTRAINT visits_status_check CHECK (status IN ('scheduled','done','cancelled','no_show'));
    ALTER TABLE visits ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE visits ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;
    ALTER TABLE visits ADD COLUMN IF NOT EXISTS ical_uid TEXT;
    ALTER TABLE visits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE visits ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE visits ALTER COLUMN contact_id DROP NOT NULL;
    ALTER TABLE visits ALTER COLUMN property_id DROP NOT NULL;
    ALTER TABLE visits ALTER COLUMN starts_at DROP NOT NULL;
    UPDATE visits SET duration_min = 60 WHERE duration_min IS NULL;
    UPDATE visits SET ical_uid = id::text || '@rs-crm.com' WHERE ical_uid IS NULL;
    CREATE INDEX IF NOT EXISTS visits_scheduled_at_idx ON visits(scheduled_at);
    CREATE INDEX IF NOT EXISTS visits_agent_id_idx ON visits(agent_id);
    CREATE INDEX IF NOT EXISTS visits_status_idx ON visits(status);
  `)

  tenantSchemaReady = true
}

export const ensurePublicCalendarSchema = async () => {
  if (publicSchemaReady) return

  await pool.query('ALTER TABLE public.users ADD COLUMN IF NOT EXISTS calendar_token TEXT UNIQUE')
  publicSchemaReady = true
}

const queryVisits = async (db: PoolClient, where: string, values: unknown[], limit?: number, offset?: number) => {
  const pagination = limit ? `LIMIT $${values.length + 1} OFFSET $${values.length + 2}` : ''
  const { rows } = await db.query(
    `SELECT ${visitSelect}
     FROM visits v
     LEFT JOIN contacts c ON c.id = v.contact_id
     LEFT JOIN properties p ON p.id = v.property_id
     LEFT JOIN public.users u ON u.id = v.agent_id
     ${where}
     ORDER BY v.scheduled_at ASC
     ${pagination}`,
    limit ? [...values, limit, offset ?? 0] : values
  )

  return rows
}

const buildFilters = (filters: VisitFilters, user: AuthUser) => {
  const clauses = ['v.status != $1']
  const values: unknown[] = ['cancelled_deleted_marker']

  if (filters.from) {
    values.push(safeDate(filters.from))
    clauses.push(`v.scheduled_at >= $${values.length}`)
  }

  if (filters.to) {
    values.push(safeDate(filters.to))
    clauses.push(`v.scheduled_at <= $${values.length}`)
  }

  if (filters.status) {
    values.push(filters.status)
    clauses.push(`v.status = $${values.length}`)
  }

  if (user.role === 'agent') {
    values.push(user.id)
    clauses.push(`v.agent_id = $${values.length}`)
  } else if (filters.agent_id) {
    values.push(filters.agent_id)
    clauses.push(`v.agent_id = $${values.length}`)
  }

  return {
    where: `WHERE ${clauses.join(' AND ')}`,
    values
  }
}

export const listVisits = async (db: PoolClient, filters: VisitFilters, user: AuthUser) => {
  await ensureVisitsSchema(db)
  const { where, values } = buildFilters(filters, user)
  const offset = (filters.page - 1) * filters.limit
  const count = await db.query(`SELECT count(*)::int AS total FROM visits v ${where}`, values)
  const visits = await queryVisits(db, where, values, filters.limit, offset)

  return {
    visits,
    total: count.rows[0]?.total ?? 0,
    page: filters.page,
    limit: filters.limit
  }
}

export const getVisit = async (db: PoolClient, id: string, user: AuthUser) => {
  await ensureVisitsSchema(db)
  const values: unknown[] = [id]
  const agentClause = user.role === 'agent' ? 'AND v.agent_id = $2' : ''

  if (user.role === 'agent') values.push(user.id)

  const rows = await queryVisits(db, `WHERE v.id = $1 ${agentClause}`, values)
  return rows[0] ?? null
}

const resolveDefaults = async (db: PoolClient, data: VisitInput) => {
  const contact = data.contact_id
    ? (await db.query<{ full_name: string }>('SELECT full_name FROM contacts WHERE id = $1', [data.contact_id])).rows[0]
    : null
  const property = data.property_id
    ? (await db.query<{ title: string; address: string; city: string }>('SELECT title, address, city FROM properties WHERE id = $1', [data.property_id])).rows[0]
    : null

  return {
    title: data.title?.trim() || `Visita${contact?.full_name ? ` - ${contact.full_name}` : ''}`,
    location: data.location?.trim() || [property?.address, property?.city].filter(Boolean).join(', ') || null
  }
}

export const createVisit = async (db: PoolClient, data: VisitInput, user: AuthUser) => {
  await ensureVisitsSchema(db)
  const defaults = await resolveDefaults(db, data)
  const duration = data.duration_min ?? 60
  const agentId = user.id
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO visits (
      title, scheduled_at, duration_min, location, contact_id,
      property_id, operation_id, agent_id, status, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id`,
    [
      defaults.title,
      safeDate(data.scheduled_at),
      duration,
      defaults.location,
      data.contact_id ?? null,
      data.property_id ?? null,
      data.operation_id ?? null,
      agentId,
      data.status ?? 'scheduled',
      data.notes ?? null
    ]
  )

  await db.query("UPDATE visits SET ical_uid = id::text || '@rs-crm.com' WHERE id = $1", [rows[0].id])
  return getVisit(db, rows[0].id, user)
}

export const updateVisit = async (
  db: PoolClient,
  id: string,
  data: Partial<VisitInput>,
  user: AuthUser
) => {
  await ensureVisitsSchema(db)
  const updates: string[] = []
  const values: unknown[] = [id]

  const add = (column: string, value: unknown) => {
    if (value === undefined) return
    values.push(value)
    updates.push(`${column} = $${values.length}`)
  }

  add('title', data.title)
  add('scheduled_at', data.scheduled_at ? safeDate(data.scheduled_at) : undefined)
  add('duration_min', data.duration_min)
  add('location', data.location)
  add('contact_id', data.contact_id)
  add('property_id', data.property_id)
  add('operation_id', data.operation_id)
  add('status', data.status)
  add('notes', data.notes)

  if (!updates.length) return getVisit(db, id, user)

  const agentClause = user.role === 'agent' ? `AND agent_id = $${values.length + 1}` : ''
  const queryValues = user.role === 'agent' ? [...values, user.id] : values
  const { rows } = await db.query<{ id: string }>(
    `UPDATE visits
     SET ${updates.join(', ')}, updated_at = now()
     WHERE id = $1 ${agentClause}
     RETURNING id`,
    queryValues
  )

  return rows[0] ? getVisit(db, rows[0].id, user) : null
}

export const cancelVisit = async (db: PoolClient, id: string, user: AuthUser) =>
  updateVisit(db, id, { status: 'cancelled' }, user)

export const getCalendarVisits = async (
  db: PoolClient,
  range: { from: string; to: string },
  user: AuthUser
) => {
  await ensureVisitsSchema(db)
  const filters = { from: range.from, to: range.to, page: 1, limit: 500 }
  const { where, values } = buildFilters(filters, user)
  const visits = await queryVisits(db, where, values)

  return visits.reduce<Record<string, unknown[]>>((days, visit) => {
    const key = new Date(visit.scheduled_at).toISOString().slice(0, 10)
    days[key] = [...(days[key] ?? []), visit]
    return days
  }, {})
}

export const getOrCreateCalendarToken = async (user: AuthUser) => {
  await ensurePublicCalendarSchema()

  const existing = await pool.query<{ calendar_token: string | null }>(
    'SELECT calendar_token FROM public.users WHERE id = $1',
    [user.id]
  )
  const token = existing.rows[0]?.calendar_token

  if (token) return token

  const nextToken = crypto
    .createHash('sha256')
    .update(`${user.id}:${env.JWT_SECRET}`)
    .digest('hex')

  await pool.query('UPDATE public.users SET calendar_token = $1 WHERE id = $2', [nextToken, user.id])
  return nextToken
}

export const buildIcsForToken = async (agentToken: string) => {
  await ensurePublicCalendarSchema()
  const client = await pool.connect()

  try {
    const userResult = await client.query<{
      id: string
      full_name: string
      schema_name: string
    }>(
      `SELECT u.id, u.full_name, t.schema_name
       FROM public.users u
       JOIN public.tenants t ON t.id = u.tenant_id
       WHERE u.calendar_token = $1 AND u.deleted_at IS NULL`,
      [agentToken]
    )
    const calendarUser = userResult.rows[0]
    if (!calendarUser) return null

    await client.query('BEGIN')
    await client.query(`SET LOCAL search_path TO ${quoteIdentifier(calendarUser.schema_name)}, public`)
    await ensureVisitsSchema(client)

    const visits = await queryVisits(
      client,
      `WHERE v.agent_id = $1 AND v.scheduled_at >= now() - interval '30 days'`,
      [calendarUser.id]
    )
    await client.query('COMMIT')

    const now = formatIcsDate(new Date())
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//RS-CRM//ES',
      'CALSCALE:GREGORIAN',
      'X-WR-CALNAME:RS-CRM - Mis Visitas',
      'X-WR-TIMEZONE:Europe/Madrid'
    ]

    for (const visit of visits) {
      const start = new Date(visit.scheduled_at)
      const end = new Date(start.getTime() + Number(visit.duration_min ?? 60) * 60_000)
      const description = [
        visit.contact_name ? `Cliente: ${visit.contact_name}` : null,
        visit.property_title ? `Propiedad: ${visit.property_title}` : null,
        visit.notes ? `Notas: ${visit.notes}` : null
      ].filter(Boolean).join('\n')

      lines.push(
        'BEGIN:VEVENT',
        `UID:${escapeIcs(visit.ical_uid ?? `${visit.id}@rs-crm.com`)}`,
        `DTSTAMP:${now}`,
        `DTSTART:${formatIcsDate(start)}`,
        `DTEND:${formatIcsDate(end)}`,
        `SUMMARY:${escapeIcs(visit.title)}`,
        `DESCRIPTION:${escapeIcs(description)}`,
        `LOCATION:${escapeIcs(visit.location ?? visit.property_address)}`,
        `STATUS:${visit.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
        'END:VEVENT'
      )
    }

    lines.push('END:VCALENDAR')
    return lines.map(foldIcsLine).join('\r\n')
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // Ignore rollback errors for public calendar generation.
    }
    throw error
  } finally {
    client.release()
  }
}
