'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { isAuthenticated } from '@/lib/auth'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    router.replace(isAuthenticated() ? '/dashboard' : '/login')
  }, [router])

  return (
    <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">
      Cargando...
    </main>
  )
}
