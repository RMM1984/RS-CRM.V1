import { Router } from 'express'
import * as shortlistController from '../controllers/shortlist.controller'

export const shortlistRoutes = Router()

shortlistRoutes.get('/', shortlistController.list)
shortlistRoutes.post('/', shortlistController.create)
shortlistRoutes.put('/:id', shortlistController.update)
shortlistRoutes.patch('/:id', shortlistController.update)
shortlistRoutes.delete('/:id', shortlistController.remove)
