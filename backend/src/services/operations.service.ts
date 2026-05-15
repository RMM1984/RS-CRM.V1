import type { PoolClient } from 'pg'
import type { AuthUser } from '../types/express'

export type OperationStage = 'lead' | 'visit' | 'offer' | 'contract' | 'closed' | 'lost'
export type OperationType = 'sale' | 'rent'

export type OperationFilters = {
  type?: OperationType
  stage?: OperationStage
  agent_id?: string
  contact_id?: string
  property_id?: string
}

export type OperationInput = {
  contact_id: string
  property_id?: string | null
  type: OperationType
  stage?: OperationStage
  value?: number | null
  notes?: string | null
  agent_id?: string | null
}

const stages: OperationStage[] = ['lead', 'visit', 'offer', 'contract', 'closed', 'lost']

const operationSelect = `
  o.id,
  o.contact_id,
  o.property_id,
  o.type,
  o.stage,
  o.value,
  o.notes,
  o.agent_id,
  o.active,
  o.closed_at,
  o.created_at,
  o.updated_at,
  c.full_name AS contact_name,
  c.phone AS contact_phone,
  c.email AS contact_email,
  p.title AS property_title,
  p.price AS property_price,
  p.source AS property_source,
  p.source_url AS property_source_url,
  u.full_name AS agent_name,
  u.email AS agent_email
`

export const ensureOperationsModuleSchema = async (db: PoolClient) => {
  await db.query(`
    ALTER TABLE operations ADD COLUMN IF NOT EXISTS status TEXT;
    ALTER TABLE operations ADD COLUMN IF NOT EXISTS amount NUMERIC;
    ALTER TABLE operations ADD COLUMN IF NOT EXISTS stage TEXT;
    UPDATE operations SET stage = CASE
      WHEN stage IS NOT NULL THEN stage
      WHEN status = 'qualified' THEN 'visit'
      WHEN status = 'tour' THEN 'visit'
      WHEN status = 'closing' THEN 'contract'
      WHEN status = 'won' THEN 'closed'
      WHEN status = 'lost' THEN 'lost'
      ELSE 'lead'
    END;
    ALTER TABLE operations ALTER COLUMN stage SET DEFAULT 'lead';
    ALTER TABLE operations ALTER COLUMN stage SET NOT NULL;
    ALTER TABLE operations DROP CONSTRAINT IF EXISTS operations_stage_check;
    ALTER TABLE operations ADD CONSTRAINT operations_stage_check
      CHECK (stage IN ('lead', 'visit', 'offer', 'contract', 'closed', 'lost'));

    ALTER TABLE operations ADD COLUMN IF NOT EXISTS value NUMERIC;
    UPDATE operations SET value = coalesce(value, amount, 0);
    ALTER TABLE operations ALTER COLUMN value SET DEFAULT 0;
    ALTER TABLE operations ALTER COLUMN value SET NOT NULL;

    ALTER TABLE operations ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE operations ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.users(id);
    ALTER TABLE operations ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE operations ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS operations_stage_idx ON operations(stage);
    CREATE INDEX IF NOT EXISTS operations_agent_id_idx ON operations(agent_id);
    CREATE INDEX IF NOT EXISTS operations_contact_id_idx ON operations(contact_id);
    CREATE INDEX IF NOT EXISTS operations_property_id_idx ON operations(property_id);
    CREATE INDEX IF NOT EXISTS operations_active_idx ON operations(active);
  `)
}

const queryOperations = async (db: PoolClient, where: string, values: unknown[]) => {
  const { rows } = await db.query(
    `SELECT ${operationSelect}
     FROM operations o
     JOIN contacts c ON c.id = o.contact_id
     LEFT JOIN properties p ON p.id = o.property_id
     LEFT JOIN public.users u ON u.id = o.agent_id
     ${where}
     ORDER BY
      CASE o.stage
        WHEN 'lead' THEN 1
        WHEN 'visit' THEN 2
        WHEN 'offer' THEN 3
        WHEN 'contract' THEN 4
        WHEN 'closed' THEN 5
        WHEN 'lost' THEN 6
        ELSE 7
      END,
      o.created_at DESC`,
    values
  )

  return rows
}

