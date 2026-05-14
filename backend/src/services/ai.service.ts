import type { PoolClient } from 'pg'
import { createRow, listRows } from './table.service'

export const listAiRequests = (db: PoolClient) => listRows(db, 'ai_requests')

export const createAiRequest = (db: PoolClient, data: Record<string, unknown>) =>
  createRow(db, 'ai_requests', data)
