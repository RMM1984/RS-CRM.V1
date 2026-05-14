import { pool, quoteIdentifier } from '../config/db'

const slugToSchema = (slug: string) => `tenant_${slug.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`

export const createTenant = async (name: string, slug: string, plan: 'standard' | 'premium') => {
  const schemaName = slugToSchema(slug)
  quoteIdentifier(schemaName)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO public.tenants (name, slug, schema_name, plan)
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [name, slug, schemaName, plan]
    )
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(schemaName)}`)
    await client.query('COMMIT')

    return rows[0]
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
