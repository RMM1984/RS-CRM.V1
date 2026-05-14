import { Router } from 'express'
import * as aiController from '../controllers/ai.controller'
import { requirePremium } from '../middleware/requirePremium'

export const aiRoutes = Router()

aiRoutes.get('/requests', requirePremium, aiController.list)
aiRoutes.post('/requests', requirePremium, aiController.create)
