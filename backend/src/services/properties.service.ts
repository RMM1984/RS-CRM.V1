import type { PoolClient } from 'pg'
import { createRow, getRow, listRows, updateRow } from './table.service'

export const listProperties = (db: PoolClient) => listRows(db, 'properties')
export const getProperty = (db: PoolClient, id: string) => getRow(db, 'properties', id)
export const createProperty = (db: PoolClient, data: Record<string, unknown>) =>
  createRow(db, 'properties', data)
export const updateProperty = (db: PoolClient, id: string, data: Record<string, unknown>) =>
  updateRow(db, 'properties', id, data)
