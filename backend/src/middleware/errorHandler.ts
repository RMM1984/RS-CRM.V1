import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { env } from '../config/env'

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err)

  if (err instanceof ZodError) {
    res.status(422).json({
      ok: false,
      error: { message: 'Validation failed', details: err.flatten() }
    })
    return
  }

  res.status(500).json({
    ok: false,
    error: {
      message: 'Internal server error',
      details: env.NODE_ENV === 'production' ? undefined : String(err)
    }
  })
}