const buildFilters = (filters: OperationFilters, user: AuthUser) => {
  const clauses = ['o.active = true']
  const values: unknown[] = []

  const add = (column: string, value?: string) => {
    if (!value) return
    values.push(value)
    clauses.push(`${column} = $${values.length}`)
  }

  add('o.type', filters.type)
  add('o.stage', filters.stage)
  add('o.contact_id', filters.contact_id)
  add('o.property_id', filters.property_id)

  if (user.role === 'agent') {
    values.push(user.id)
    clauses.push(`o.agent_id = $${values.length}`)
  } else {
    add('o.agent_id', filters.agent_id)
  }

  return {
    where: `WHERE ${clauses.join(' AND ')}`,
    values
  }
}

export const listOperations = async (db: PoolClient, filters: OperationFilters, user: AuthUser) => {
  await ensureOperationsModuleSchema(db)
  const { where, values } = buildFilters(filters, user)

  return queryOperations(db, where, values)
}

export const getOperation = async (db: PoolClient, id: string, user: AuthUser) => {
  await ensureOperationsModuleSchema(db)
  const values: unknown[] = [id]
  const agentClause = user.role === 'agent' ? 'AND o.agent_id = $2' : ''

  if (user.role === 'agent') {
    values.push(user.id)
  }

  const rows = await queryOperations(db, `WHERE o.id = $1 AND o.active = true ${agentClause}`, values)

  return rows[0] ?? null
}

export const createOperation = async (db: PoolClient, data: OperationInput, user: AuthUser) => {
  await ensureOperationsModuleSchema(db)
  const agentId = user.role === 'admin' ? data.agent_id ?? user.id : user.id
  const stage = data.stage ?? 'lead'
  const closedAt = stage === 'closed' || stage === 'lost' ? 'now()' : 'NULL'
  const { rows } = await db.query(
    `INSERT INTO operations (contact_id, property_id, type, stage, value, notes, agent_id, active, closed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, ${closedAt})
     RETURNING id`,
    [
      data.contact_id,
      data.property_id ?? null,
      data.type,
      stage,
      data.value ?? 0,
      data.notes ?? null,
      agentId
    ]
  )

  return getOperation(db, rows[0].id, user)
}

export const updateOperation = async (
  db: PoolClient,
  id: string,
  data: Partial<OperationInput>,
  user: AuthUser
) => {
  await ensureOperationsModuleSchema(db)
  const updates: string[] = []
  const values: unknown[] = [id]

  const add = (column: string, value: unknown) => {
    if (value === undefined) return
    values.push(value)
    updates.push(`${column} = $${values.length}`)
  }

  add('contact_id', data.contact_id)
  add('property_id', data.property_id)
  add('type', data.type)
  add('stage', data.stage)
  add('value', data.value)
  add('notes', data.notes)

  if (user.role === 'admin') {
    add('agent_id', data.agent_id)
  }

  if (data.stage === 'closed' || data.stage === 'lost') {
    updates.push('closed_at = coalesce(closed_at, now())')
  } else if (data.stage) {
    updates.push('closed_at = NULL')
  }

  if (!updates.length) {
    return getOperation(db, id, user)
  }

  const agentClause = user.role === 'agent' ? `AND agent_id = $${values.length + 1}` : ''
  const queryValues = user.role === 'agent' ? [...values, user.id] : values
  const { rows } = await db.query(
    `UPDATE operations
     SET ${updates.join(', ')}, updated_at = now()
     WHERE id = $1 AND active = true ${agentClause}
     RETURNING id`,
    queryValues
  )

  return rows[0] ? getOperation(db, rows[0].id, user) : null
}

export const deleteOperation = async (db: PoolClient, id: string, user: AuthUser) => {
  await ensureOperationsModuleSchema(db)
  const values: unknown[] = [id]
  const agentClause = user.role === 'agent' ? 'AND agent_id = $2' : ''

  if (user.role === 'agent') {
    values.push(user.id)
  }

  const { rows } = await db.query(
    `UPDATE operations
     SET active = false, updated_at = now()
     WHERE id = $1 AND active = true ${agentClause}
     RETURNING id`,
    values
  )

  return rows[0] ? { id: rows[0].id } : null
}

export const getKanban = async (db: PoolClient, filters: OperationFilters, user: AuthUser) => {
  const operations = await listOperations(db, filters, user)

  return stages.reduce<Record<OperationStage, unknown[]>>(
    (kanban, stage) => ({
      ...kanban,
      [stage]: operations.filter((operation) => operation.stage === stage)
    }),
    {
      lead: [],
      visit: [],
      offer: [],
      contract: [],
      closed: [],
      lost: []
    }
  )
}
