import 'dotenv/config'
import { Pool } from 'pg'

type SeedVisit = {
  email: string
  title: string
  offsetDays: number
  hour: number
  minute: number
  duration: number
  location: string
  status: 'scheduled' | 'done' | 'cancelled' | 'no_show'
  notes?: string
}

const visits: SeedVisit[] = [
  {
    email: 'j.wellington@outlook.co.uk',
    title: 'Visita - James Wellington',
    offsetDays: 1,
    hour: 10,
    minute: 0,
    duration: 60,
    location: 'Arenal, Jávea',
    status: 'scheduled'
  },
  {
    email: 'pedroluciajavea@gmail.com',
    title: 'Visita - Pedro y Lucía',
    offsetDays: 2,
    hour: 11,
    minute: 30,
    duration: 45,
    location: 'Pueblo, Jávea',
    status: 'scheduled'
  },
  {
    email: 'hpmuller@web.de',
    title: 'Visita realizada - Hans-Peter Müller',
    offsetDays: -1,
    hour: 17,
    minute: 0,
    duration: 90,
    location: 'Balcón al Mar, Jávea',
    status: 'done',
    notes: 'Visita realizada. Cliente muy interesado. Pendiente segunda visita con su esposa la próxima semana.'
  },
  {
    email: 'inge.devries@gmail.com',
    title: 'Visita realizada - Inge de Vries',
    offsetDays: -3,
    hour: 12,
    minute: 0,
    duration: 60,
    location: 'Puerto, Jávea',
    status: 'done'
  },
  {
    email: 'f.lecomte@luxe-invest.fr',
    title: 'Tour premium - François Lecomte',
    offsetDays: 7,
    hour: 10,
    minute: 30,
    duration: 120,
    location: 'Balcón al Mar, Jávea',
    status: 'scheduled',
    notes: 'Tour completo de 3 villas premium en Balcón al Mar'
  },
  {
    email: 'sophie.dubois@hotmail.be',
    title: 'Visita no asistida - Sophie Dubois',
    offsetDays: -5,
    hour: 16,
    minute: 30,
    duration: 30,
    location: 'Arenal, Jávea',
    status: 'no_show',
    notes: 'Cliente no se presentó. Reagendar la próxima semana.'
  }
]

const scheduledAt = (visit: SeedVisit) => {
  const date = new Date()
  date.setDate(date.getDate() + visit.offsetDays)
  date.setHours(visit.hour, visit.minute, 0, 0)
  return date
}

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  })
  const client = await pool.connect()

  try {
    await client.query(`
      ALTER TABLE tenant_rs_crm.visits ADD COLUMN IF NOT EXISTS title TEXT;
      ALTER TABLE tenant_rs_crm.visits ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
      UPDATE tenant_rs_crm.visits SET scheduled_at = COALESCE(scheduled_at, starts_at, now()) WHERE scheduled_at IS NULL;
      ALTER TABLE tenant_rs_crm.visits ALTER COLUMN scheduled_at SET NOT NULL;
      ALTER TABLE tenant_rs_crm.visits ADD COLUMN IF NOT EXISTS duration_min INTEGER DEFAULT 60;
      ALTER TABLE tenant_rs_crm.visits ADD COLUMN IF NOT EXISTS location TEXT;
      ALTER TABLE tenant_rs_crm.visits ADD COLUMN IF NOT EXISTS operation_id UUID REFERENCES tenant_rs_crm.operations(id);
      ALTER TABLE tenant_rs_crm.visits ADD COLUMN IF NOT EXISTS agent_id UUID;
      ALTER TABLE tenant_rs_crm.visits ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;
      ALTER TABLE tenant_rs_crm.visits ADD COLUMN IF NOT EXISTS ical_uid TEXT;
      ALTER TABLE tenant_rs_crm.visits DROP CONSTRAINT IF EXISTS visits_status_check;
      UPDATE tenant_rs_crm.visits SET status = 'done' WHERE status = 'completed';
      ALTER TABLE tenant_rs_crm.visits ADD CONSTRAINT visits_status_check CHECK (status IN ('scheduled','done','cancelled','no_show'));
      ALTER TABLE tenant_rs_crm.visits ALTER COLUMN contact_id DROP NOT NULL;
      ALTER TABLE tenant_rs_crm.visits ALTER COLUMN property_id DROP NOT NULL;
      ALTER TABLE tenant_rs_crm.visits ALTER COLUMN starts_at DROP NOT NULL;
    `)

    const admin = await client.query(
      `SELECT u.id
       FROM public.users u
       JOIN public.tenants t ON t.id = u.tenant_id
       WHERE t.slug = 'rs-crm' AND u.role = 'admin'
       ORDER BY u.created_at
       LIMIT 1`
    )
    const agentId = admin.rows[0]?.id
    if (!agentId) throw new Error('No admin found for tenant rs-crm')

    let inserted = 0
    for (const visit of visits) {
      const contact = await client.query<{ id: string }>(
        'SELECT id FROM tenant_rs_crm.contacts WHERE email = $1 LIMIT 1',
        [visit.email]
      )
      const contactId = contact.rows[0]?.id
      if (!contactId) continue

      const operation = await client.query<{ id: string; property_id: string | null }>(
        `SELECT id, property_id
         FROM tenant_rs_crm.operations
         WHERE contact_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [contactId]
      )

      const exists = await client.query(
        `SELECT id
         FROM tenant_rs_crm.visits
         WHERE contact_id = $1 AND title = $2
         LIMIT 1`,
        [contactId, visit.title]
      )
      if (exists.rows[0]) continue

      const result = await client.query<{ id: string }>(
        `INSERT INTO tenant_rs_crm.visits (
          title, scheduled_at, duration_min, location, contact_id,
          property_id, operation_id, agent_id, status, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id`,
        [
          visit.title,
          scheduledAt(visit).toISOString(),
          visit.duration,
          visit.location,
          contactId,
          operation.rows[0]?.property_id ?? null,
          operation.rows[0]?.id ?? null,
          agentId,
          visit.status,
          visit.notes ?? null
        ]
      )

      await client.query(
        "UPDATE tenant_rs_crm.visits SET ical_uid = id::text || '@skopi.app' WHERE id = $1",
        [result.rows[0].id]
      )
      inserted += 1
    }

    console.log(`OK ${inserted} visitas de prueba insertadas`)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
