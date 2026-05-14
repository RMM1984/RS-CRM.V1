import type { NextFunction, Request, Response } from 'express'
import type { AuthRole } from '../types/express'
import { error } from '../utils/response'

export const requireRole =
  (...roles: AuthRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return error(res, 'Insufficient role permissions', 403)
    }

    return next()
  }
