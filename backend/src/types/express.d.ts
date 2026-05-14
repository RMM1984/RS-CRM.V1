import type { PoolClient } from 'pg'

export type AuthRole = 'admin' | 'agent'

export type AuthUser = {
  id: string
  email: string
  role: AuthRole
  tenant_id: string
  tenant_slug: string
  schema_name: string
  is_premium: boolean
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
      db?: PoolClient
    }
  }
}
