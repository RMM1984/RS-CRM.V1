export type OperationType = 'sale' | 'rent'
export type OperationStage = 'lead' | 'visit' | 'offer' | 'contract' | 'closed' | 'lost'

export type Operation = {
  id: string
  contact_id: string
  property_id: string | null
  type: OperationType
  stage: OperationStage
  value: number | string
  notes: string | null
  agent_id: string | null
  active: boolean
  closed_at: string | null
  created_at: string
  updated_at: string
  contact_name: string
  contact_phone: string | null
  contact_email: string | null
  property_title: string | null
  property_price: number | string | null
  property_source: string | null
  property_source_url: string | null
  agent_name: string | null
  agent_email: string | null
}

export type KanbanData = Record<OperationStage, Operation[]>

export type OperationFilters = {
  type?: OperationType | 'all'
  stage?: OperationStage | 'all'
  agent_id?: string | 'all'
  contact_id?: string
  property_id?: string
}

export type CreateOperationDto = {
  contact_id: string
  property_id?: string | null
  type: OperationType
  stage: OperationStage
  value?: number | null
  notes?: string | null
  agent_id?: string | null
}

export type UpdateOperationDto = Partial<CreateOperationDto>
