import type { RequestHandler } from 'express'
import { z } from 'zod'
import * as adminService from '../services/admin.service'
import { getEgoStatus } from '../services/ego/egoRealEstate.service'
import { success } from '../utils/response'

const tenantSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  plan: z.enum(['standard', 'premium']).default('standard')
})

export const createTenant: RequestHandler = async (req, res, next) => {
  try {
    const input = tenantSchema.parse(req.body)
    return success(res, await adminService.createTenant(input.name, input.slug, input.plan), 201)
  } catch (err) {
    return next(err)
  }
}

export const egoStatus: RequestHandler = async (_req, res, next) => {
  try {
    return success(res, await getEgoStatus())
  } catch (err) {
    return next(err)
  }
}
