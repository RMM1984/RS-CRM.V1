import 'dotenv/config'
import { Pool } from 'pg'

type ContactSeed = {
  name: string
  email: string
  phone: string
  type: 'comprador'
  source: 'web' | 'referral' | 'portal' | 'manual'
  status: 'activo'
  notes?: string
  client_profile: string
  budget_min?: number
  budget_max?: number
  rooms_min?: number
  bathrooms_min?: number
  surface_min?: number
  price_per_m2_max?: number
  needs_renovation?: boolean
  needs_pool?: boolean
  needs_sea_view?: boolean
  needs_garden?: boolean
  needs_parking?: boolean
  preferred_zones?: string[]
  languages?: string[]
  requirements_text: string
}

const ensureProfileColumnsSql = `
ALTER TABLE tenant_rs_crm.contacts
ADD COLUMN IF NOT EXISTS client_profile TEXT
  CHECK (client_profile IN (
    'investor_yield',
    'investor_flip',
    'first_home',
    'second_home',
    'foreign',
    'digital_nomad',
    'luxury_standard',
    'luxury_premium'
  )),
ADD COLUMN IF NOT EXISTS budget_min NUMERIC,
ADD COLUMN IF NOT EXISTS budget_max NUMERIC,
ADD COLUMN IF NOT EXISTS rooms_min INTEGER,
ADD COLUMN IF NOT EXISTS bathrooms_min INTEGER,
ADD COLUMN IF NOT EXISTS surface_min INTEGER,
ADD COLUMN IF NOT EXISTS price_per_m2_max NUMERIC,
ADD COLUMN IF NOT EXISTS needs_renovation BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS needs_pool BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS needs_sea_view BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS needs_garden BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS needs_parking BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS preferred_zones TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS requirements_text TEXT;
`

