import type { ContactStatus, ContactType } from './contacts'
import type { OperationStage, OperationType } from './operations'

export type DashboardMetrics = {
  active_operations: number
  available_properties: number
  visits_today: number
  closed_this_month: number
  contacts_total: number
  new_contacts_this_week: number
}

export type PipelineCount = Record<OperationStage, number>

export type RecentContact = {
  id: string
  name: string
  type: ContactType
  status: ContactStatus
  created_at: string
}

export type RecentOperation = {
  id: string
  type: OperationType
  stage: OperationStage
  value: number | string
  contact_name: string
  property_title: string | null
  created_at: string
}

export type UpcomingVisit = {
  id: string
  scheduled_at: string
  contact_name: string
  property_title: string
  agent_name: string | null
}

export type DashboardSummary = {
  metrics: DashboardMetrics
  pipeline: PipelineCount
  recent_contacts: RecentContact[]
  recent_operations: RecentOperation[]
  upcoming_visits: UpcomingVisit[]
}
