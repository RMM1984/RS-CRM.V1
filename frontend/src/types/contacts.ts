export type ContactType = 'comprador' | 'vendedor' | 'inquilino' | 'propietario' | 'ambos'
export type ContactStatus = 'activo' | 'frio' | 'cerrado'
export type ContactSource = 'web' | 'referral' | 'portal' | 'manual'
export type InteractionType = 'call' | 'email' | 'note' | 'whatsapp' | 'visit'

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
}

export type UpdateContactDto = Partial<CreateContactDto>

export type ContactFilters = {
  type?: ContactType | 'todos'
  status?: ContactStatus | 'todos'
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
