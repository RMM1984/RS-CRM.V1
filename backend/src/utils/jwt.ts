import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'
import { z } from 'zod'
import { env } from '../config/env'
import type { AuthUser } from '../types/express'

const jwtPayloadSchema = z.object({
  id: z.string().uuid().optional(),
  sub: z.string().uuid().optional(),
  email: z.string().email(),
  role: z.enum(['admin', 'agent']),
  tenant_id: z.string().uuid(),
  tenant_slug: z.string(),
  schema_name: z.string().regex(/^tenant_[a-z0-9_]+$/),
  is_premium: z.boolean()
}).refine((payload) => payload.id || payload.sub, {
  message: 'Token payload must include id or sub'
})

export const signToken = (payload: AuthUser) =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn']
  })

export const verifyToken = (token: string): AuthUser => {
  const payload = jwtPayloadSchema.parse(jwt.verify(token, env.JWT_SECRET))
  const id = payload.sub ?? payload.id!

  return {
    id,
    sub: payload.sub ?? id,
    email: payload.email,
    role: payload.role,
    tenant_id: payload.tenant_id,
    tenant_slug: payload.tenant_slug,
    schema_name: payload.schema_name,
    is_premium: payload.is_premium
  }
}
