'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, CalendarDays, Home, LogOut, Users, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/contacts', label: 'Contactos', icon: Users },
  { href: '/properties', label: 'Propiedades', icon: Building2 },
  { href: '/operations', label: 'Operaciones', icon: Workflow },
  { href: '/visits', label: 'Visitas', icon: CalendarDays }
]

export const Sidebar = () => {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <aside className="flex min-h-screen w-72 flex-col border-r bg-card px-4 py-5">
      <Link className="mb-8 flex items-center gap-3 px-2" href="/dashboard">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-primary text-sm font-black text-primary-foreground">
          RS
        </span>
        <span>
          <span className="block text-lg font-bold leading-none">RS-CRM</span>
          <span className="text-xs text-muted-foreground">Real Estate SaaS</span>
        </span>
      </Link>

      <nav className="grid gap-1">
        {links.map((link) => {
          const active = pathname === link.href
          const Icon = link.icon

          return (
            <Link
              className={cn(
                'flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                active && 'bg-accent text-accent-foreground'
              )}
              href={link.href}
              key={link.href}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto rounded-md border bg-background p-3">
        <p className="truncate text-sm font-semibold">{user?.email ?? 'Usuario'}</p>
        <p className="mt-1 text-xs uppercase text-muted-foreground">{user?.role ?? 'agent'}</p>
        <Button className="mt-3 w-full justify-start gap-2" onClick={logout} variant="outline">
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  )
}
