import { Router } from 'express'
import * as contactsController from '../controllers/contacts.controller'

export const contactsRoutes = Router()

contactsRoutes.get('/', contactsController.list)
contactsRoutes.get('/:id', contactsController.get)
contactsRoutes.post('/', contactsController.create)
contactsRoutes.patch('/:id', contactsController.update)
contactsRoutes.put('/:id', contactsController.update)
contactsRoutes.delete('/:id', contactsController.remove)
contactsRoutes.post('/:id/interactions', contactsController.addInteraction)
contactsRoutes.get('/:id/interactions', contactsController.listInteractions)
