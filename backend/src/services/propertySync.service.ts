export type SearchParams = {
  type?: string | null
  operation?: string | null
  city?: string
  price_max?: number | null
  surface_min?: number | null
  rooms_min?: number | null
  bathrooms_min?: number | null
  terms?: string[]
  raw_terms?: string[]
  detected_language?: string
  language_detected?: string
  features: string[]
}

export type ExternalProperty = {
  id: string
  title: string
  city: string
  price: number
  operation: 'sale' | 'rent'
  type: string
  detected_type?: string
  source: 'kyero' | 'sooprema' | 'crown_property' | 'ego_real_estate' | 'other'
  source_url: string
  source_agency_name?: string
  source_agency_phone?: string
  image_url: string
  images?: Array<{ url: string }>
  surface_m2: number | null
  plot_m2?: number | null
  rooms: number | null
  bathrooms: number | null
  description?: string
  ref: string
  zone: string
  badge?: string | null
  search_text: string
  deleted_at?: string | null
}

export class PropertySyncService {
  async searchExternal(_params: SearchParams): Promise<ExternalProperty[]> {
    return []
  }
}
