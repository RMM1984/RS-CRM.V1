import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pool, quoteIdentifier } from '../config/db'

const schemaName = process.argv[2]

const run = async () => {
  if (!schemaName) {
    throw new Error('Usage: npm run migrate:tenant -- tenant_acme')
  }

  quoteIdentifier(schemaName)
  const migrationPath = path.join(__dirname, 'migrations', '001_tenant_schema.sql')
  const sql = await readFile(migrationPath, 'utf8')
  const renderedSql = sql.replaceAll('__SCHEMA_NAME__', schemaName)

  await pool.query(renderedSql)
  await pool.end()
  console.log(`Tenant schema migrated: ${schemaName}`)
}

run().catch(async (err) => {
  await pool.end()
  console.error(err)
  process.exit(1)
})
