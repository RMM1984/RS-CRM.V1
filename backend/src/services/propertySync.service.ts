export type SearchParams = {
  type?: string
  operation?: string
  city?: string
  price_max?: number
  rooms_min?: number
  features: string[]
}

export type ExternalProperty = {
  id: string
  title: string
  city: string
  price: number
  operation: 'sale' | 'rent'
  type: string
  source: 'kyero' | 'sooprema' | 'other'
  source_url: string
  source_agency_name?: string
  source_agency_phone?: string
  image_url?: string
  surface_m2?: number
  rooms?: number
  bathrooms?: number
  description?: string
}

export class PropertySyncService {
  async searchExternal(_params: SearchParams): Promise<ExternalProperty[]> {
    return []
  }
}
