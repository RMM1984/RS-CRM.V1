import type { RequestHandler } from 'express'
import { z } from 'zod'
import * as propertiesService from '../services/properties.service'
import { error, success } from '../utils/response'

const propertySchema = z.object({
  title: z.string().min(2),
  address: z.string().min(2),
  city: z.string().default('Madrid'),
  price: z.number().nonnegative(),
  status: z.enum(['draft', 'active', 'reserved', 'sold', 'rented']).default('draft'),
  property_type: z.string().default('apartment'),
  bedrooms: z.number().int().nonnegative().optional().nullable(),
  bathrooms: z.number().int().nonnegative().optional().nullable(),
  sqm: z.number().nonnegative().optional().nullable(),
  owner_contact_id: z.string().uuid().optional().nullable()
})

export const list: RequestHandler = async (req, res, next) => {
  try {
    return success(res, await propertiesService.listProperties(req.db!))
  } catch (err) {
    return next(err)
  }
}

export const get: RequestHandler = async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const property = await propertiesService.getProperty(req.db!, id)
    return property ? success(res, property) : error(res, 'Property not found', 404)
  } catch (err) {
    return next(err)
  }
}

export const create: RequestHandler = async (req, res, next) => {
  try {
    return success(res, await propertiesService.createProperty(req.db!, propertySchema.parse(req.body)), 201)
  } catch (err) {
    return next(err)
  }
}

export const update: RequestHandler = async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const property = await propertiesService.updateProperty(
      req.db!,
      id,
      propertySchema.partial().parse(req.body)
    )
    return property ? success(res, property) : error(res, 'Property not found', 404)
  } catch (err) {
    return next(err)
  }
}
