import type { Response } from 'express'

export const success = <T>(res: Response, data: T, status = 200) =>
  res.status(status).json({ ok: true, data })

export const error = (res: Response, message: string, status = 400, details?: unknown) =>
  res.status(status).json({ ok: false, error: { message, details } })
