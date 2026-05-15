'use client'

import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BadgeEuro,
  CalendarDays,
  CheckCircle2,
  Home,
  Plus,
  UserRound,
  UsersRound,
  Workflow
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDashboard } from '@/hooks/useDashboard'
import { formatPropertyPrice } from '@/lib/properties-format'
import type { OperationStage } from '@/types/operations'

const stageLabels: Record<OperationStage, string> = {
  lead: 'Lead',
  visit: 'Visita',
  offer: 'Oferta',
  contract: 'Contrato',
  closed: 'Cerrada',
  lost: 'Perdida'
}

const stageBadgeClass: Record<OperationStage, string> = {
  lead: 'bg-slate-100 text-slate-800',
  visit: 'bg-blue-100 text-blue-800',
  offer: 'bg-amber-100 text-amber-900',
  contract: 'bg-violet-100 text-violet-800',
  closed: 'bg-green-100 text-green-800',
  lost: 'bg-rose-100 text-rose-800'
}

const contactTypeClass: Record<string, string> = {
  comprador: 'bg-blue-100 text-blue-800',
  vendedor: 'bg-violet-100 text-violet-800',
  inquilino: 'bg-green-100 text-green-800',
  propietario: 'bg-orange-100 text-orange-800',
  ambos: 'bg-slate-100 text-slate-800'
}

const contactStatusClass: Record<string, string> = {
  activo: 'bg-green-100 text-green-800',
  frio: 'bg-slate-100 text-slate-800',
  cerrado: 'bg-zinc-900 text-white'
}

const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.max(0, Math.floor(diff / 60000))
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? 'hace 1 hora' : `hace ${hours} horas`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'hace 1 dia' : `hace ${days} dias`
}

const visitDate = (date: string) => {
  const value = new Date(date)
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const time = value.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  if (sameDay(value, today)) return `hoy a las ${time}`
  if (sameDay(value, tomorrow)) return `mañana a las ${time}`

  return `${value.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} a las ${time}`
}

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

