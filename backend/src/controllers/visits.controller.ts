import type { RequestHandler } from 'express'
import { z } from 'zod'
import * as visitsService from '../services/visits.service'

const idSchema = z.string().uuid()
const statusSchema = z.enum(['scheduled', 'done', 'cancelled', 'no_show'])

const listQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  agent_id: z.string().uuid().optional(),
  status: statusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50)
})

const visitSchema = z.object({
  title: z.string().trim().min(1).optional().nullable(),
  scheduled_at: z.string().datetime(),
  duration_min: z.coerce.number().int().min(15).max(480).optional().nullable(),
  location: z.string().trim().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  property_id: z.string().uuid().optional().nullable(),
  operation_id: z.string().uuid().optional().nullable(),
  status: statusSchema.optional(),
  notes: z.string().trim().optional().nullable()
})

const calendarQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  week_start: z.string().optional()
})

const sendSuccess = <T>(res: Parameters<RequestHandler>[1], data: T, status = 200) =>
  res.status(status).json({ success: true, data })

const sendError = (res: Parameters<RequestHandler>[1], message: string, status = 404) =>
  res.status(status).json({ success: false, error: { message } })

const getCalendarRange = (query: z.infer<typeof calendarQuerySchema>) => {
  if (query.week_start) {
    const start = new Date(`${query.week_start}T00:00:00.000Z`)
    const end = new Date(start)
    end.setUTCDate(start.getUTCDate() + 7)
    return { from: start.toISOString(), to: end.toISOString() }
  }

  const now = new Date()
  const year = query.year ?? now.getUTCFullYear()
  const month = query.month ?? now.getUTCMonth() + 1
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))

  return { from: start.toISOString(), to: end.toISOString() }
}

export const list: RequestHandler = async (req, res, next) => {
  try {
    const filters = listQuerySchema.parse(req.query)
    const data = await visitsService.listVisits(req.db!, filters, req.user!)

    return sendSuccess(res, data)
  } catch (err) {
    return next(err)
  }
}

export const calendar: RequestHandler = async (req, res, next) => {
  try {
    const range = getCalendarRange(calendarQuerySchema.parse(req.query))
    const data = await visitsService.getCalendarVisits(req.db!, range, req.user!)

    return sendSuccess(res, data)
  } catch (err) {
    return next(err)
  }
}

export const get: RequestHandler = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const visit = await visitsService.getVisit(req.db!, id, req.user!)

    return visit ? sendSuccess(res, visit) : sendError(res, 'Visita no encontrada')
  } catch (err) {
    return next(err)
  }
}

export const create: RequestHandler = async (req, res, next) => {
  try {
    const body = visitSchema.parse(req.body)
    const visit = await visitsService.createVisit(req.db!, body, req.user!)

    return sendSuccess(res, visit, 201)
  } catch (err) {
    return next(err)
  }
}

export const update: RequestHandler = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const body = visitSchema.partial().parse(req.body)
    const visit = await visitsService.updateVisit(req.db!, id, body, req.user!)

    return visit ? sendSuccess(res, visit) : sendError(res, 'Visita no encontrada')
  } catch (err) {
    return next(err)
  }
}

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const visit = await visitsService.cancelVisit(req.db!, id, req.user!)

    return visit ? sendSuccess(res, visit) : sendError(res, 'Visita no encontrada')
  } catch (err) {
    return next(err)
  }
}

export const myCalendarUrl: RequestHandler = async (req, res, next) => {
  try {
    const token = await visitsService.getOrCreateCalendarToken(req.user!)
    const baseUrl = `${req.protocol}://${req.get('host')}`

    return sendSuccess(res, {
      url: `${baseUrl}/api/calendar/${token}.ics`,
      instructions: {
        google: 'En Google Calendar > Otros calendarios > Suscribirse con URL',
        apple: 'En Calendario > Archivo > Nueva suscripcion a calendario',
        outlook: 'Configuracion > Calendario > Calendarios compartidos > Suscribir'
      }
    })
  } catch (err) {
    return next(err)
  }
}

export const publicIcs: RequestHandler = async (req, res, next) => {
  try {
    const token = z.string().min(20).parse(req.params.agentToken)
    const ics = await visitsService.buildIcsForToken(token)

    if (!ics) {
      return sendError(res, 'Calendario no encontrado', 404)
    }

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', 'inline; filename="rs-crm-calendar.ics"')
    return res.status(200).send(ics)
  } catch (err) {
    return next(err)
  }
}
