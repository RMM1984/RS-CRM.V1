import type { NextFunction, Request, Response } from 'express'
import { pool, quoteIdentifier } from '../config/db'

export const setSchema = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schemaName = req.user?.schema_name

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
    const releaseClient = async () => {
      if (released) return
      released = true

      try {
        if (res.statusCode >= 400) {
          await client.query('ROLLBACK')
        } else {
          await client.query('COMMIT')
        }
      } catch (releaseError) {
        console.error('[setSchema] Release transaction error:', releaseError)
        try {
          await client.query('ROLLBACK')
        } catch {
          // Ignore rollback failure during cleanup.
        }
      } finally {
        client.release()
      }
    }

    await client.query('BEGIN')
    await client.query(`SET LOCAL search_path TO ${schema}, public`)
    req.db = client
    req.schemaName = schemaName

    res.on('finish', () => {
      void releaseClient()
    })
    res.on('close', () => {
      if (!res.writableEnded) {
        void releaseClient()
      }
    })

    return next()
  } catch (setSchemaError) {
    console.error('[setSchema] Error:', setSchemaError)
    return next(setSchemaError)
  }
}
