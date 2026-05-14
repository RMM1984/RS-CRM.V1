import type { PoolClient } from 'pg'

type Filters = Record<string, string | number | boolean | null | undefined>

const allowedTables = new Set([
  'contacts',
  'properties',
  'operations',
  'visits',
  'activities',
  'ai_requests'
])

const assertTable = (table: string) => {
  if (!allowedTables.has(table)) {
    throw new Error(`Unsupported table: ${table}`)
  }
}

export const listRows = async (db: PoolClient, table: string, filters: Filters = {}) => {
  assertTable(table)
  const entries = Object.entries(filters).filter(([, value]) => value !== undefined)
  const where = entries.map(([key], index) => `${key} = $${index + 1}`).join(' AND ')
  const values = entries.map(([, value]) => value)
  const query = `SELECT * FROM ${table}${where ? ` WHERE ${where}` : ''} ORDER BY created_at DESC`
  const { rows } = await db.query(query, values)

  return rows
}

export const getRow = async (db: PoolClient, table: string, id: string) => {
  assertTable(table)
  const { rows } = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id])

  return rows[0] ?? null
}

export const createRow = async (
  db: PoolClient,
  table: string,
  data: Record<string, unknown>
) => {
  assertTable(table)
  const keys = Object.keys(data)
  const columns = keys.join(', ')
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ')
  const values = keys.map((key) => data[key])
  const { rows } = await db.query(
    `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`,
    values
  )

  return rows[0]
}

export const updateRow = async (
  db: PoolClient,
  table: string,
  id: string,
  data: Record<string, unknown>
) => {
  assertTable(table)
  const keys = Object.keys(data)
  const assignments = keys.map((key, index) => `${key} = $${index + 2}`).join(', ')
  const values = [id, ...keys.map((key) => data[key])]
  const { rows } = await db.query(
    `UPDATE ${table} SET ${assignments}, updated_at = now() WHERE id = $1 RETURNING *`,
    values
  )

  return rows[0] ?? null
}
