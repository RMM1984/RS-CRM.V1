import { Router } from 'express'
import * as contactsController from '../controllers/contacts.controller'

export const contactsRoutes = Router()

contactsRoutes.get('/', contactsController.list)
contactsRoutes.get('/:id', contactsController.get)
contactsRoutes.post('/', contactsController.create)
contactsRoutes.patch('/:id', contactsController.update)
