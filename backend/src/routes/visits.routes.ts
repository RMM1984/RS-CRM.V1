import { Router } from 'express'
import * as visitsController from '../controllers/visits.controller'

export const visitsRoutes = Router()

visitsRoutes.get('/', visitsController.list)
visitsRoutes.get('/:id', visitsController.get)
visitsRoutes.post('/', visitsController.create)
visitsRoutes.patch('/:id', visitsController.update)
