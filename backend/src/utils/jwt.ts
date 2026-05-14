import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'
import { z } from 'zod'
import { env } from '../config/env'
import type { AuthUser } from '../types/express'

const jwtPayloadSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'agent']),
  tenant_id: z.string().uuid(),
  tenant_slug: z.string(),
  schema_name: z.string().regex(/^tenant_[a-z0-9_]+$/),
  is_premium: z.boolean()
})

export const signToken = (payload: AuthUser) =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn']
  })

export const verifyToken = (token: string): AuthUser =>
  jwtPayloadSchema.parse(jwt.verify(token, env.JWT_SECRET))
