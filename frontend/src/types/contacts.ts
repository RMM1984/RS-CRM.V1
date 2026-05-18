export type ContactType = 'comprador' | 'vendedor' | 'inquilino' | 'propietario' | 'ambos'
export type ContactStatus = 'activo' | 'frio' | 'cerrado'
export type ContactSource = 'web' | 'referral' | 'portal' | 'manual'
export type InteractionType = 'call' | 'email' | 'note' | 'whatsapp' | 'visit'
export type ClientProfile =
  | 'investor_yield'
  | 'investor_flip'
  | 'first_home'
  | 'second_home'
  | 'foreign'
  | 'digital_nomad'
  | 'luxury_standard'
  | 'luxury_premium'

export type Contact = {
  id: string
  name: string
  phone: string | null
  email: string | null
  type: ContactType
  source: ContactSource | null
  status: ContactStatus
  notes: string | null
  assigned_to: string | null
  client_profile: ClientProfile | null
  budget_min: number | string | null
  budget_max: number | string | null
  rooms_min: number | null
  bathrooms_min: number | null
  surface_min: number | null
  price_per_m2_max: number | string | null
  needs_renovation: boolean
  needs_pool: boolean
  needs_sea_view: boolean
  needs_garden: boolean
  needs_parking: boolean
  needs_terrace: boolean
  preferred_zones: string[] | null
  languages: string[] | null
  requirements_text: string | null
  active: boolean
  created_at: string
  updated_at: string
  interactions?: Interaction[]
}

export type Interaction = {
  id: string
  contact_id: string
  type: InteractionType
  content: string
  created_by: string | null
  created_at: string
}

export type CreateContactDto = {
  name: string
  phone?: string | null
  email?: string | null
  type: ContactType
  source?: ContactSource | null
  status?: ContactStatus
  notes?: string | null
  assigned_to?: string | null
  client_profile?: ClientProfile | null
  budget_min?: number | null
  budget_max?: number | null
  rooms_min?: number | null
  bathrooms_min?: number | null
  surface_min?: number | null
  price_per_m2_max?: number | null
  needs_renovation?: boolean | null
  needs_pool?: boolean | null
  needs_sea_view?: boolean | null
  needs_garden?: boolean | null
  needs_parking?: boolean | null
  needs_terrace?: boolean | null
  preferred_zones?: string[] | null
  languages?: string[] | null
  requirements_text?: string | null
}

export type UpdateContactDto = Partial<CreateContactDto>

export type ContactFilters = {
  type?: ContactType | 'todos'
  status?: ContactStatus | 'todos'
  has_profile?: boolean
  search?: string
  page: number
  limit: number
}

export type ContactsPageData = {
  contacts: Contact[]
  total: number
  page: number
  limit: number
}

export type ContactDetail = Contact & {
  interactions: Interaction[]
}

export type AddInteractionDto = {
  type: InteractionType
  content: string
}
