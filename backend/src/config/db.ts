import { Pool } from 'pg'
import { env } from './env'

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
})

export const quoteIdentifier = (identifier: string) => {
  if (!/^tenant_[a-z0-9_]+$/.test(identifier)) {
    throw new Error('Invalid tenant schema name')
  }

  return `"${identifier.replace(/"/g, '""')}"`
}