const CONTACTS: ContactSeed[] = [
  {
    name: 'Carlos Martínez López',
    email: 'carlos.martinez@gmail.com',
    phone: '+34 666 123 456',
    type: 'comprador',
    source: 'referral',
    status: 'activo',
    client_profile: 'luxury_standard',
    budget_min: 800000,
    budget_max: 1200000,
    rooms_min: 3,
    surface_min: 200,
    needs_pool: true,
    needs_sea_view: true,
    preferred_zones: ['Montgó', 'Balcón al Mar'],
    languages: ['es'],
    requirements_text: 'Villa con piscina zona Montgó, presupuesto 800k-1.2M, mudanza definitiva'
  },
  {
    name: 'James Wellington',
    email: 'j.wellington@outlook.co.uk',
    phone: '+44 7700 900123',
    type: 'comprador',
    source: 'portal',
    status: 'activo',
    client_profile: 'second_home',
    budget_min: 300000,
    budget_max: 400000,
    rooms_min: 3,
    needs_pool: true,
    preferred_zones: ['Arenal', 'Puerto'],
    languages: ['en'],
    requirements_text: '3-bed apartment near beach, cash buyer, max 400k, Arenal or Puerto area'
  },
  {
    name: 'Michael Thompson',
    email: 'mthompson@gmail.com',
    phone: '+1 310 555 0147',
    type: 'comprador',
    source: 'web',
    status: 'activo',
    client_profile: 'investor_yield',
    budget_min: 400000,
    budget_max: 600000,
    price_per_m2_max: 3500,
    needs_renovation: true,
    languages: ['en'],
    requirements_text: 'Investment property, rental yield focus, modern apartments or townhouses'
  },
  {
    name: 'Hans-Peter Müller',
    email: 'hpmuller@web.de',
    phone: '+49 89 12345678',
    type: 'comprador',
    source: 'referral',
    status: 'activo',
    client_profile: 'luxury_premium',
    budget_min: 1200000,
    budget_max: 1500000,
    rooms_min: 4,
    needs_sea_view: true,
    needs_pool: true,
    needs_garden: true,
    preferred_zones: ['Balcón al Mar', 'Cap Martí'],
    languages: ['de', 'en'],
    requirements_text: 'Villa oder Chalet Meerblick, bis 1.5M, Balcón al Mar oder Cap Martí'
  },
  {
    name: 'Inge de Vries',
    email: 'inge.devries@gmail.com',
    phone: '+31 6 12345678',
    type: 'comprador',
    source: 'referral',
    status: 'activo',
    client_profile: 'foreign',
    budget_min: 500000,
    budget_max: 800000,
    rooms_min: 3,
    needs_pool: true,
    needs_sea_view: true,
    preferred_zones: ['Arenal', 'Montgó', 'Puerto'],
    languages: ['nl', 'en'],
    requirements_text: 'Mooi huis met zeezicht en zwembad, budget 500-800k, wil zo snel mogelijk kopen'
  },
  {
    name: 'Pedro y Lucía Fernández',
    email: 'pedroluciajavea@gmail.com',
    phone: '+34 677 234 567',
    type: 'comprador',
    source: 'web',
    status: 'activo',
    client_profile: 'first_home',
    budget_min: 200000,
    budget_max: 320000,
    rooms_min: 2,
    bathrooms_min: 1,
    needs_parking: true,
    preferred_zones: ['Pueblo', 'Centro'],
    languages: ['es'],
    requirements_text: 'Primera vivienda, máximo 320k, 2-3 hab, necesitamos parking, zona pueblo o centro'
  },
  {
    name: 'Roberto Bianchi',
    email: 'r.bianchi@investit.com',
    phone: '+39 335 1234567',
    type: 'comprador',
    source: 'referral',
    status: 'activo',
    client_profile: 'investor_flip',
    budget_min: 150000,
    budget_max: 350000,
    needs_renovation: true,
    price_per_m2_max: 2000,
    preferred_zones: ['Pueblo', 'Centro', 'Arenal'],
    languages: ['en', 'it'],
    requirements_text: 'Looking for properties to renovate and resell, max 350k, needs work, good location for resale value'
  },
  {
    name: 'Pierre Dubois',
    email: 'pierre.dubois@remote.fr',
    phone: '+33 6 12 34 56 78',
    type: 'comprador',
    source: 'web',
    status: 'activo',
    client_profile: 'digital_nomad',
    budget_min: 350000,
    budget_max: 550000,
    rooms_min: 2,
    surface_min: 80,
    needs_garden: true,
    preferred_zones: ['Pueblo', 'Montgó'],
    languages: ['fr', 'en'],
    requirements_text: 'Maison avec espace bureau, jardin, bonne connexion internet, 350-550k, travail à distance, cherche calme et nature'
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
    await client.query(ensureProfileColumnsSql)
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
    let updated = 0

    for (const contact of CONTACTS) {
      const exists = await client.query('SELECT id FROM tenant_rs_crm.contacts WHERE email = $1 LIMIT 1', [contact.email])
      if (exists.rows[0]) {
        await client.query(
          `UPDATE tenant_rs_crm.contacts SET
            full_name = $2,
            phone = $3,
            type = $4,
            source = $5,
            status = $6,
            client_profile = $7,
            budget_min = $8,
            budget_max = $9,
            rooms_min = $10,
            bathrooms_min = $11,
            surface_min = $12,
            price_per_m2_max = $13,
            needs_renovation = $14,
            needs_pool = $15,
            needs_sea_view = $16,
            needs_garden = $17,
            needs_parking = $18,
            preferred_zones = $19,
            languages = $20,
            requirements_text = $21,
            notes = COALESCE(notes, $21),
            updated_at = now()
           WHERE email = $1`,
          [
            contact.email,
            contact.name,
            contact.phone,
            contact.type,
            contact.source,
            contact.status,
            contact.client_profile,
            contact.budget_min ?? null,
            contact.budget_max ?? null,
            contact.rooms_min ?? null,
            contact.bathrooms_min ?? null,
            contact.surface_min ?? null,
            contact.price_per_m2_max ?? null,
            contact.needs_renovation ?? false,
            contact.needs_pool ?? false,
            contact.needs_sea_view ?? false,
            contact.needs_garden ?? false,
            contact.needs_parking ?? false,
            contact.preferred_zones ?? [],
            contact.languages ?? [],
            contact.requirements_text
          ]
        )
        updated += 1
        continue
      }

      await client.query(
        `INSERT INTO tenant_rs_crm.contacts (
          full_name, email, phone, type, source, status, notes, assigned_to, active,
          client_profile, budget_min, budget_max, rooms_min, bathrooms_min, surface_min,
          price_per_m2_max, needs_renovation, needs_pool, needs_sea_view, needs_garden,
          needs_parking, preferred_zones, languages, requirements_text
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,true,
          $9,$10,$11,$12,$13,$14,
          $15,$16,$17,$18,$19,
          $20,$21,$22,$23
        )`,
        [
          contact.name,
          contact.email,
          contact.phone,
          contact.type,
          contact.source,
          contact.status,
          contact.notes ?? contact.requirements_text,
          assignedTo,
          contact.client_profile,
          contact.budget_min ?? null,
          contact.budget_max ?? null,
          contact.rooms_min ?? null,
          contact.bathrooms_min ?? null,
          contact.surface_min ?? null,
          contact.price_per_m2_max ?? null,
          contact.needs_renovation ?? false,
          contact.needs_pool ?? false,
          contact.needs_sea_view ?? false,
          contact.needs_garden ?? false,
          contact.needs_parking ?? false,
          contact.preferred_zones ?? [],
          contact.languages ?? [],
          contact.requirements_text
        ]
      )
      inserted += 1
    }

    console.log(`OK ${inserted} contactos nuevos insertados, ${updated} contactos actualizados con perfil`)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
