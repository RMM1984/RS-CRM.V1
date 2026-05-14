import type { PoolClient } from 'pg'

export const getDashboard = async (db: PoolClient) => {
  const { rows } = await db.query(`
    SELECT
      (SELECT count(*)::int FROM contacts WHERE deleted_at IS NULL) AS contacts,
      (SELECT count(*)::int FROM properties WHERE deleted_at IS NULL) AS properties,
      (SELECT count(*)::int FROM operations WHERE deleted_at IS NULL) AS operations,
      (SELECT count(*)::int FROM visits WHERE starts_at >= now()) AS upcoming_visits,
      (SELECT coalesce(sum(amount), 0)::numeric FROM operations WHERE status IN ('offer', 'closing')) AS hot_pipeline_value
  `)

  return rows[0]
}
