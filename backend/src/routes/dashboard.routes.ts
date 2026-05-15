import { Router } from 'express'
import * as dashboardController from '../controllers/dashboard.controller'

export const dashboardRoutes = Router()

dashboardRoutes.get('/summary', dashboardController.summary)
dashboardRoutes.get('/', dashboardController.summary)
