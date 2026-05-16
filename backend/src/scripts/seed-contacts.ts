import 'dotenv/config'
import { Pool } from 'pg'

const CONTACTS = [
  {
    name: 'Carlos Martínez López',
    email: 'carlos.martinez@gmail.com',
    phone: '+34 666 123 456',
    type: 'comprador',
    source: 'referral',
    status: 'activo',
    notes:
      'Busca villa con piscina en zona Montgó, presupuesto entre 800k y 1.2M. Viene de Madrid, quiere mudarse a Jávea definitivamente. Tiene hipoteca preaprobada. Puede visitar fines de semana.'
  },
  {
    name: 'James Wellington',
    email: 'j.wellington@outlook.co.uk',
    phone: '+44 7700 900123',
    type: 'comprador',
    source: 'portal',
    status: 'activo',
    notes:
      'Retired couple looking for a 3-bedroom apartment near the beach, max 400k. Cash buyer, no mortgage needed. Interested in Arenal and Puerto areas. Speaks no Spanish, needs English-speaking agent.'
  },
  {
    name: 'Michael Thompson',
    email: 'mthompson@gmail.com',
    phone: '+1 310 555 0147',
    type: 'comprador',
    source: 'web',
    status: 'activo',
    notes:
      'Looking for investment property, budget up to 600k. Interested in rental yield potential. Prefers modern apartments or townhouses. Currently based in Los Angeles, planning to visit in June 2026.'
  },
  {
    name: 'Hans-Peter Müller',
    email: 'hpmuller@web.de',
    phone: '+49 89 12345678',
    type: 'comprador',
    source: 'referral',
    status: 'activo',
    notes:
      'Sucht Villa oder Chalet mit Meerblick, Budget bis 1.5 Millionen Euro. Interessiert an Balcón al Mar und Cap Martí. Hat bereits zwei Immobilien in Deutschland. Möchte im Juli 2026 besichtigen. Spricht kein Spanisch aber gutes Englisch.'
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
    await client.query('SET search_path TO tenant_rs_crm, public')
    const admin = await client.query(
      `SELECT u.id
       FROM public.users u
       JOIN public.tenants t ON t.id = u.tenant_id
       WHERE t.slug = 'rs-crm' AND u.role = 'admin'
       ORDER BY u.created_at
       LIMIT 1`
    )
    const assignedTo = admin.rows[0]?.id
    if (!assignedTo) throw new Error('No admin found for tenant rs-crm')

    let inserted = 0
    for (const contact of CONTACTS) {
      const exists = await client.query('SELECT id FROM contacts WHERE email = $1 LIMIT 1', [contact.email])
      if (exists.rows[0]) continue

      await client.query(
        `INSERT INTO contacts (full_name, email, phone, type, source, status, notes, assigned_to, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
        [
          contact.name,
          contact.email,
          contact.phone,
          contact.type,
          contact.source,
          contact.status,
          contact.notes,
          assignedTo
        ]
      )
      inserted += 1
    }

    console.log(`✅ ${inserted} contactos de prueba insertados`)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
