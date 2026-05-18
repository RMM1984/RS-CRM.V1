export type VisitStatus = 'scheduled' | 'done' | 'cancelled' | 'no_show'

export type Visit = {
  id: string
  title: string
  scheduled_at: string
  duration_min: number
  location: string | null
  contact_id: string | null
  property_id: string | null
  operation_id: string | null
  agent_id: string
  status: VisitStatus
  notes: string | null
  ical_uid: string | null
  created_at: string
  updated_at: string
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  property_title: string | null
  property_address: string | null
  property_city: string | null
  property_price: number | null
  agent_name: string | null
  agent_email: string | null
}

export type VisitsPageData = {
  visits: Visit[]
  total: number
  page: number
  limit: number
}

export type VisitFilters = {
  from?: string
  to?: string
  agent_id?: string
  status?: VisitStatus | 'all'
  page?: number
  limit?: number
}

export type CreateVisitDto = {
  title?: string | null
  scheduled_at: string
  duration_min?: number | null
  location?: string | null
  contact_id?: string | null
  property_id?: string | null
  operation_id?: string | null
  notes?: string | null
  status?: VisitStatus
}

export type UpdateVisitDto = Partial<CreateVisitDto>

export type CalendarVisits = Record<string, Visit[]>

export type CalendarUrlData = {
  url: string
  instructions: {
    google: string
    apple: string
    outlook: string
  }
}
