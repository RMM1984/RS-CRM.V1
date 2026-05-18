'use client'

import { useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  startOfMonth,
  startOfWeek,
  subMonths
} from 'date-fns'
import { es } from 'date-fns/locale'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  List,
  MapPin,
  Plus,
  RotateCcw,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useContacts } from '@/hooks/useContacts'
import { useOperations } from '@/hooks/useOperations'
import { useProperties } from '@/hooks/useProperties'
import {
  useCalendarUrl,
  useCalendarVisits,
  useCreateVisit,
  useDeleteVisit,
  useUpdateVisit,
  useVisits
} from '@/hooks/useVisits'
import { cn } from '@/lib/utils'
import type { Contact } from '@/types/contacts'
import type { Operation } from '@/types/operations'
import type { Property } from '@/types/properties'
import type { CreateVisitDto, Visit, VisitStatus } from '@/types/visits'

type ViewMode = 'week' | 'month' | 'list'

const statusConfig: Record<VisitStatus, { label: string; className: string }> = {
  scheduled: { label: 'Programada', className: 'border-blue-200 bg-blue-50 text-blue-800' },
  done: { label: 'Realizada', className: 'border-green-200 bg-green-50 text-green-800' },
  cancelled: { label: 'Cancelada', className: 'border-slate-200 bg-slate-100 text-slate-500 line-through' },
  no_show: { label: 'No asistio', className: 'border-orange-200 bg-orange-50 text-orange-800' }
}

const durations = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 h', value: 60 },
  { label: '1.5 h', value: 90 },
  { label: '2 h', value: 120 }
]

const toDatetimeLocal = (date: Date) => {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

const fromDatetimeLocal = (value: string) => new Date(value).toISOString()

const getWeekStartKey = (date: Date) =>
  format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')

const getInitialForm = (): CreateVisitDto & { scheduled_local: string } => {
  const nextHour = new Date()
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0)

  return {
    scheduled_local: toDatetimeLocal(nextHour),
    scheduled_at: nextHour.toISOString(),
    duration_min: 60,
    title: '',
    location: '',
    contact_id: '',
    property_id: '',
    operation_id: '',
    notes: ''
  }
}

const visitTime = (visit: Visit) => format(new Date(visit.scheduled_at), 'HH:mm')
const visitDay = (visit: Visit) => format(new Date(visit.scheduled_at), 'yyyy-MM-dd')

const VisitBadge = ({ status }: { status: VisitStatus }) => (
  <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold', statusConfig[status].className)}>
    {statusConfig[status].label}
  </span>
)

const VisitCard = ({ visit, onOpen }: { visit: Visit; onOpen: (visit: Visit) => void }) => (
  <button
    className={cn(
      'w-full rounded-md border p-2 text-left text-xs shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
      statusConfig[visit.status].className
    )}
    onClick={() => onOpen(visit)}
  >
    <div className="font-bold">{visitTime(visit)}</div>
    <div className="mt-1 truncate font-semibold">{visit.contact_name ?? 'Sin cliente'}</div>
    <div className="truncate opacity-80">{visit.property_title ?? visit.location ?? 'Sin propiedad'}</div>
  </button>
)

const ModalShell = ({
  children,
  title,
  onClose
}: {
  children: React.ReactNode
  title: string
  onClose: () => void
}) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
    <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-md border bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <h2 className="text-lg font-bold">{title}</h2>
        <Button onClick={onClose} size="icon" type="button" variant="ghost">
          <X className="h-4 w-4" />
        </Button>
      </div>
      {children}
    </div>
  </div>
)

