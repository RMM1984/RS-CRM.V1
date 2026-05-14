import type { PoolClient } from 'pg'
import { createRow, getRow, listRows, updateRow } from './table.service'

export const listVisits = (db: PoolClient) => listRows(db, 'visits')
export const getVisit = (db: PoolClient, id: string) => getRow(db, 'visits', id)
export const createVisit = (db: PoolClient, data: Record<string, unknown>) =>
  createRow(db, 'visits', data)
export const updateVisit = (db: PoolClient, id: string, data: Record<string, unknown>) =>
  updateRow(db, 'visits', id, data)
