'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, CalendarDays, Home, LogOut, Users, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useVisits } from '@/hooks/useVisits'
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
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const todayVisits = useVisits({
    from: today.toISOString(),
    to: tomorrow.toISOString(),
    status: 'scheduled',
    page: 1,
    limit: 20
  })

  return (
    <>
      <aside className="hidden min-h-screen w-72 flex-col border-r bg-card px-4 py-5 md:flex">
        <Link className="mb-8 flex items-center gap-3 px-2" href="/dashboard">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-primary text-sm font-black text-primary-foreground">
            SK
          </span>
          <span>
            <span className="block text-lg font-bold leading-none">SKOPI</span>
            <span className="text-xs text-muted-foreground">Real Estate CRM</span>
          </span>
        </Link>

        <nav className="grid gap-1">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
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
                <span className="flex-1">{link.label}</span>
                {link.href === '/visits' && todayVisits.data?.total ? (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                    {todayVisits.data.total}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto rounded-md border bg-background p-3">
          <p className="truncate text-sm font-semibold">{user?.email ?? 'Usuario'}</p>
          <p className="mt-1 text-xs uppercase text-muted-foreground">{user?.role ?? 'agent'}</p>
          <Button className="mt-3 w-full justify-start gap-2" onClick={logout} variant="outline">
            <LogOut className="h-4 w-4" />
            Cerrar sesion
          </Button>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
          const Icon = link.icon

          return (
            <Link
              className={cn(
                'relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-semibold text-muted-foreground',
                active && 'bg-accent text-primary'
              )}
              href={link.href}
              key={link.href}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate">{link.label === 'Dashboard' ? 'Inicio' : link.label}</span>
              {link.href === '/visits' && todayVisits.data?.total ? (
                <span className="absolute right-2 top-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {todayVisits.data.total}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