const VisitFormModal = ({
  contacts,
  operations,
  properties,
  onClose,
  onCreated
}: {
  contacts: Contact[]
  operations: Operation[]
  properties: Property[]
  onClose: () => void
  onCreated: () => void
}) => {
  const [form, setForm] = useState(getInitialForm)
  const [message, setMessage] = useState<string | null>(null)
  const createVisit = useCreateVisit()
  const selectedProperty = properties.find((property) => property.id === form.property_id)

  const setValue = (key: keyof typeof form, value: string | number | null) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'property_id' && value && !current.location
        ? { location: [selectedProperty?.address, selectedProperty?.city].filter(Boolean).join(', ') }
        : {})
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setMessage(null)

    try {
      await createVisit.mutateAsync({
        title: form.title || null,
        scheduled_at: fromDatetimeLocal(form.scheduled_local),
        duration_min: Number(form.duration_min ?? 60),
        location: form.location || null,
        contact_id: form.contact_id || null,
        property_id: form.property_id || null,
        operation_id: form.operation_id || null,
        notes: form.notes || null
      })
      setMessage('Visita programada. Puedes verla en el calendario o sincronizarla con tu calendario personal.')
      onCreated()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear la visita')
    }
  }

  return (
    <ModalShell onClose={onClose} title="Nueva visita">
      <form className="grid gap-4 p-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Fecha y hora</Label>
            <Input
              required
              type="datetime-local"
              value={form.scheduled_local}
              onChange={(event) => setValue('scheduled_local', event.target.value)}
            />
          </div>
          <div>
            <Label>Duracion</Label>
            <select
              className="h-10 w-full rounded-md border bg-white px-3"
              value={form.duration_min ?? 60}
              onChange={(event) => setValue('duration_min', Number(event.target.value))}
            >
              {durations.map((duration) => (
                <option key={duration.value} value={duration.value}>
                  {duration.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Cliente</Label>
            <select
              className="h-10 w-full rounded-md border bg-white px-3"
              value={form.contact_id ?? ''}
              onChange={(event) => setValue('contact_id', event.target.value)}
            >
              <option value="">Selecciona cliente</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Propiedad</Label>
            <select
              className="h-10 w-full rounded-md border bg-white px-3"
              value={form.property_id ?? ''}
              onChange={(event) => {
                const value = event.target.value
                const property = properties.find((item) => item.id === value)
                setForm((current) => ({
                  ...current,
                  property_id: value,
                  location: current.location || [property?.address, property?.city].filter(Boolean).join(', ')
                }))
              }}
            >
              <option value="">Opcional</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label>Operacion vinculada</Label>
          <select
            className="h-10 w-full rounded-md border bg-white px-3"
            value={form.operation_id ?? ''}
            onChange={(event) => setValue('operation_id', event.target.value)}
          >
            <option value="">Opcional</option>
            {operations.map((operation) => (
              <option key={operation.id} value={operation.id}>
                {operation.contact_name} - {operation.property_title ?? operation.type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>Ubicacion</Label>
          <Input value={form.location ?? ''} onChange={(event) => setValue('location', event.target.value)} />
        </div>

        <div>
          <Label>Notas</Label>
          <Textarea value={form.notes ?? ''} onChange={(event) => setValue('notes', event.target.value)} />
        </div>

        {message ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={createVisit.isPending} type="submit">
            {createVisit.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}

const SyncModal = ({ onClose }: { onClose: () => void }) => {
  const calendarUrl = useCalendarUrl()

  return (
    <ModalShell onClose={onClose} title="Sincroniza con tu calendario">
      <div className="space-y-5 p-5">
        <Button onClick={() => void calendarUrl.refetch()}>
          <CalendarDays className="mr-2 h-4 w-4" />
          Generar URL personal
        </Button>

        {calendarUrl.data ? (
          <div className="rounded-md border bg-slate-50 p-3">
            <Label>URL iCalendar</Label>
            <div className="mt-2 flex gap-2">
              <Input readOnly value={calendarUrl.data.url} />
              <Button
                type="button"
                onClick={() => void navigator.clipboard.writeText(calendarUrl.data?.url ?? '')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 text-sm text-slate-700">
          <p><strong>Google Calendar:</strong> Otros calendarios &gt; Suscribirse con URL.</p>
          <p><strong>Apple Calendar:</strong> Archivo &gt; Nueva suscripcion a calendario.</p>
          <p><strong>Outlook:</strong> Configuracion &gt; Calendarios compartidos &gt; Suscribir.</p>
          <p className="text-muted-foreground">Las visitas apareceran en unos minutos y se actualizaran periodicamente.</p>
        </div>
      </div>
    </ModalShell>
  )
}

const VisitDetail = ({
  visit,
  onClose
}: {
  visit: Visit
  onClose: () => void
}) => {
  const updateVisit = useUpdateVisit()
  const deleteVisit = useDeleteVisit()

  const quickUpdate = (status: VisitStatus) => {
    void updateVisit.mutateAsync({ id: visit.id, payload: { status } })
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-xl overflow-y-auto border-l bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b p-5">
        <div>
          <VisitBadge status={visit.status} />
          <h2 className="mt-2 text-2xl font-bold">{visit.title}</h2>
        </div>
        <Button onClick={onClose} size="icon" variant="ghost">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-5 p-5">
        <Card>
          <CardContent className="space-y-4 p-5">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <Clock className="h-5 w-5 text-primary" />
              {format(new Date(visit.scheduled_at), "EEEE d MMM, HH:mm", { locale: es })}
            </p>
            <p className="text-sm text-muted-foreground">Duracion: {visit.duration_min} minutos</p>
            <p className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-primary" />
              {visit.location ?? visit.property_address ?? 'Ubicacion pendiente'}
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-3 rounded-md border p-4 text-sm">
          <p><strong>Cliente:</strong> {visit.contact_name ?? 'Sin cliente vinculado'}</p>
          <p><strong>Propiedad:</strong> {visit.property_title ?? 'Sin propiedad vinculada'}</p>
          <p><strong>Operacion:</strong> {visit.operation_id ? 'Vinculada' : 'Sin operacion'}</p>
          <p><strong>Agente:</strong> {visit.agent_name ?? 'Sin agente'}</p>
          <p><strong>Notas:</strong> {visit.notes ?? 'Sin notas'}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {visit.status === 'scheduled' ? (
            <>
              <Button onClick={() => quickUpdate('done')}>
                <Check className="mr-2 h-4 w-4" />
                Marcar realizada
              </Button>
              <Button variant="outline" onClick={() => void deleteVisit.mutateAsync(visit.id)}>
                Cancelar
              </Button>
            </>
          ) : null}
          {visit.status === 'cancelled' || visit.status === 'no_show' ? (
            <Button onClick={() => quickUpdate('scheduled')}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reactivar
            </Button>
          ) : null}
          {visit.status === 'done' ? <Button variant="outline">Crear seguimiento</Button> : null}
        </div>
      </div>
    </aside>
  )
}

export default function VisitsPage() {
  const [view, setView] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showCreate, setShowCreate] = useState(false)
  const [showSync, setShowSync] = useState(false)
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null)

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])
  const calendar = useCalendarVisits({ week_start: getWeekStartKey(currentDate) })
  const listFrom = new Date()
  listFrom.setHours(0, 0, 0, 0)
  const visits = useVisits({ from: listFrom.toISOString(), page: 1, limit: 100 })
  const contacts = useContacts({ page: 1, limit: 100 })
  const properties = useProperties({ page: 1, limit: 100, source: 'all' })
  const operations = useOperations({})

  const weekVisits = useMemo(() => Object.values(calendar.data ?? {}).flat(), [calendar.data])
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
    return Array.from({ length: 35 }, (_, index) => addDays(start, index))
  }, [currentDate])

  const monthVisits = visits.data?.visits ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Visitas</h1>
          <p className="text-muted-foreground">{visits.data?.total ?? 0} visitas proximas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-md border bg-white p-1">
            {(['week', 'month', 'list'] as ViewMode[]).map((mode) => (
              <Button
                className={cn(view === mode && 'bg-primary text-primary-foreground')}
                key={mode}
                onClick={() => setView(mode)}
                variant="ghost"
              >
                {mode === 'week' ? 'Sem' : mode === 'month' ? 'Mes' : 'Lista'}
              </Button>
            ))}
          </div>
          <Button onClick={() => setShowSync(true)} variant="outline">
            <CalendarDays className="mr-2 h-4 w-4" />
            Sincronizar
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border bg-white p-3">
        <Button
          variant="ghost"
          onClick={() => setCurrentDate((date) => (view === 'month' ? subMonths(date, 1) : addDays(date, -7)))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="font-semibold">
          {view === 'month'
            ? format(currentDate, 'MMMM yyyy', { locale: es })
            : `${format(weekDays[0], 'd MMM', { locale: es })} - ${format(weekDays[6], 'd MMM yyyy', { locale: es })}`}
        </p>
        <Button
          variant="ghost"
          onClick={() => setCurrentDate((date) => (view === 'month' ? addMonths(date, 1) : addDays(date, 7)))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {view === 'week' ? (
        <div className="grid overflow-hidden rounded-md border bg-white md:grid-cols-7">
          {weekDays.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const dayVisits = (calendar.data?.[key] ?? []) as Visit[]

            return (
              <div className="min-h-80 border-b p-3 md:border-b-0 md:border-r" key={key}>
                <div className="mb-3">
                  <p className="text-xs font-bold uppercase text-muted-foreground">{format(day, 'EEE', { locale: es })}</p>
                  <p className="text-xl font-bold">{format(day, 'd')}</p>
                </div>
                <div className="space-y-2">
                  {dayVisits.map((visit) => (
                    <VisitCard key={visit.id} visit={visit} onOpen={setSelectedVisit} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      {view === 'month' ? (
        <div className="grid overflow-hidden rounded-md border bg-white md:grid-cols-7">
          {monthDays.map((day) => {
            const items = monthVisits.filter((visit) => isSameDay(new Date(visit.scheduled_at), day))
            const outOfMonth = day < startOfMonth(currentDate) || day > endOfMonth(currentDate)

            return (
              <button
                className={cn('min-h-28 border-b border-r p-3 text-left hover:bg-accent', outOfMonth && 'bg-slate-50 text-muted-foreground')}
                key={day.toISOString()}
                onClick={() => setCurrentDate(day)}
              >
                <p className="font-bold">{format(day, 'd')}</p>
                {items.length ? <p className="mt-3 text-sm text-primary">{items.length} visitas</p> : null}
                <div className="mt-2 space-y-1">
                  {items.slice(0, 2).map((visit) => (
                    <p className="truncate rounded bg-blue-50 px-2 py-1 text-xs" key={visit.id}>
                      {visitTime(visit)} {visit.contact_name}
                    </p>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      ) : null}

      {view === 'list' ? (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Propiedad</th>
                  <th className="p-4">Ubicacion</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(visits.data?.visits ?? []).map((visit) => (
                  <tr className="border-t" key={visit.id}>
                    <td className="p-4 font-semibold">{format(new Date(visit.scheduled_at), 'd MMM HH:mm', { locale: es })}</td>
                    <td className="p-4">{visit.contact_name ?? '-'}</td>
                    <td className="p-4">{visit.property_title ?? '-'}</td>
                    <td className="p-4">{visit.location ?? '-'}</td>
                    <td className="p-4"><VisitBadge status={visit.status} /></td>
                    <td className="p-4">
                      <Button size="sm" variant="outline" onClick={() => setSelectedVisit(visit)}>
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {!weekVisits.length && view === 'week' && !calendar.isLoading ? (
        <div className="rounded-md border bg-white p-8 text-center text-muted-foreground">
          No hay visitas programadas esta semana.
          <Button className="ml-3" onClick={() => setShowCreate(true)} variant="outline">
            Programar visita
          </Button>
        </div>
      ) : null}

      {showCreate ? (
        <VisitFormModal
          contacts={contacts.data?.contacts ?? []}
          operations={operations.data ?? []}
          properties={properties.data?.properties ?? []}
          onClose={() => setShowCreate(false)}
          onCreated={() => setView('week')}
        />
      ) : null}
      {showSync ? <SyncModal onClose={() => setShowSync(false)} /> : null}
      {selectedVisit ? <VisitDetail visit={selectedVisit} onClose={() => setSelectedVisit(null)} /> : null}
    </div>
  )
}
