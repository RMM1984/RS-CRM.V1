import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'

const USERS = [
  {
    email: 'ana.garcia@rscrm.com',
    full_name: 'Ana García Martínez',
    role: 'agent'
  },
  {
    email: 'sarah.jones@rscrm.com',
    full_name: 'Sarah Jones',
    role: 'agent'
  },
  {
    email: 'thomas.mueller@rscrm.com',
    full_name: 'Thomas Müller',
    role: 'agent'
  },
  {
    email: 'lisa.vandenberg@rscrm.com',
    full_name: 'Lisa van den Berg',
    role: 'agent'
  }
]

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  })
  const client = await pool.connect()

  try {
    const tenant = await client.query(`SELECT id FROM public.tenants WHERE slug = 'rs-crm' LIMIT 1`)
    const tenantId = tenant.rows[0]?.id
    if (!tenantId) throw new Error('Tenant rs-crm not found')

    const passwordHash = await bcrypt.hash('Test1234!', 10)
    let inserted = 0

    for (const user of USERS) {
      const exists = await client.query('SELECT id FROM public.users WHERE email = $1 LIMIT 1', [user.email])
      if (exists.rows[0]) {
        await client.query(
          'UPDATE public.users SET full_name = $2, role = $3, updated_at = now() WHERE email = $1',
          [user.email, user.full_name, user.role]
        )
        continue
      }

      await client.query(
        `INSERT INTO public.users (tenant_id, email, password_hash, full_name, role)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, user.email, passwordHash, user.full_name, user.role]
      )
      inserted += 1
    }

    console.log(`OK ${inserted} usuarios agentes insertados`)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
