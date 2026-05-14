import type { RequestHandler } from 'express'
import { z } from 'zod'
import * as aiService from '../services/ai.service'
import { success } from '../utils/response'

const aiRequestSchema = z.object({
  feature: z.string().min(2),
  prompt: z.string().min(2),
  result: z.record(z.string(), z.unknown()).optional().default({})
})

export const list: RequestHandler = async (req, res, next) => {
  try {
    return success(res, await aiService.listAiRequests(req.db!))
  } catch (err) {
    return next(err)
  }
}

export const create: RequestHandler = async (req, res, next) => {
  try {
    const input = aiRequestSchema.parse(req.body)
    return success(
      res,
      await aiService.createAiRequest(req.db!, {
        ...input,
        created_by: req.user!.id
      }),
      201
    )
  } catch (err) {
    return next(err)
  }
}
