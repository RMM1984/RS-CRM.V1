export type SearchParams = {
  type?: string
  operation?: string
  city?: string
  price_max?: number
  surface_min?: number
  rooms_min?: number
  terms?: string[]
  raw_terms?: string[]
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
  source: 'kyero' | 'sooprema' | 'crown_property' | 'other'
  source_url: string
  source_agency_name?: string
  source_agency_phone?: string
  image_url: string
  images?: Array<{ url: string }>
  surface_m2: number | null
  rooms: number | null
  bathrooms: number | null
  description?: string
  ref: string
  zone: string
  badge?: string | null
  search_text: string
}

export class PropertySyncService {
  async searchExternal(_params: SearchParams): Promise<ExternalProperty[]> {
    return []
  }
}
