import type { RequestHandler } from 'express'
import { z } from 'zod'
import * as contactsService from '../services/contacts.service'
import { error, success } from '../utils/response'

const contactSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  type: z.enum(['buyer', 'seller', 'landlord', 'tenant', 'investor']).default('buyer'),
  stage: z.string().default('new'),
  source: z.string().optional().nullable(),
  budget_min: z.number().optional().nullable(),
  budget_max: z.number().optional().nullable(),
  notes: z.string().optional().nullable()
})

export const list: RequestHandler = async (req, res, next) => {
  try {
    return success(res, await contactsService.listContacts(req.db!))
  } catch (err) {
    return next(err)
  }
}

export const get: RequestHandler = async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const contact = await contactsService.getContact(req.db!, id)
    return contact ? success(res, contact) : error(res, 'Contact not found', 404)
  } catch (err) {
    return next(err)
  }
}

export const create: RequestHandler = async (req, res, next) => {
  try {
    return success(res, await contactsService.createContact(req.db!, contactSchema.parse(req.body)), 201)
  } catch (err) {
    return next(err)
  }
}

export const update: RequestHandler = async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const contact = await contactsService.updateContact(
      req.db!,
      id,
      contactSchema.partial().parse(req.body)
    )
    return contact ? success(res, contact) : error(res, 'Contact not found', 404)
  } catch (err) {
    return next(err)
  }
}
