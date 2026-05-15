import type { PoolClient } from 'pg'
import { ensureContactsModuleSchema } from './contacts.service'
import { ensureOperationsModuleSchema } from './operations.service'
import { ensurePropertiesModuleSchema } from './properties.service'

const ensureDashboardSchema = async (db: PoolClient) => {
  await ensureContactsModuleSchema(db)
  await ensurePropertiesModuleSchema(db)
  await ensureOperationsModuleSchema(db)
  await db.query(`
    ALTER TABLE visits ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.users(id);
  `)
}

export const getDashboard = async (db: PoolClient) => {
  await ensureDashboardSchema(db)

  const { rows } = await db.query(`
    WITH
      metrics AS (
        SELECT json_build_object(
          'active_operations', (
            SELECT count(*)::int
            FROM operations
            WHERE active = true AND stage NOT IN ('closed', 'lost')
          ),
          'available_properties', (
            SELECT count(*)::int
            FROM properties
            WHERE active = true AND source = 'internal' AND status = 'available'
          ),
          'visits_today', (
            SELECT count(*)::int
            FROM visits
            WHERE starts_at::date = current_date
          ),
          'closed_this_month', (
            SELECT count(*)::int
            FROM operations
            WHERE active = true
              AND stage = 'closed'
              AND date_trunc('month', coalesce(closed_at, updated_at, created_at)) = date_trunc('month', now())
          ),
          'contacts_total', (
            SELECT count(*)::int
            FROM contacts
            WHERE active = true
          ),
          'new_contacts_this_week', (
            SELECT count(*)::int
            FROM contacts
            WHERE active = true AND created_at >= now() - interval '7 days'
          )
        ) AS data
      ),
      pipeline AS (
        SELECT json_build_object(
          'lead', count(*) FILTER (WHERE stage = 'lead')::int,
          'visit', count(*) FILTER (WHERE stage = 'visit')::int,
          'offer', count(*) FILTER (WHERE stage = 'offer')::int,
          'contract', count(*) FILTER (WHERE stage = 'contract')::int,
          'closed', count(*) FILTER (WHERE stage = 'closed')::int,
          'lost', count(*) FILTER (WHERE stage = 'lost')::int
        ) AS data
        FROM operations
        WHERE active = true
      ),
      recent_contacts AS (
        SELECT coalesce(json_agg(item ORDER BY created_at DESC), '[]'::json) AS data
        FROM (
          SELECT
            id,
            full_name AS name,
            type,
            status,
            created_at
          FROM contacts
          WHERE active = true
          ORDER BY created_at DESC
          LIMIT 5
        ) item
      ),
      recent_operations AS (
        SELECT coalesce(json_agg(item ORDER BY created_at DESC), '[]'::json) AS data
        FROM (
          SELECT
            o.id,
            o.type,
            o.stage,
            o.value,
            c.full_name AS contact_name,
            p.title AS property_title,
            o.created_at
          FROM operations o
          JOIN contacts c ON c.id = o.contact_id
          LEFT JOIN properties p ON p.id = o.property_id
          WHERE o.active = true
          ORDER BY o.created_at DESC
          LIMIT 5
        ) item
      ),
      upcoming_visits AS (
        SELECT coalesce(json_agg(item ORDER BY scheduled_at ASC), '[]'::json) AS data
        FROM (
          SELECT
            v.id,
            v.starts_at AS scheduled_at,
            c.full_name AS contact_name,
            p.title AS property_title,
            u.full_name AS agent_name
          FROM visits v
          JOIN contacts c ON c.id = v.contact_id
          JOIN properties p ON p.id = v.property_id
          LEFT JOIN public.users u ON u.id = v.agent_id
          WHERE v.starts_at >= now()
          ORDER BY v.starts_at ASC
          LIMIT 5
        ) item
      )
    SELECT json_build_object(
      'metrics', metrics.data,
      'pipeline', pipeline.data,
      'recent_contacts', recent_contacts.data,
      'recent_operations', recent_operations.data,
      'upcoming_visits', upcoming_visits.data
    ) AS summary
    FROM metrics, pipeline, recent_contacts, recent_operations, upcoming_visits
  `)

  return rows[0].summary
}
