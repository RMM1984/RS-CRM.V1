import type { PoolClient } from 'pg'
import { createRow, getRow, listRows, updateRow } from './table.service'

export const listOperations = (db: PoolClient) => listRows(db, 'operations')
export const getOperation = (db: PoolClient, id: string) => getRow(db, 'operations', id)
export const createOperation = (db: PoolClient, data: Record<string, unknown>) =>
  createRow(db, 'operations', data)
export const updateOperation = (db: PoolClient, id: string, data: Record<string, unknown>) =>
  updateRow(db, 'operations', id, data)
