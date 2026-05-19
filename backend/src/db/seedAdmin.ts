import { readFile } from 'node:fs/promises'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { pool, quoteIdentifier } from '../config/db'

const seedEnvSchema = z.object({
  SEED_TENANT_NAME: z.string().min(2).default('SKOPI'),
  SEED_TENANT_SLUG: z.string().min(2).regex(/^[a-z0-9-]+$/).default('rs-crm'),
  SEED_TENANT_PLAN: z.enum(['standard', 'premium']).default('premium'),
  SEED_ADMIN_EMAIL: z.string().email(),
  SEED_ADMIN_PASSWORD: z.string().min(8),
  SEED_ADMIN_NAME: z.string().min(2).default('Admin User')
})

const slugToSchema = (slug: string) => `tenant_${slug.replace(/-/g, '_')}`

const migrateTenantSchema = async (schemaName: string) => {
  quoteIdentifier(schemaName)
  const migrationPath = path.join(__dirname, 'migrations', '001_tenant_schema.sql')
  const sql = await readFile(migrationPath, 'utf8')
  const renderedSql = sql.replaceAll('__SCHEMA_NAME__', schemaName)

  await pool.query(renderedSql)
}

const run = async () => {
  const seed = seedEnvSchema.parse(process.env)
  const schemaName = slugToSchema(seed.SEED_TENANT_SLUG)
  const passwordHash = await bcrypt.hash(seed.SEED_ADMIN_PASSWORD, 12)

  quoteIdentifier(schemaName)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const tenantResult = await client.query(
      `INSERT INTO public.tenants (name, slug, schema_name, plan)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (slug) DO UPDATE
      SET name = EXCLUDED.name,
          schema_name = EXCLUDED.schema_name,
          plan = EXCLUDED.plan,
          updated_at = now()
      RETURNING id, slug, schema_name, plan`,
      [seed.SEED_TENANT_NAME, seed.SEED_TENANT_SLUG, schemaName, seed.SEED_TENANT_PLAN]
    )

    const tenant = tenantResult.rows[0]

    await client.query(
      `INSERT INTO public.users (tenant_id, email, password_hash, full_name, role)
      VALUES ($1, $2, $3, $4, 'admin')
      ON CONFLICT (email) DO UPDATE
      SET tenant_id = EXCLUDED.tenant_id,
          password_hash = EXCLUDED.password_hash,
          full_name = EXCLUDED.full_name,
          role = 'admin',
          updated_at = now(),
          deleted_at = NULL
      RETURNING id, email, role`,
      [tenant.id, seed.SEED_ADMIN_EMAIL.toLowerCase(), passwordHash, seed.SEED_ADMIN_NAME]
    )

    await client.query('COMMIT')
    await migrateTenantSchema(schemaName)

    console.log(
      JSON.stringify(
        {
          ok: true,
          tenant: {
            slug: tenant.slug,
            schema_name: tenant.schema_name,
            plan: tenant.plan
          },
          admin: {
            email: seed.SEED_ADMIN_EMAIL.toLowerCase(),
            role: 'admin'
          }
        },
        null,
        2
      )
    )
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(async (err) => {
  console.error(err)
  process.exit(1)
})
