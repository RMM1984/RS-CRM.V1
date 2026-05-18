import 'dotenv/config'
import { Pool, type PoolClient } from 'pg'

type CrownProperty = {
  title: string
  address: string
  city: string
  type: string
  operation: 'sale'
  price: number
  surface_m2: number
  plot_m2?: number
  rooms: number
  bathrooms: number
  status: 'available'
  source: 'crown_property'
  source_url: string
  source_agency_name: string
  source_agency_phone: string
  external_ref: string
  external_badge: string | null
  image_url: string
  description: string
}

const properties: CrownProperty[] = [
  {
    title: 'Apartamento primera línea con vista al mar y piscina en Montañar I',
    address: 'Montañar I',
    city: 'Jávea',
    type: 'apartment',
    operation: 'sale',
    price: 360000,
    surface_m2: 45,
    rooms: 1,
    bathrooms: 1,
    status: 'available',
    source: 'crown_property',
    source_url:
      'https://www.crown-property.com/venta/apartamento-primera-linea-con-vista-al-mar-y-piscina-en-montanar-i-javea-4872/',
    source_agency_name: 'Crown Property Jávea',
    source_agency_phone: '+34 965 791 091',
    external_ref: '4872',
    external_badge: null,
    image_url:
      'https://app-api.paagees.com/uploads/019d33c5-07d5-7458-b26a-06988b44b5c6/property/2026/05/15/01/019e2c04-1585-76ea-a688-4e29a9028d01.webp',
    description:
      'Apartamento en primera línea con impresionantes vistas al mar y acceso a piscina comunitaria en Montañar I, Jávea.'
  },
  {
    title: 'Villa con impresionantes vistas abiertas, recientemente terminada 2026',
    address: 'Jávea',
    city: 'Jávea',
    type: 'house',
    operation: 'sale',
    price: 1190000,
    surface_m2: 337,
    plot_m2: 1156,
    rooms: 3,
    bathrooms: 2,
    status: 'available',
    source: 'crown_property',
    source_url:
      'https://www.crown-property.com/venta/villa-con-impresionantes-vistas-abiertas-recientemente-terminada-2026-4846/',
    source_agency_name: 'Crown Property Jávea',
    source_agency_phone: '+34 965 791 091',
    external_ref: '4846',
    external_badge: 'Novedad',
    image_url:
      'https://app-api.paagees.com/uploads/019d33c5-07d5-7458-b26a-06988b44b5c6/property/2026/05/15/70/019e2b8c-aefe-7696-9077-272ce94f2970.webp',
    description:
      'Villa de nueva construcción 2026 con impresionantes vistas abiertas. 337m² construidos sobre parcela de 1.156m².'
  },
  {
    title: 'Apartamento con impresionantes zonas comunes a escasos metros de la playa El Arenal',
    address: 'Arenal',
    city: 'Jávea',
    type: 'apartment',
    operation: 'sale',
    price: 460000,
    surface_m2: 106,
    rooms: 3,
    bathrooms: 2,
    status: 'available',
    source: 'crown_property',
    source_url:
      'https://www.crown-property.com/venta/apartamento-con-impresionantes-zonas-comunes-a-escasos-metros-de-la-playa-el-arenal-4865/',
    source_agency_name: 'Crown Property Jávea',
    source_agency_phone: '+34 965 791 091',
    external_ref: '4865',
    external_badge: 'Exclusiva',
    image_url:
      'https://app-api.paagees.com/uploads/019d33c5-07d5-7458-b26a-06988b44b5c6/property/2026/05/14/40/019e25c1-9d6c-705b-b879-9a74f0643940.webp',
    description:
      'Apartamento exclusiva con espectaculares zonas comunes a pocos metros de la playa El Arenal en Jávea.'
  },
  {
    title: 'Apartamento muy cerca del casco antiguo de Jávea con parking',
    address: 'Pueblo',
    city: 'Jávea',
    type: 'apartment',
    operation: 'sale',
    price: 265000,
    surface_m2: 74,
    rooms: 2,
    bathrooms: 2,
    status: 'available',
    source: 'crown_property',
    source_url:
      'https://www.crown-property.com/venta/apartamento-muy-cerca-del-casco-antiguo-de-javea-con-parking-4876/',
    source_agency_name: 'Crown Property Jávea',
    source_agency_phone: '+34 965 791 091',
    external_ref: '4876',
    external_badge: 'Exclusiva',
    image_url:
      'https://app-api.paagees.com/uploads/019d33c5-07d5-7458-b26a-06988b44b5c6/property/2026/05/13/90/019e213c-d4a8-75ff-9fb6-35b4c15be690.webp',
    description:
      'Apartamento exclusiva de 2 habitaciones en el pueblo de Jávea, muy cerca del casco antiguo e incluye plaza de parking.'
  }
]

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined
  })

  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query('SET search_path TO tenant_rs_crm, public')
    await client.query(`
      ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_status_check;
      ALTER TABLE properties ADD CONSTRAINT properties_status_check
        CHECK (status IN ('draft', 'active', 'available', 'reserved', 'sold', 'rented', 'archived'));
      ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_source_check;
      ALTER TABLE properties ADD CONSTRAINT properties_source_check
        CHECK (source IN ('internal', 'crown_property', 'colaboracion', 'kyero', 'sooprema', 'other'));
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS plot_m2 NUMERIC;
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS external_ref TEXT;
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS external_badge TEXT;
      CREATE TABLE IF NOT EXISTS property_images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        path TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    const adminResult = await client.query<{ id: string }>(`
      SELECT u.id
      FROM public.users u
      WHERE u.tenant_id = (SELECT id FROM public.tenants WHERE slug = 'rs-crm')
        AND u.role = 'admin'
        AND u.deleted_at IS NULL
      ORDER BY u.created_at ASC
      LIMIT 1
    `)

    const assignedTo = adminResult.rows[0]?.id ?? null
    let inserted = 0

    for (const property of properties) {
      const exists = await client.query<{ id: string }>('SELECT id FROM properties WHERE source_url = $1 LIMIT 1', [
        property.source_url
      ])

      let propertyId = exists.rows[0]?.id

      if (exists.rowCount) {
        await insertImageIfMissing(client, propertyId, property)
        continue
      }

      const insertedProperty = await client.query<{ id: string }>(
        `
          INSERT INTO properties (
            title,
            address,
            city,
            property_type,
            operation,
            price,
            sqm,
            plot_m2,
            bedrooms,
            bathrooms,
            status,
            source,
            source_url,
            source_agency_name,
            source_agency_phone,
            external_ref,
            external_badge,
            description,
            assigned_to,
            active
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, true
          )
          RETURNING id
        `,
        [
          property.title,
          property.address,
          property.city,
          property.type,
          property.operation,
          property.price,
          property.surface_m2,
          property.plot_m2 ?? null,
          property.rooms,
          property.bathrooms,
          property.status,
          property.source,
          property.source_url,
          property.source_agency_name,
          property.source_agency_phone,
          property.external_ref,
          property.external_badge,
          property.description,
          assignedTo
        ]
      )

      propertyId = insertedProperty.rows[0].id
      await insertImageIfMissing(client, propertyId, property)
      inserted += 1
    }

    await client.query('COMMIT')
    console.log(`✅ ${inserted} propiedades insertadas`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

const insertImageIfMissing = async (
  client: PoolClient,
  propertyId: string | undefined,
  property: CrownProperty
) => {
  if (!propertyId) {
    return
  }

  const exists = await client.query(
    'SELECT id FROM property_images WHERE property_id = $1 AND url = $2 LIMIT 1',
    [propertyId, property.image_url]
  )

  if (exists.rowCount) {
    return
  }

  await client.query('INSERT INTO property_images (property_id, url, path) VALUES ($1, $2, $3)', [
    propertyId,
    property.image_url,
    `crown_property/${property.external_ref}/main.webp`
  ])
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
