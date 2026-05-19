'use client'

import { LogOut } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

const initials = (email?: string | null) => email?.slice(0, 2).toUpperCase() ?? 'US'

export const Header = () => {
  const { user, logout } = useAuth()

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4 md:h-16 md:px-6">
      <div aria-hidden="true" />
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback>{initials(user?.email)}</AvatarFallback>
        </Avatar>
        <Button className="gap-2" onClick={logout} size="sm" variant="ghost">
          <LogOut className="h-4 w-4" />
          Cerrar sesion
        </Button>
      </div>
    </header>
  )
}
