import 'dotenv/config'
import { Pool } from 'pg'

const operations = [
  {
    email: 'carlos.martinez@gmail.com',
    type: 'sale',
    stage: 'lead',
    value: 1100000,
    notes: 'Interesado en villa zona Montgó. Primera toma de contacto por teléfono. Quiere visitar el próximo fin de semana.',
    createdDaysAgo: 3
  },
  {
    email: 'j.wellington@outlook.co.uk',
    type: 'sale',
    stage: 'visit',
    value: 380000,
    notes: 'Visita confirmada para el sábado. Le interesan 2 apartamentos en el Arenal. Cash buyer, decisión rápida si le convence.',
    createdDaysAgo: 7
  },
  {
    email: 'hpmuller@web.de',
    type: 'sale',
    stage: 'offer',
    value: 1350000,
    notes: 'Ha presentado oferta de 1.35M sobre villa en Balcón al Mar. Propietario pide 1.45M. Negociando. Cliente muy motivado.',
    createdDaysAgo: 12
  },
  {
    email: 'inge.devries@gmail.com',
    type: 'sale',
    stage: 'contract',
    value: 695000,
    notes: 'Contrato de arras firmado. Notaría prevista para el 15 de junio. Financiación aprobada por ING Holanda.',
    createdDaysAgo: 20
  },
  {
    email: 'mthompson@gmail.com',
    type: 'sale',
    stage: 'closed',
    value: 420000,
    notes: 'Venta completada. Apartamento en el Puerto. Rentabilidad estimada 5.2% anual. Cliente muy satisfecho, busca segunda inversión.',
    createdDaysAgo: 35,
    closedDaysAgo: 10
  },
  {
    email: 'pierre.dubois@remote.fr',
    type: 'sale',
    stage: 'lead',
    value: 480000,
    notes: 'Contacto vía web. Busca casa con jardín para trabajar en remoto. Viene a Jávea en julio. Pendiente de enviarle selección de propiedades.',
    createdDaysAgo: 1
  },
  {
    email: 'r.bianchi@investit.com',
    type: 'sale',
    stage: 'lost',
    value: 280000,
    notes: 'Finalmente compró en Dénia a través de otra agencia. Precio inferior al de Jávea. Mantener contacto para futuras inversiones.',
    createdDaysAgo: 45,
    closedDaysAgo: 15
  },
  {
    email: 'pedroluciajavea@gmail.com',
    type: 'sale',
    stage: 'visit',
    value: 295000,
    notes: 'Segunda visita a apartamento en el pueblo. Les ha gustado mucho. Pendientes de hablar con el banco para confirmar hipoteca.',
    createdDaysAgo: 5
  },
  {
    email: 'f.lecomte@luxe-invest.fr',
    type: 'sale',
    stage: 'lead',
    value: 2800000,
    notes: 'Contacto vía referencia exclusiva. Busca villa contemporánea con infinity pool y vistas al Mediterráneo. Presupuesto real hasta 3.5M. Viene a Jávea en julio.',
    createdDaysAgo: 2
  },
  {
    email: 'sophie.dubois@hotmail.be',
    type: 'sale',
    stage: 'visit',
    value: 380000,
    notes: 'Ha visto 3 apartamentos online. Visita confirmada para ver 2 en el Arenal. Muy centrada en la rentabilidad por alquiler vacacional. Quiere números antes de decidir.',
    createdDaysAgo: 6
  },
  {
    email: 'k.bergmann@invest.de',
    type: 'sale',
    stage: 'offer',
    value: 265000,
    notes: 'Oferta presentada sobre casa de pueblo en el casco antiguo. Precio pedido 290k, ofrece 265k. Propietario reflexionando. Cliente paga al contado.',
    createdDaysAgo: 9
  },
  {
    email: 'matorres@gmail.com',
    type: 'sale',
    stage: 'contract',
    value: 545000,
    notes: 'Arras firmadas sobre chalet en Montgó. 3 hab, piscina, vistas parciales al mar. Escritura en notaría el 20 de junio. Hipoteca aprobada por CaixaBank.',
    createdDaysAgo: 25
  },
  {
    email: 'o.bennett@remotework.co.uk',
    type: 'sale',
    stage: 'lead',
    value: 420000,
    notes: 'Encontró el CRM via Google. Trabaja para empresa fintech londinense 100% remoto. Quiere mudarse permanentemente a Jávea. Pendiente de enviarle selección de pisos con terraza en Puerto y Arenal.',
    createdDaysAgo: 1
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

    const properties = await client.query(
      `SELECT id FROM tenant_rs_crm.properties
       WHERE active = true
       ORDER BY source = 'internal' DESC, created_at DESC
       LIMIT 8`
    )
    if (!properties.rows.length) throw new Error('No properties found')

    let inserted = 0
    for (const [index, operation] of operations.entries()) {
      const contact = await client.query('SELECT id FROM tenant_rs_crm.contacts WHERE email = $1 LIMIT 1', [operation.email])
      const contactId = contact.rows[0]?.id
      if (!contactId) continue

      const exists = await client.query(
        `SELECT id FROM tenant_rs_crm.operations
         WHERE contact_id = $1 AND stage = $2 AND value = $3
         LIMIT 1`,
        [contactId, operation.stage, operation.value]
      )
      if (exists.rows[0]) {
        await client.query(
          `UPDATE tenant_rs_crm.operations
           SET notes = $2, updated_at = now()
           WHERE id = $1`,
          [exists.rows[0].id, operation.notes]
        )
        continue
      }

      await client.query(
        `INSERT INTO tenant_rs_crm.operations (
          contact_id, property_id, type, stage, value, notes, agent_id,
          active, created_at, closed_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          true,
          now() - ($8::int * interval '1 day'),
          CASE WHEN $9::int IS NULL THEN NULL ELSE now() - ($9::int * interval '1 day') END
        )`,
        [
          contactId,
          properties.rows[index % properties.rows.length].id,
          operation.type,
          operation.stage,
          operation.value,
          operation.notes,
          agentId,
          operation.createdDaysAgo,
          operation.closedDaysAgo ?? null
        ]
      )
      inserted += 1
    }

    console.log(`OK ${inserted} operaciones de prueba insertadas`)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
