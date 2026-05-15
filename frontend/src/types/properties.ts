export type PropertyOperation = 'sale' | 'rent'
export type PropertyStatus = 'draft' | 'active' | 'available' | 'reserved' | 'sold' | 'rented' | 'archived'
export type PropertySource = 'internal' | 'kyero' | 'sooprema' | 'crown_property' | 'other'
export type PropertyType = 'piso' | 'apartamento' | 'chalet' | 'villa' | 'local' | 'oficina' | string
export type ShortlistStatus = 'investigating' | 'visit_pending' | 'interested' | 'discarded'

export type PropertyImage = {
  id: string
  url: string
  path: string | null
  created_at: string
}

export type Property = {
  id: string
  title: string
  address: string
  city: string
  zip: string | null
  type: PropertyType
  operation: PropertyOperation
  price: number | string
  surface_m2: number | string | null
  plot_m2: number | string | null
  rooms: number | null
  bathrooms: number | null
  status: PropertyStatus
  description: string | null
  assigned_to: string | null
  source: PropertySource
  source_url: string | null
  source_agency_name: string | null
  source_agency_phone: string | null
  external_ref: string | null
  external_badge: string | null
  created_at: string
  updated_at: string
  images?: PropertyImage[]
}

export type ExternalProperty = {
  id: string
  title: string
  city: string
  price: number
  operation: PropertyOperation
  type: PropertyType
  source: Exclude<PropertySource, 'internal'>
  source_url: string
  source_agency_name?: string
  source_agency_phone?: string
  image_url?: string
  images?: PropertyImage[]
  surface_m2?: number
  rooms?: number
  bathrooms?: number
  description?: string
}

export type PropertiesPageData = {
  properties: Property[]
  total: number
  page: number
  limit: number
}

export type PropertyFilters = {
  type?: string
  operation?: PropertyOperation | 'all'
  status?: PropertyStatus | 'all'
  city?: string
  source?: PropertySource | 'all'
  search?: string
  price_min?: number
  price_max?: number
  rooms_min?: number
  page: number
  limit: number
}

export type CreatePropertyDto = {
  title: string
  address: string
  city: string
  zip?: string | null
  type: PropertyType
  operation: PropertyOperation
  price: number
  surface_m2?: number | null
  rooms?: number | null
  bathrooms?: number | null
  status?: PropertyStatus
  description?: string | null
  assigned_to?: string | null
}

export type UpdatePropertyDto = Partial<CreatePropertyDto>

export type SearchKeywords = {
  type?: string
  operation?: PropertyOperation
  city?: string
  price_max?: number
  rooms_min?: number
  features: string[]
}

export type PropertySearchResult = {
  keywords: SearchKeywords
  internal: Property[]
  external: ExternalProperty[]
  cache_age_minutes?: number | null
}

export type ShortlistItem = {
  id: string
  user_id: string | null
  contact_id: string | null
  property_id: string | null
  external_data: ExternalProperty | null
  status: ShortlistStatus
  notes: string | null
  created_at: string
  contact_name?: string | null
  property_title?: string | null
  property_source?: PropertySource | null
  property_price?: number | string | null
  property_operation?: PropertyOperation | null
  property_rooms?: number | null
  property_surface_m2?: number | string | null
  property_source_url?: string | null
  property_images?: PropertyImage[]
}

export type SaveToShortlistDto = {
  contact_id: string
  property_id?: string | null
  external_data?: ExternalProperty | null
  notes?: string | null
}
