import type { PoolClient } from 'pg'
import { createRow, getRow, listRows, updateRow } from './table.service'

export const listContacts = (db: PoolClient) => listRows(db, 'contacts')
export const getContact = (db: PoolClient, id: string) => getRow(db, 'contacts', id)
export const createContact = (db: PoolClient, data: Record<string, unknown>) =>
  createRow(db, 'contacts', data)
export const updateContact = (db: PoolClient, id: string, data: Record<string, unknown>) =>
  updateRow(db, 'contacts', id, data)
