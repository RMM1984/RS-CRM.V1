import type { RequestHandler } from 'express'
import { z } from 'zod'
import * as operationsService from '../services/operations.service'
import { error, success } from '../utils/response'

const operationSchema = z.object({
  contact_id: z.string().uuid(),
  property_id: z.string().uuid().optional().nullable(),
  type: z.enum(['sale', 'rent']),
  status: z.enum(['lead', 'qualified', 'tour', 'offer', 'closing', 'won', 'lost']).default('lead'),
  amount: z.number().nonnegative().default(0),
  expected_close_date: z.string().date().optional().nullable()
})

export const list: RequestHandler = async (req, res, next) => {
  try {
    return success(res, await operationsService.listOperations(req.db!))
  } catch (err) {
    return next(err)
  }
}

export const get: RequestHandler = async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const operation = await operationsService.getOperation(req.db!, id)
    return operation ? success(res, operation) : error(res, 'Operation not found', 404)
  } catch (err) {
    return next(err)
  }
}

export const create: RequestHandler = async (req, res, next) => {
  try {
    return success(res, await operationsService.createOperation(req.db!, operationSchema.parse(req.body)), 201)
  } catch (err) {
    return next(err)
  }
}

export const update: RequestHandler = async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const operation = await operationsService.updateOperation(
      req.db!,
      id,
      operationSchema.partial().parse(req.body)
    )
    return operation ? success(res, operation) : error(res, 'Operation not found', 404)
  } catch (err) {
    return next(err)
  }
}
