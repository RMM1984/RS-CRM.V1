import type { RequestHandler } from 'express'
import { z } from 'zod'
import * as authService from '../services/auth.service'
import { error, success } from '../utils/response'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

export const login: RequestHandler = async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body)
    const session = await authService.login(input.email, input.password)

    if (!session) {
      return error(res, 'Invalid credentials', 401)
    }

    return success(res, session)
  } catch (err) {
    return next(err)
  }
}