export default function DashboardPage() {
  const router = useRouter()
  const dashboard = useDashboard()
  const data = dashboard.data
  const isEmpty =
    data &&
    data.metrics.contacts_total === 0 &&
    data.metrics.active_operations === 0 &&
    data.metrics.available_properties === 0

  if (dashboard.isLoading) {
    return <DashboardSkeleton />
  }

  if (!data) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">No se pudo cargar el resumen.</p>
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="rounded-lg border bg-white p-10 text-center shadow-sm">
        <h1 className="text-3xl font-semibold">Bienvenido a RS-CRM</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Empieza creando tus primeros datos para activar el panel operativo.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={() => router.push('/contacts')}><Plus className="mr-2 h-4 w-4" />Añade tu primer contacto</Button>
          <Button variant="outline" onClick={() => router.push('/properties')}><Home className="mr-2 h-4 w-4" />Añade tu primera propiedad</Button>
          <Button variant="outline" onClick={() => router.push('/operations')}><Workflow className="mr-2 h-4 w-4" />Crea tu primera operación</Button>
        </div>
      </div>
    )
  }

  const maxPipeline = Math.max(...Object.values(data.pipeline), 1)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Resumen operativo del CRM inmobiliario.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Workflow}
          label="Operaciones activas"
          value={data.metrics.active_operations}
          subtext={`${data.metrics.new_contacts_this_week} contactos nuevos esta semana`}
          onClick={() => router.push('/operations')}
        />
        <MetricCard
          icon={Home}
          label="Propiedades disponibles"
          value={data.metrics.available_properties}
          subtext="en cartera"
          onClick={() => router.push('/properties')}
        />
        <MetricCard
          icon={CalendarDays}
          label="Visitas hoy"
          value={data.metrics.visits_today}
          subtext="programadas"
          onClick={() => router.push('/visits')}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Cerradas/mes"
          value={data.metrics.closed_this_month}
          subtext="este mes"
          onClick={() => router.push('/operations')}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <section className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Pipeline</h2>
            <Button variant="ghost" onClick={() => router.push('/operations')}>Ver Kanban <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
          <div className="space-y-4">
            {Object.entries(stageLabels).map(([stage, label]) => {
              const count = data.pipeline[stage as OperationStage]
              const width = `${Math.max(6, (count / maxPipeline) * 100)}%`

              return (
                <button
                  key={stage}
                  className="grid w-full grid-cols-[88px_1fr_36px] items-center gap-3 text-left"
                  type="button"
                  onClick={() => router.push(`/operations?stage=${stage}`)}
                >
                  <span className="text-sm font-medium">{label}</span>
                  <span className="h-3 rounded-full bg-slate-100">
                    <span className="block h-3 rounded-full bg-slate-900" style={{ width }} />
                  </span>
                  <span className="text-right text-sm font-semibold">{count}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Próximas visitas</h2>
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
          </div>
          {data.upcoming_visits.length ? (
            <div className="space-y-3">
              {data.upcoming_visits.map((visit) => (
                <div key={visit.id} className="rounded-md border p-3">
                  <p className="font-semibold">{visitDate(visit.scheduled_at)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{visit.contact_name}</p>
                  <p className="truncate text-sm">{visit.property_title}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 font-semibold text-white">
                      {initials(visit.agent_name || 'RS')}
                    </span>
                    {visit.agent_name || 'Sin agente'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-6 text-center">
              <p className="text-muted-foreground">No hay visitas programadas</p>
              <Button className="mt-4" variant="outline" onClick={() => router.push('/visits')}>
                Programar visita <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Contactos recientes</h2>
            <Button variant="ghost" onClick={() => router.push('/contacts')}>Ver todos <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
          <div className="space-y-3">
            {data.recent_contacts.map((contact) => (
              <button key={contact.id} className="flex w-full items-center gap-3 rounded-md border p-3 text-left hover:bg-muted" onClick={() => router.push('/contacts')}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {initials(contact.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{contact.name}</span>
                  <span className="mt-1 flex flex-wrap gap-2">
                    <Badge className={contactTypeClass[contact.type] ?? 'bg-slate-100 text-slate-800'}>{contact.type}</Badge>
                    <Badge className={contactStatusClass[contact.status] ?? 'bg-slate-100 text-slate-800'}>{contact.status}</Badge>
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">{timeAgo(contact.created_at)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Últimas operaciones</h2>
            <Button variant="ghost" onClick={() => router.push('/operations')}>Ver todas <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
          <div className="space-y-3">
            {data.recent_operations.map((operation) => (
              <button key={operation.id} className="flex w-full items-center gap-3 rounded-md border p-3 text-left hover:bg-muted" onClick={() => router.push('/operations')}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <BadgeEuro className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{operation.contact_name}</span>
                  <span className="block truncate text-sm text-muted-foreground">{operation.property_title || 'Sin propiedad vinculada'}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <Badge className={stageBadgeClass[operation.stage]}>{stageLabels[operation.stage]}</Badge>
                  <span className="text-sm font-semibold">{Number(operation.value) > 0 ? formatPropertyPrice(operation.value, operation.type) : '-'}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

const MetricCard = ({
  icon: Icon,
  label,
  onClick,
  subtext,
  value
}: {
  icon: typeof Workflow
  label: string
  onClick: () => void
  subtext: string
  value: number
}) => (
  <button className="rounded-lg border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" onClick={onClick}>
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <p className="mt-5 text-4xl font-semibold">{value}</p>
    <p className="mt-2 text-sm text-muted-foreground">{subtext}</p>
  </button>
)

const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="h-16 w-72 animate-pulse rounded-lg bg-muted" />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-36 animate-pulse rounded-lg border bg-muted" />
      ))}
    </div>
    <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
      <div className="h-80 animate-pulse rounded-lg border bg-muted" />
      <div className="h-80 animate-pulse rounded-lg border bg-muted" />
    </div>
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="h-80 animate-pulse rounded-lg border bg-muted" />
      <div className="h-80 animate-pulse rounded-lg border bg-muted" />
    </div>
  </div>
)
