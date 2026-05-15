'use client'

import { useCallback, useEffect, useState } from 'react'
import { getUser, isAuthenticated, removeToken } from '@/lib/auth'
import type { User } from '@/types/auth'

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    setUser(getUser())
    setAuthenticated(isAuthenticated())
  }, [])

  const logout = useCallback(() => {
    removeToken()
    setUser(null)
    setAuthenticated(false)
    window.location.assign('/login')
  }, [])

  return {
    user,
    isAuthenticated: authenticated,
    logout
  }
}
