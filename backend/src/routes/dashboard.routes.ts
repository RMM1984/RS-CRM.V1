import { Router } from 'express'
import * as dashboardController from '../controllers/dashboard.controller'

export const dashboardRoutes = Router()

dashboardRoutes.get('/', dashboardController.summary)
