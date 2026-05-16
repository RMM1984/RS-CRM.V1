import type { NextFunction, Request, Response } from 'express'
import { verifyToken } from '../utils/jwt'
import { error } from '../utils/response'

export const verifyJWT = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return error(res, 'Missing bearer token', 401)
  }

  try {
    const payload = verifyToken(token)

    req.user = {
      id: payload.sub || payload.id,
      sub: payload.sub || payload.id,
      email: payload.email,
      role: payload.role,
      tenant_id: payload.tenant_id,
      tenant_slug: payload.tenant_slug,
      schema_name: payload.schema_name,
      is_premium: payload.is_premium
    }

    console.log('[verifyJWT] decoded user:', req.user)
    return next()
  } catch {
    return error(res, 'Invalid or expired token', 401)
  }
}
