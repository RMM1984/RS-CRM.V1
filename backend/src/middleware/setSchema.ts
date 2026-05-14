import type { NextFunction, Request, Response } from 'express'
import { pool, quoteIdentifier } from '../config/db'
import { error } from '../utils/response'

export const setSchema = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.schema_name) {
    return error(res, 'Tenant schema missing from token', 401)
  }

  try {
    const client = await pool.connect()
    const schema = quoteIdentifier(req.user.schema_name)

    await client.query(`SET search_path TO ${schema}, public`)
    req.db = client

    res.on('finish', () => {
      client.query('RESET search_path').finally(() => client.release())
    })

    return next()
  } catch (err) {
    return next(err)
  }
}
