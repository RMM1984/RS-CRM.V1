import type { RequestHandler } from 'express'
import { z } from 'zod'
import * as propertiesService from '../services/properties.service'
import { getCrownCacheStatus } from '../services/scrapers/crownProperty.scraper'

const idSchema = z.string().uuid()

const listQuerySchema = z.object({
  type: z.string().trim().optional(),
  operation: z.enum(['sale', 'rent']).optional(),
  status: z.enum(['draft', 'active', 'available', 'reserved', 'sold', 'rented', 'archived']).optional(),
  city: z.string().trim().optional(),
  source: z.enum(['internal', 'kyero', 'sooprema', 'crown_property', 'other', 'all']).optional(),
  search: z.string().trim().optional(),
  price_min: z.coerce.number().nonnegative().optional(),
  price_max: z.coerce.number().nonnegative().optional(),
  rooms_min: z.coerce.number().int().nonnegative().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
})

const propertySchema = z.object({
  title: z.string().trim().min(2),
  address: z.string().trim().min(2),
  city: z.string().trim().min(2),
  zip: z.string().trim().optional().nullable(),
  type: z.string().trim().min(2),
  operation: z.enum(['sale', 'rent']),
  price: z.coerce.number().nonnegative(),
  surface_m2: z.coerce.number().nonnegative().optional().nullable(),
  rooms: z.coerce.number().int().nonnegative().optional().nullable(),
  bathrooms: z.coerce.number().int().nonnegative().optional().nullable(),
  status: z.enum(['draft', 'active', 'available', 'reserved', 'sold', 'rented']).default('active'),
  description: z.string().trim().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable()
})

const searchSchema = z.object({
  query: z.string().trim().min(2),
  type: z.string().trim().optional().nullable()
})

const sendSuccess = <T>(res: Parameters<RequestHandler>[1], data: T, status = 200) =>
  res.status(status).json({ success: true, data })

const sendError = (res: Parameters<RequestHandler>[1], message: string, status = 400) =>
  res.status(status).json({ success: false, error: { message } })

export const list: RequestHandler = async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query)
    return sendSuccess(res, await propertiesService.listProperties(req.db!, query))
  } catch (err) {
    return next(err)
  }
}

export const get: RequestHandler = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const property = await propertiesService.getProperty(req.db!, id)
    return property ? sendSuccess(res, property) : sendError(res, 'Propiedad no encontrada', 404)
  } catch (err) {
    return next(err)
  }
}

export const create: RequestHandler = async (req, res, next) => {
  try {
    return sendSuccess(
      res,
      await propertiesService.createProperty(req.db!, propertySchema.parse(req.body), req.user!),
      201
    )
  } catch (err) {
    return next(err)
  }
}

export const update: RequestHandler = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const property = await propertiesService.updateProperty(req.db!, id, propertySchema.partial().parse(req.body))

    if (!property) {
      return sendError(res, 'Propiedad no encontrada', 404)
    }

    if ('forbidden' in property) {
      return sendError(res, 'Solo se pueden editar propiedades exclusivas internas', 403)
    }

    return sendSuccess(res, property)
  } catch (err) {
    return next(err)
  }
}

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const property = await propertiesService.deleteProperty(req.db!, id)

    if (!property) {
      return sendError(res, 'Propiedad no encontrada', 404)
    }

    if ('forbidden' in property) {
      return sendError(res, 'Solo se pueden archivar propiedades exclusivas internas', 403)
    }

    return sendSuccess(res, property)
  } catch (err) {
    return next(err)
  }
}

export const search: RequestHandler = async (req, res, next) => {
  try {
    const body = searchSchema.parse(req.body)
    return sendSuccess(res, await propertiesService.searchProperties(req.db!, body.query, { type: body.type }))
  } catch (err) {
    return next(err)
  }
}

export const cacheStatus: RequestHandler = (_req, res) => {
  res.json(getCrownCacheStatus())
}

export const addImage: RequestHandler = async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    return sendSuccess(res, await propertiesService.addPropertyImage(req.db!, id, req.file, req.user!), 201)
  } catch (err) {
    return next(err)
  }
}

export const removeImage: RequestHandler = async (req, res, next) => {
  try {
    const imageId = idSchema.parse(req.params.imageId)
    const image = await propertiesService.deletePropertyImage(req.db!, imageId)
    return image ? sendSuccess(res, image) : sendError(res, 'Imagen no encontrada', 404)
  } catch (err) {
    return next(err)
  }
}
