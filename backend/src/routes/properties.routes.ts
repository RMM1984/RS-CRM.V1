import { Router } from 'express'
import * as propertiesController from '../controllers/properties.controller'

export const propertiesRoutes = Router()

propertiesRoutes.get('/', propertiesController.list)
propertiesRoutes.get('/:id', propertiesController.get)
propertiesRoutes.post('/', propertiesController.create)
propertiesRoutes.patch('/:id', propertiesController.update)
