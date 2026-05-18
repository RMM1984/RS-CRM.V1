import { Router } from 'express'
import * as visitsController from '../controllers/visits.controller'

export const visitsRoutes = Router()
export const publicCalendarRoutes = Router()
export const calendarRoutes = Router()

publicCalendarRoutes.get('/:agentToken.ics', visitsController.publicIcs)
calendarRoutes.get('/my-url', visitsController.myCalendarUrl)
visitsRoutes.get('/', visitsController.list)
visitsRoutes.get('/calendar', visitsController.calendar)
visitsRoutes.get('/:id', visitsController.get)
visitsRoutes.post('/', visitsController.create)
visitsRoutes.put('/:id', visitsController.update)
visitsRoutes.patch('/:id', visitsController.update)
visitsRoutes.delete('/:id', visitsController.remove)
