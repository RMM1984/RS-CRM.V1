import { Router } from 'express'
import * as usersController from '../controllers/users.controller'
import { requireRole } from '../middleware/requireRole'

export const usersRoutes = Router()

usersRoutes.get('/me', usersController.profile)
usersRoutes.get('/', requireRole('admin'), usersController.list)
usersRoutes.post('/', requireRole('admin'), usersController.create)
