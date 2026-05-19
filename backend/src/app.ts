import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { pool } from './config/db'
import { env } from './config/env'
import { errorHandler } from './middleware/errorHandler'
import { apiRateLimit } from './middleware/rateLimit'
import { setSchema } from './middleware/setSchema'
import { verifyJWT } from './middleware/verifyJWT'
import { adminRoutes } from './routes/admin.routes'
import { aiRoutes } from './routes/ai.routes'
import { authRoutes } from './routes/auth.routes'
import { contactsRoutes } from './routes/contacts.routes'
import { dashboardRoutes } from './routes/dashboard.routes'
import { operationsRoutes } from './routes/operations.routes'
import { propertiesRoutes } from './routes/properties.routes'
import { shortlistRoutes } from './routes/shortlist.routes'
import { usersRoutes } from './routes/users.routes'
import { calendarRoutes, publicCalendarRoutes, visitsRoutes } from './routes/visits.routes'
import { buildCache } from './services/scrapers/crownProperty.scraper'

export const app = express()

app.set('trust proxy', 1)
app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'rs-crm-backend',
    version: 'health-db-diagnostics'
  })
})

app.get('/health/db', async (_req, res) => {
  if (!env.HEALTH_CHECK_TOKEN) {
    return res.status(404).json({ ok: false, error: { message: 'Not found' } })
  }

  const token = _req.header('x-health-token')
  if (token !== env.HEALTH_CHECK_TOKEN) {
    return res.status(403).json({ ok: false, error: { message: 'Forbidden' } })
  }

  try {
    const { rows } = await pool.query(`
      SELECT
        now() AS checked_at,
        (SELECT count(*)::int FROM public.tenants) AS tenants,
        (SELECT count(*)::int FROM public.users) AS users
    `)

    res.json({ ok: true, database: rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      ok: false,
      error: {
        message: 'Database health check failed',
        details: err instanceof Error ? err.message : String(err)
      }
    })
  }
})

app.use('/api/auth', authRoutes)
app.use('/api/calendar', publicCalendarRoutes)

app.use('/api', apiRateLimit)
app.use('/api', verifyJWT, setSchema)
app.use('/api/users', usersRoutes)
app.use('/api/contacts', contactsRoutes)
app.use('/api/properties', propertiesRoutes)
app.use('/api/shortlist', shortlistRoutes)
app.use('/api/operations', operationsRoutes)
app.use('/api/visits', visitsRoutes)
app.use('/api/calendar', calendarRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/admin', adminRoutes)

app.use(errorHandler)

buildCache().catch(console.error)
