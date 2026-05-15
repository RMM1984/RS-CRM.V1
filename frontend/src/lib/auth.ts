import { jwtDecode } from 'jwt-decode'
import type { User } from '@/types/auth'

const TOKEN_KEY = 'crm_token'

type JwtPayload = {
  id?: string
  sub?: string
  email: string
  role: User['role']
  tenant_id: string
  tenant_slug?: string
  schema_name: string
  is_premium?: boolean
  iat: number
  exp: number
}

const isBrowser = () => typeof window !== 'undefined'

export const getToken = () => {
  if (!isBrowser()) {
    return null
  }

  return window.localStorage.getItem(TOKEN_KEY)
}

export const setToken = (token: string) => {
  if (isBrowser()) {
    window.localStorage.setItem(TOKEN_KEY, token)
  }
}

export const removeToken = () => {
  if (isBrowser()) {
    window.localStorage.removeItem(TOKEN_KEY)
  }
}

export const getUser = (): User | null => {
  const token = getToken()

  if (!token) {
    return null
  }

  try {
    const payload = jwtDecode<JwtPayload>(token)
    const id = payload.sub ?? payload.id

    if (!id) {
      return null
    }

    return {
      id,
      email: payload.email,
      role: payload.role,
      tenant_id: payload.tenant_id,
      tenant_slug: payload.tenant_slug,
      schema_name: payload.schema_name,
      is_premium: payload.is_premium,
      iat: payload.iat,
      exp: payload.exp
    }
  } catch {
    removeToken()
    return null
  }
}

export const isAuthenticated = () => {
  const user = getUser()

  if (!user) {
    return false
  }

  const nowInSeconds = Math.floor(Date.now() / 1000)

  if (user.exp <= nowInSeconds) {
    removeToken()
    return false
  }

  return true
}
