import { Router } from 'express'
import * as authController from '../controllers/auth.controller'
import { loginRateLimit } from '../middleware/rateLimit'

export const authRoutes = Router()

authRoutes.post('/login', loginRateLimit, authController.login)
