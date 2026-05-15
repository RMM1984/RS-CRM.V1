import type { RequestHandler } from 'express'
import { z } from 'zod'
import * as operationsService from '../services/operations.service'

const operationTypeSchema = z.enum(['sale', 'rent'])
const operationStageSchema = z.enum(['lead', 'visit', 'offer', 'contract', 'closed', 'lost'])
const idSchema = z.string().uuid()

const listQuerySchema = z.object({
  type: operationTypeSchema.optional(),
  stage: operationStageSchema.optional(),
  agent_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  property_id: z.string().uuid().optional()
})

const createOperationSchema = z.object({
  contact_id: z.string().uuid(),
  property_id: z.string().uuid().optional().nullable(),
  type: operationTypeSchema,
  stage: operationStageSchema.default('lead'),
  value: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  agent_id: z.string().uuid().optional().nullable()
})

const updateOperationSchema = createOperationSchema.partial()

const sendSuccess = <T>(res: Parameters<RequestHandler>[1], data: T, status = 200) =>
  res.status(status).json({ success: true, data })

const sendError = (res: Parameters<RequestHandler>[1], message: string, status = 404) =>
  res.status(status).json({ success: false, error: { message } })

export const list: RequestHandler = async (req, res, next) => {
  try {
    const filters = listQuerySchema.parse(req.query)
    const operations = await operationsService.listOperations(req.db!, filters, req.user!)

    return sendSuccess(res, operations)
  } catch (err) {
    return next(err)
  }
}

export const kanban: RequestHandler = async (req, res, next) => {
  try {
    const filters = listQuerySchema.parse(req.query)
    const data = await operationsService.getKanban(req.db!, filters, req.user!)

    return sendSuccess(res, data)
  } catch (err) {
    return next(err)
  }
}

export const get: RequestHandler = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const operation = await operationsService.getOperation(req.db!, id, req.user!)

    return operation ? sendSuccess(res, operation) : sendError(res, 'Operacion no encontrada')
  } catch (err) {
    return next(err)
  }
}

export const create: RequestHandler = async (req, res, next) => {
  try {
    const body = createOperationSchema.parse(req.body)
    const operation = await operationsService.createOperation(req.db!, body, req.user!)

    return sendSuccess(res, operation, 201)
  } catch (err) {
    return next(err)
  }
}

export const update: RequestHandler = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const body = updateOperationSchema.parse(req.body)
    const operation = await operationsService.updateOperation(req.db!, id, body, req.user!)

    return operation ? sendSuccess(res, operation) : sendError(res, 'Operacion no encontrada')
  } catch (err) {
    return next(err)
  }
}

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const operation = await operationsService.deleteOperation(req.db!, id, req.user!)

    return operation ? sendSuccess(res, operation) : sendError(res, 'Operacion no encontrada')
  } catch (err) {
    return next(err)
  }
}
