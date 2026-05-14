import type { RequestHandler } from 'express'
import { z } from 'zod'
import * as usersService from '../services/users.service'
import { success } from '../utils/response'

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(2),
  role: z.enum(['admin', 'agent'])
})

export const profile: RequestHandler = async (req, res, next) => {
  try {
    return success(res, await usersService.getProfile(req.db!, req.user!.id))
  } catch (err) {
    return next(err)
  }
}

export const list: RequestHandler = async (req, res, next) => {
  try {
    return success(res, await usersService.listTenantUsers(req.user!.tenant_id))
  } catch (err) {
    return next(err)
  }
}

export const create: RequestHandler = async (req, res, next) => {
  try {
    const input = createUserSchema.parse(req.body)
    return success(res, await usersService.createTenantUser(req.user!.tenant_id, input), 201)
  } catch (err) {
    return next(err)
  }
}
