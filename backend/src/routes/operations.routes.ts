import { Router } from 'express'
import * as operationsController from '../controllers/operations.controller'

export const operationsRoutes = Router()

operationsRoutes.get('/kanban', operationsController.kanban)
operationsRoutes.get('/', operationsController.list)
operationsRoutes.get('/:id', operationsController.get)
operationsRoutes.post('/', operationsController.create)
operationsRoutes.put('/:id', operationsController.update)
operationsRoutes.patch('/:id', operationsController.update)
operationsRoutes.delete('/:id', operationsController.remove)
