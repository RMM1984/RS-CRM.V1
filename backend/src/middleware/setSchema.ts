import type { NextFunction, Request, Response } from 'express'
import { pool, quoteIdentifier } from '../config/db'

export const setSchema = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schemaName = req.user?.schema_name

    console.log('[setSchema] user:', req.user)
    console.log('[setSchema] schema_name:', schemaName)

    if (!schemaName) {
      return res.status(401).json({
        success: false,
        error: 'Schema name missing from token',
        code: 'MISSING_SCHEMA'
      })
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schemaName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid schema name',
        code: 'INVALID_SCHEMA'
      })
    }

    const client = await pool.connect()
    const schema = quoteIdentifier(schemaName)
    let released = false
    const releaseClient = () => {
      if (released) return
      released = true
      client.query('RESET search_path').finally(() => client.release())
    }

    await client.query(`SET search_path TO ${schema}, public`)
    req.db = client
    req.schemaName = schemaName

    res.on('finish', releaseClient)
    res.on('close', () => {
      if (!res.writableEnded) {
        releaseClient()
      }
    })

    return next()
  } catch (setSchemaError) {
    console.error('[setSchema] Error:', setSchemaError)
    return next(setSchemaError)
  }
}
