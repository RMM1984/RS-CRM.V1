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
    req.user = verifyToken(token)
    return next()
  } catch {
    return error(res, 'Invalid or expired token', 401)
  }
}
