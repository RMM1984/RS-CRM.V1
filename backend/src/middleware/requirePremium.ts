import type { NextFunction, Request, Response } from 'express'
import { error } from '../utils/response'

export const requirePremium = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.is_premium) {
    return error(res, 'Premium subscription required', 402)
  }

  return next()
}
