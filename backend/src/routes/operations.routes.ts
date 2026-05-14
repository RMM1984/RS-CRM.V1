import { Router } from 'express'
import * as operationsController from '../controllers/operations.controller'

export const operationsRoutes = Router()

operationsRoutes.get('/', operationsController.list)
operationsRoutes.get('/:id', operationsController.get)
operationsRoutes.post('/', operationsController.create)
operationsRoutes.patch('/:id', operationsController.update)
