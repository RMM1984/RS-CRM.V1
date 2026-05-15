export type UserRole = 'admin' | 'agent'

export type User = {
  id: string
  email: string
  role: UserRole
  tenant_id: string
  tenant_slug?: string
  schema_name: string
  is_premium?: boolean
  iat: number
  exp: number
}

export type LoginRequest = {
  email: string
  password: string
}

export type LoginResponse = {
  token: string
}
