import bcrypt from 'bcryptjs'
import type { PoolClient } from 'pg'
import { pool } from '../config/db'

export const listTenantUsers = async (tenantId: string) => {
  const { rows } = await pool.query(
    `SELECT id, email, full_name, role, tenant_id, created_at
    FROM public.users
    WHERE tenant_id = $1 AND deleted_at IS NULL
    ORDER BY created_at DESC`,
    [tenantId]
  )

  return rows
}

export const createTenantUser = async (
  tenantId: string,
  input: { email: string; password: string; full_name: string; role: 'admin' | 'agent' }
) => {
  const passwordHash = await bcrypt.hash(input.password, 12)
  const { rows } = await pool.query(
    `INSERT INTO public.users (tenant_id, email, password_hash, full_name, role)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, email, full_name, role, tenant_id, created_at`,
    [tenantId, input.email.toLowerCase(), passwordHash, input.full_name, input.role]
  )

  return rows[0]
}

export const getProfile = async (db: PoolClient, userId: string) => {
  const { rows } = await db.query(
    `SELECT $1::uuid AS id, current_schema() AS active_schema`,
    [userId]
  )

  return rows[0]
}
