import { Router } from 'express'
import * as adminController from '../controllers/admin.controller'
import { requireRole } from '../middleware/requireRole'

export const adminRoutes = Router()

adminRoutes.post('/tenants', requireRole('admin'), adminController.createTenant)
