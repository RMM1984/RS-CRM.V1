import type { RequestHandler } from 'express'
import { z } from 'zod'
import * as contactsService from '../services/contacts.service'

const contactTypeSchema = z.enum(['comprador', 'vendedor', 'inquilino', 'propietario', 'ambos'])
const contactStatusSchema = z.enum(['activo', 'frio', 'cerrado'])
const contactSourceSchema = z.enum(['web', 'referral', 'portal', 'manual'])
const interactionTypeSchema = z.enum(['call', 'email', 'note', 'whatsapp', 'visit'])
const clientProfileSchema = z.enum([
  'investor_yield',
  'investor_flip',
  'first_home',
  'second_home',
  'foreign',
  'digital_nomad',
  'luxury_standard',
  'luxury_premium'
])

const listQuerySchema = z.object({
  type: contactTypeSchema.optional(),
  status: contactStatusSchema.optional(),
  assigned_to: z.string().uuid().optional(),
  has_profile: z.coerce.boolean().optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
})

const createContactSchema = z.object({
  name: z.string().trim().min(2),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  type: contactTypeSchema,
  source: contactSourceSchema.optional().nullable(),
  status: contactStatusSchema.default('activo'),
  notes: z.string().trim().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  client_profile: clientProfileSchema.optional().nullable(),
  budget_min: z.coerce.number().nonnegative().optional().nullable(),
  budget_max: z.coerce.number().nonnegative().optional().nullable(),
  rooms_min: z.coerce.number().int().nonnegative().optional().nullable(),
  bathrooms_min: z.coerce.number().int().nonnegative().optional().nullable(),
  surface_min: z.coerce.number().int().nonnegative().optional().nullable(),
  price_per_m2_max: z.coerce.number().nonnegative().optional().nullable(),
  needs_renovation: z.boolean().optional().nullable(),
  needs_pool: z.boolean().optional().nullable(),
  needs_sea_view: z.boolean().optional().nullable(),
  needs_garden: z.boolean().optional().nullable(),
  needs_parking: z.boolean().optional().nullable(),
  needs_terrace: z.boolean().optional().nullable(),
  preferred_zones: z.array(z.string().trim().min(1)).optional().nullable(),
  languages: z.array(z.string().trim().min(1)).optional().nullable(),
  requirements_text: z.string().trim().optional().nullable()
})

const updateContactSchema = createContactSchema.partial()

const interactionSchema = z.object({
  type: interactionTypeSchema,
  content: z.string().trim().min(1)
})

const idSchema = z.string().uuid()

const sendSuccess = <T>(res: Parameters<RequestHandler>[1], data: T, status = 200) =>
  res.status(status).json({ success: true, data })

const sendError = (res: Parameters<RequestHandler>[1], message: string, status = 404) =>
  res.status(status).json({ success: false, error: { message } })

export const list: RequestHandler = async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query)
    const data = await contactsService.listContacts(req.db!, query, req.user!)

    return sendSuccess(res, data)
  } catch (err) {
    return next(err)
  }
}

export const get: RequestHandler = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const contact = await contactsService.getContact(req.db!, id, req.user!)

    return contact ? sendSuccess(res, contact) : sendError(res, 'Contacto no encontrado')
  } catch (err) {
    return next(err)
  }
}

export const create: RequestHandler = async (req, res, next) => {
  try {
    const body = createContactSchema.parse(req.body)
    const contact = await contactsService.createContact(req.db!, body, req.user!)

    return sendSuccess(res, contact, 201)
  } catch (err) {
    return next(err)
  }
}

export const update: RequestHandler = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const body = updateContactSchema.parse(req.body)
    const contact = await contactsService.updateContact(req.db!, id, body, req.user!)

    return contact ? sendSuccess(res, contact) : sendError(res, 'Contacto no encontrado')
  } catch (err) {
    return next(err)
  }
}

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const contact = await contactsService.deleteContact(req.db!, id, req.user!)

    return contact ? sendSuccess(res, contact) : sendError(res, 'Contacto no encontrado')
  } catch (err) {
    return next(err)
  }
}

export const addInteraction: RequestHandler = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const body = interactionSchema.parse(req.body)
    const interaction = await contactsService.addInteraction(req.db!, id, body, req.user!)

    return interaction
      ? sendSuccess(res, interaction, 201)
      : sendError(res, 'Contacto no encontrado')
  } catch (err) {
    return next(err)
  }
}

export const listInteractions: RequestHandler = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const interactions = await contactsService.listInteractions(req.db!, id, req.user!)

    return sendSuccess(res, { interactions })
  } catch (err) {
    return next(err)
  }
}
