import type { RequestHandler } from 'express'
import { z } from 'zod'
import * as visitsService from '../services/visits.service'
import { error, success } from '../utils/response'

const visitSchema = z.object({
  contact_id: z.string().uuid(),
  property_id: z.string().uuid(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime().optional().nullable(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).default('scheduled'),
  notes: z.string().optional().nullable()
})

export const list: RequestHandler = async (req, res, next) => {
  try {
    return success(res, await visitsService.listVisits(req.db!))
  } catch (err) {
    return next(err)
  }
}

export const get: RequestHandler = async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const visit = await visitsService.getVisit(req.db!, id)
    return visit ? success(res, visit) : error(res, 'Visit not found', 404)
  } catch (err) {
    return next(err)
  }
}

export const create: RequestHandler = async (req, res, next) => {
  try {
    return success(res, await visitsService.createVisit(req.db!, visitSchema.parse(req.body)), 201)
  } catch (err) {
    return next(err)
  }
}

export const update: RequestHandler = async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const visit = await visitsService.updateVisit(
      req.db!,
      id,
      visitSchema.partial().parse(req.body)
    )
    return visit ? success(res, visit) : error(res, 'Visit not found', 404)
  } catch (err) {
    return next(err)
  }
}
