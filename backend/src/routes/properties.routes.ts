import { Router } from 'express'
import multer from 'multer'
import * as propertiesController from '../controllers/properties.controller'

export const propertiesRoutes = Router()
const upload = multer({ storage: multer.memoryStorage() })

propertiesRoutes.get('/', propertiesController.list)
propertiesRoutes.post('/', propertiesController.create)
propertiesRoutes.post('/search', propertiesController.search)
propertiesRoutes.get('/cache-status', propertiesController.cacheStatus)
propertiesRoutes.get('/:id', propertiesController.get)
propertiesRoutes.put('/:id', propertiesController.update)
propertiesRoutes.patch('/:id', propertiesController.update)
propertiesRoutes.delete('/:id', propertiesController.remove)
propertiesRoutes.post('/:id/images', upload.single('file'), propertiesController.addImage)
propertiesRoutes.delete('/:id/images/:imageId', propertiesController.removeImage)
