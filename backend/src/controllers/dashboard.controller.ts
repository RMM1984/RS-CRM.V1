import type { RequestHandler } from 'express'
import * as dashboardService from '../services/dashboard.service'
import { success } from '../utils/response'

export const summary: RequestHandler = async (req, res, next) => {
  try {
    return success(res, await dashboardService.getDashboard(req.db!))
  } catch (err) {
    return next(err)
  }
}
