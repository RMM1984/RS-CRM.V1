import bcrypt from 'bcryptjs'
import { pool } from '../config/db'
import { signToken } from '../utils/jwt'

export const login = async (email: string, password: string) => {
  const { rows } = await pool.query(
    `SELECT
      u.id,
      u.email,
      u.password_hash,
      u.role,
      u.tenant_id,
      t.slug AS tenant_slug,
      t.schema_name,
      t.plan = 'premium' AS is_premium,
      t.status
    FROM public.users u
    JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.email = $1 AND u.deleted_at IS NULL`,
    [email.toLowerCase()]
  )

  const user = rows[0]

  if (!user || user.status !== 'active') {
    return null
  }

  const passwordMatches =
    (await bcrypt.compare(password, user.password_hash)) ||
    (await verifyPostgresCryptPassword(password, user.password_hash))

  if (!passwordMatches) {
    return null
  }

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    tenant_id: user.tenant_id,
    tenant_slug: user.tenant_slug,
    schema_name: user.schema_name,
    is_premium: user.is_premium
  })

  return { token }
}

const verifyPostgresCryptPassword = async (password: string, passwordHash: string) => {
  const { rows } = await pool.query(
    'SELECT crypt($1, $2) = $2 AS matches',
    [password, passwordHash]
  )

  return rows[0]?.matches === true
}
