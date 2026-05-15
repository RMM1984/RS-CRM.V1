'use client'

import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/contacts': 'Contactos',
  '/properties': 'Propiedades',
  '/operations': 'Operaciones',
  '/visits': 'Visitas'
}

const initials = (email?: string | null) => email?.slice(0, 2).toUpperCase() ?? 'US'

export const Header = () => {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div>
        <h1 className="text-xl font-semibold">{titles[pathname] ?? 'RS-CRM'}</h1>
        <p className="text-sm text-muted-foreground">{user?.schema_name ?? 'tenant'}</p>
      </div>
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
