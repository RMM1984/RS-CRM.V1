import type { RequestHandler } from 'express'
import { z } from 'zod'
import * as propertiesService from '../services/properties.service'

const idSchema = z.string().uuid()

const createSchema = z
  .object({
    contact_id: z.string().uuid(),
    property_id: z.string().uuid().optional().nullable(),
    external_data: z.record(z.string(), z.unknown()).optional().nullable(),
    notes: z.string().trim().optional().nullable()
  })
  .refine((value) => value.property_id || value.external_data, {
    message: 'Indica una propiedad interna o datos externos'
  })

const updateSchema = z.object({
  status: z.enum(['investigating', 'visit_pending', 'interested', 'discarded']).optional(),
  notes: z.string().trim().optional().nullable()
})

const listQuerySchema = z.object({
  contact_id: z.string().uuid().optional()
})

const sendSuccess = <T>(res: Parameters<RequestHandler>[1], data: T, status = 200) =>
  res.status(status).json({ success: true, data })

const sendError = (res: Parameters<RequestHandler>[1], message: string, status = 404) =>
  res.status(status).json({ success: false, error: { message } })

export const create: RequestHandler = async (req, res, next) => {
  try {
    const item = await propertiesService.createShortlistItem(req.db!, createSchema.parse(req.body), req.user!)
    return sendSuccess(res, item, 201)
  } catch (err) {
    return next(err)
  }
}

export const list: RequestHandler = async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query)
    return sendSuccess(res, await propertiesService.listShortlist(req.db!, query.contact_id))
  } catch (err) {
    return next(err)
  }
}

export const update: RequestHandler = async (req, res, next) => {
  try {
    const item = await propertiesService.updateShortlistItem(
      req.db!,
      idSchema.parse(req.params.id),
      updateSchema.parse(req.body)
    )

    return item ? sendSuccess(res, item) : sendError(res, 'Expediente no encontrado')
  } catch (err) {
    return next(err)
  }
}

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const item = await propertiesService.deleteShortlistItem(req.db!, idSchema.parse(req.params.id))
    return item ? sendSuccess(res, item) : sendError(res, 'Expediente no encontrado')
  } catch (err) {
    return next(err)
  }
}

export const listByContact: RequestHandler = async (req, res, next) => {
  try {
    const contactId = idSchema.parse(req.params.id)
    return sendSuccess(res, await propertiesService.listShortlist(req.db!, contactId))
  } catch (err) {
    return next(err)
  }
}
