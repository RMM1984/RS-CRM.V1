'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useDraggable } from '@dnd-kit/core'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  CalendarDays,
  CheckCircle2,
  Euro,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
  XCircle
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import { useAgents, useContacts } from '@/hooks/useContacts'
import {
  useCreateOperation,
  useDeleteOperation,
  useKanban,
  useOperations,
  useUpdateOperation,
  useUpdateStage
} from '@/hooks/useOperations'
import { useProperties } from '@/hooks/useProperties'
import { formatPropertyPrice } from '@/lib/properties-format'
import type {
  CreateOperationDto,
  KanbanData,
  Operation,
  OperationFilters,
  OperationStage,
  OperationType
} from '@/types/operations'

const stages: Array<{ id: OperationStage; label: string; className: string }> = [
  { id: 'lead', label: 'Lead', className: 'bg-slate-100 text-slate-800 border-slate-200' },
  { id: 'visit', label: 'Visita', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'offer', label: 'Oferta', className: 'bg-amber-100 text-amber-900 border-amber-200' },
  { id: 'contract', label: 'Contrato', className: 'bg-violet-100 text-violet-800 border-violet-200' },
  { id: 'closed', label: 'Cerrada', className: 'bg-green-100 text-green-800 border-green-200' },
  { id: 'lost', label: 'Perdida', className: 'bg-rose-100 text-rose-800 border-rose-200' }
]

const stageLabels = stages.reduce<Record<OperationStage, string>>((acc, stage) => {
  acc[stage.id] = stage.label
  return acc
}, { lead: '', visit: '', offer: '', contract: '', closed: '', lost: '' })

const stageClasses = stages.reduce<Record<OperationStage, string>>((acc, stage) => {
  acc[stage.id] = stage.className
  return acc
}, { lead: '', visit: '', offer: '', contract: '', closed: '', lost: '' })

const typeLabels: Record<OperationType, string> = {
  sale: 'Venta',
  rent: 'Alquiler'
}

const operationSchema = z.object({
  contact_id: z.string().uuid('Selecciona un contacto'),
  property_id: z.string().optional().nullable(),
  type: z.enum(['sale', 'rent']),
  stage: z.enum(['lead', 'visit', 'offer', 'contract', 'closed', 'lost']),
  value: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
  agent_id: z.string().optional().nullable()
})

type OperationForm = z.infer<typeof operationSchema>

const emptyKanban: KanbanData = {
  lead: [],
  visit: [],
  offer: [],
  contract: [],
  closed: [],
  lost: []
}

const daysAgo = (date: string) => {
  const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000))
  if (days === 0) return 'hoy'
  if (days === 1) return 'hace 1 dia'
  return `hace ${days} dias`
}

const initials = (name?: string | null) =>
  (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

const isDeletedContact = (operation: Operation) => operation.contact_name === 'Contacto eliminado'

const asNumber = (value: unknown) => {
  if (value === '' || value === undefined || value === null) return null
  return Number(value)
}

export default function OperationsPage() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const initialStage = searchParams.get('stage') as OperationStage | null
  const [filters, setFilters] = useState<OperationFilters>({
    type: 'all',
    agent_id: 'all',
    stage: initialStage && stages.some((stage) => stage.id === initialStage) ? initialStage : 'all'
  })
  const [modalStage, setModalStage] = useState<OperationStage>('lead')
  const [editing, setEditing] = useState<Operation | null>(null)
  const [selected, setSelected] = useState<Operation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Operation | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [contactSearch, setContactSearch] = useState('')
  const [propertySearch, setPropertySearch] = useState('')
  const kanbanQuery = useKanban(filters)
  const listQuery = useOperations(filters)
  const contactsQuery = useContacts({ type: 'todos', status: 'todos', search: contactSearch, page: 1, limit: 20 })
  const propertiesQuery = useProperties({
    type: 'all',
    operation: 'all',
    status: 'all',
    source: 'all',
    search: propertySearch,
    page: 1,
    limit: 20
  })
  const agentsQuery = useAgents(Boolean(isAdmin))
  const createOperation = useCreateOperation()
  const updateOperation = useUpdateOperation()
  const updateStage = useUpdateStage()
  const deleteOperation = useDeleteOperation()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const form = useForm<OperationForm>({
    resolver: zodResolver(operationSchema),
    defaultValues: {
      contact_id: '',
      property_id: '',
      type: 'sale',
      stage: 'lead',
      value: null,
      notes: '',
      agent_id: ''
    }
  })

  const kanban = kanbanQuery.data ?? emptyKanban
  const operations = useMemo(() => Object.values(kanban).flat(), [kanban])
  const listOperations = listQuery.data ?? operations
  const activeOperation = activeId ? operations.find((operation) => operation.id === activeId) : null
  const total = operations.length

  const openCreate = (stage: OperationStage) => {
    setEditing(null)
    setModalStage(stage)
    form.reset({
      contact_id: '',
      property_id: '',
      type: 'sale',
      stage,
      value: null,
      notes: '',
      agent_id: ''
    })
    setIsModalOpen(true)
  }

  const openEdit = (operation: Operation) => {
    setEditing(operation)
    setModalStage(operation.stage)
    form.reset({
      contact_id: operation.contact_id,
      property_id: operation.property_id ?? '',
      type: operation.type,
      stage: operation.stage,
      value: asNumber(operation.value),
      notes: operation.notes ?? '',
      agent_id: operation.agent_id ?? ''
    })
    setIsModalOpen(true)
  }

  const onSave = async (values: OperationForm) => {
    const payload: CreateOperationDto = {
      contact_id: values.contact_id,
      property_id: values.property_id || null,
      type: values.type,
      stage: values.stage,
      value: values.value ?? 0,
      notes: values.notes || null,
      agent_id: values.agent_id || null
    }

    if (editing) {
      await updateOperation.mutateAsync({ id: editing.id, payload })
    } else {
      await createOperation.mutateAsync(payload)
    }

    setIsModalOpen(false)
    setEditing(null)
  }

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const id = String(event.active.id)
    const stage = event.over?.id as OperationStage | undefined
    const operation = operations.find((item) => item.id === id)

    if (!stage || !operation || stage === operation.stage) return
    await updateStage.mutateAsync({ id, stage })
  }

  const remove = (operation: Operation) => {
    setDeleteTarget(operation)
  }

  const confirmDeleteOperation = async () => {
    if (!deleteTarget) return
    setConfirmLoading(true)
    try {
      await deleteOperation.mutateAsync(deleteTarget.id)
      if (selected?.id === deleteTarget.id) setSelected(null)
      setNotice({ type: 'success', message: 'Operacion eliminada correctamente.' })
    } catch {
      setNotice({ type: 'error', message: 'No se pudo eliminar la operacion.' })
    } finally {
      setConfirmLoading(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Operaciones</h1>
          <p className="text-muted-foreground">{total} operaciones activas</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-md border bg-background p-1">
            <Button size="sm" variant={view === 'kanban' ? 'default' : 'ghost'} onClick={() => setView('kanban')}>
              Kanban
            </Button>
            <Button size="sm" variant={view === 'list' ? 'default' : 'ghost'} onClick={() => setView('list')}>
              Lista
            </Button>
          </div>
          <Button onClick={() => openCreate('lead')}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva operacion
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border bg-background p-4 shadow-sm md:grid-cols-3">
        <FilterSelect
          label="Tipo"
          value={filters.type ?? 'all'}
          onChange={(value) => setFilters((current) => ({ ...current, type: value as OperationType | 'all' }))}
          options={[
            ['all', 'Todos'],
            ['sale', 'Venta'],
            ['rent', 'Alquiler']
          ]}
        />
        <FilterSelect
          label="Stage"
          value={filters.stage ?? 'all'}
          onChange={(value) => setFilters((current) => ({ ...current, stage: value as OperationStage | 'all' }))}
          options={[
            ['all', 'Todos'],
            ...stages.map((stage) => [stage.id, stage.label] as [string, string])
          ]}
        />
        {isAdmin ? (
          <FilterSelect
            label="Agente"
            value={filters.agent_id ?? 'all'}
            onChange={(value) => setFilters((current) => ({ ...current, agent_id: value }))}
            options={[
              ['all', 'Todos'],
              ...(agentsQuery.data ?? []).map((agent) => [agent.id, agent.full_name || agent.email] as [string, string])
            ]}
          />
        ) : null}
      </div>

      {view === 'kanban' ? (
        <DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={onDragEnd} onDragStart={onDragStart}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                operations={kanban[stage.id] ?? []}
                stage={stage}
                onAdd={() => openCreate(stage.id)}
                onDelete={remove}
                onEdit={openEdit}
                onSelect={setSelected}
                onStage={(operation, nextStage) => updateStage.mutateAsync({ id: operation.id, stage: nextStage })}
              />
            ))}
          </div>
          <DragOverlay>{activeOperation ? <OperationCard operation={activeOperation} /> : null}</DragOverlay>
        </DndContext>
      ) : (
        <OperationsTable operations={listOperations} onDelete={remove} onEdit={openEdit} onSelect={setSelected} />
      )}

      {isModalOpen ? (
        <OperationModal
          agents={agentsQuery.data ?? []}
          contacts={contactsQuery.data?.contacts ?? []}
          contactSearch={contactSearch}
          form={form}
          isAdmin={Boolean(isAdmin)}
          isEditing={Boolean(editing)}
          loading={createOperation.isPending || updateOperation.isPending}
          properties={propertiesQuery.data?.properties ?? []}
          propertySearch={propertySearch}
          stage={modalStage}
          onClose={() => setIsModalOpen(false)}
          onContactSearch={setContactSearch}
          onPropertySearch={setPropertySearch}
          onSubmit={onSave}
        />
      ) : null}

      {selected ? (
        <OperationDrawer
          operation={selected}
          onClose={() => setSelected(null)}
          onEdit={openEdit}
          onStage={(stage) => updateStage.mutateAsync({ id: selected.id, stage })}
        />
      ) : null}

      <ConfirmDialog
        danger
        confirmLabel="Si, eliminar"
        isOpen={Boolean(deleteTarget)}
        loading={confirmLoading}
        message={
          deleteTarget
            ? `Se eliminara la operacion de ${deleteTarget.contact_name}. Esta accion no se puede deshacer.`
            : ''
        }
        title="Eliminar esta operacion?"
        onCancel={() => {
          if (!confirmLoading) setDeleteTarget(null)
        }}
        onConfirm={() => void confirmDeleteOperation()}
      />

      {notice ? (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-md border px-4 py-3 text-sm shadow-lg ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {notice.message}
        </div>
      ) : null}
    </div>
  )
}

const KanbanColumn = ({
  operations,
  stage,
  onAdd,
  onDelete,
  onEdit,
  onSelect,
  onStage
}: {
  operations: Operation[]
  stage: { id: OperationStage; label: string; className: string }
  onAdd: () => void
  onDelete: (operation: Operation) => void
  onEdit: (operation: Operation) => void
  onSelect: (operation: Operation) => void
  onStage: (operation: Operation, stage: OperationStage) => void
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <section className="flex h-[calc(100vh-280px)] min-h-[520px] w-80 shrink-0 flex-col rounded-lg border bg-white shadow-sm">
      <div className={`flex items-center justify-between border-b px-4 py-3 ${stage.className}`}>
        <h2 className="font-semibold">{stage.label}</h2>
        <Badge className="bg-white/80 text-slate-900">{operations.length}</Badge>
      </div>
      <div ref={setNodeRef} className={`flex-1 space-y-3 overflow-y-auto p-3 ${isOver ? 'bg-primary/5' : ''}`}>
        {operations.length ? (
          operations.map((operation) => (
            <DraggableOperationCard
              key={operation.id}
              operation={operation}
              onDelete={onDelete}
              onEdit={onEdit}
              onSelect={onSelect}
              onStage={onStage}
            />
          ))
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sin operaciones
          </div>
        )}
      </div>
      <div className="border-t p-3">
        <Button className="w-full" variant="outline" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Añadir
        </Button>
      </div>
    </section>
  )
}

const DraggableOperationCard = (props: {
  operation: Operation
  onDelete: (operation: Operation) => void
  onEdit: (operation: Operation) => void
  onSelect: (operation: Operation) => void
  onStage: (operation: Operation, stage: OperationStage) => void
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: props.operation.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={isDragging ? 'opacity-40' : ''}
      {...listeners}
      {...attributes}
    >
      <OperationCard {...props} />
    </div>
  )
}

const OperationCard = ({
  operation,
  onDelete,
  onEdit,
  onSelect,
  onStage
}: {
  operation: Operation
  onDelete?: (operation: Operation) => void
  onEdit?: (operation: Operation) => void
  onSelect?: (operation: Operation) => void
  onStage?: (operation: Operation, stage: OperationStage) => void
}) => {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <article className="relative rounded-lg border bg-background p-4 shadow-sm">
      <button className="block w-full text-left" type="button" onClick={() => onSelect?.(operation)}>
        <h3 className="line-clamp-2 min-h-12 font-semibold">
          {operation.property_title || (operation.type === 'sale' ? 'Operacion de venta' : 'Operacion de alquiler')}
        </h3>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <UserRound className="h-4 w-4" />
            <span className={isDeletedContact(operation) ? 'text-slate-400' : undefined}>{operation.contact_name}</span>
          </p>
          {Number(operation.value) > 0 ? (
            <p className="flex items-center gap-2">
              <Euro className="h-4 w-4" />
              {formatPropertyPrice(operation.value, operation.type)}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <Badge className={operation.type === 'sale' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}>
              {typeLabels[operation.type].toUpperCase()}
            </Badge>
            <span className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4" />
              {daysAgo(operation.created_at)}
            </span>
          </div>
        </div>
      </button>
      <div className="mt-4 flex items-center justify-between border-t pt-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {initials(operation.agent_name || operation.agent_email)}
        </div>
        <div className="relative">
          <Button size="icon" variant="ghost" onClick={() => setMenuOpen((open) => !open)}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          {menuOpen ? (
            <div className="absolute right-0 z-20 w-44 rounded-md border bg-white p-1 shadow-lg">
              <MenuButton icon={Eye} label="Ver detalle" onClick={() => onSelect?.(operation)} />
              <MenuButton icon={Pencil} label="Editar" onClick={() => onEdit?.(operation)} />
              <select
                className="my-1 h-9 w-full rounded-md border px-2 text-sm"
                value={operation.stage}
                onChange={(event) => onStage?.(operation, event.target.value as OperationStage)}
              >
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    Mover a {stage.label}
                  </option>
                ))}
              </select>
              <MenuButton icon={CheckCircle2} label="Cerrar" onClick={() => onStage?.(operation, 'closed')} />
              <MenuButton icon={XCircle} label="Perdida" onClick={() => onStage?.(operation, 'lost')} />
              <MenuButton icon={Trash2} label="Eliminar" onClick={() => onDelete?.(operation)} />
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}

const OperationsTable = ({
  operations,
  onDelete,
  onEdit,
  onSelect
}: {
  operations: Operation[]
  onDelete: (operation: Operation) => void
  onEdit: (operation: Operation) => void
  onSelect: (operation: Operation) => void
}) => (
  <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Contacto</th>
            <th className="px-4 py-3">Propiedad</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Stage</th>
            <th className="px-4 py-3">Agente</th>
            <th className="px-4 py-3">Valor</th>
            <th className="px-4 py-3">Dias</th>
            <th className="px-4 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {operations.map((operation) => (
            <tr key={operation.id} className="border-t">
              <td className={`px-4 py-3 font-medium ${isDeletedContact(operation) ? 'text-slate-400' : ''}`}>{operation.contact_name}</td>
              <td className="px-4 py-3">{operation.property_title || '-'}</td>
              <td className="px-4 py-3">{typeLabels[operation.type]}</td>
              <td className="px-4 py-3">
                <Badge className={stageClasses[operation.stage]}>{stageLabels[operation.stage]}</Badge>
              </td>
              <td className="px-4 py-3">{operation.agent_name || operation.agent_email || '-'}</td>
              <td className="px-4 py-3">{Number(operation.value) > 0 ? formatPropertyPrice(operation.value, operation.type) : '-'}</td>
              <td className="px-4 py-3">{daysAgo(operation.created_at)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => onSelect(operation)}><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => onEdit(operation)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => onDelete(operation)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)

const OperationModal = ({
  agents,
  contacts,
  contactSearch,
  form,
  isAdmin,
  isEditing,
  loading,
  properties,
  propertySearch,
  onClose,
  onContactSearch,
  onPropertySearch,
  onSubmit
}: {
  agents: Array<{ id: string; email: string; full_name: string }>
  contacts: Array<{ id: string; name: string; email: string | null; phone: string | null }>
  contactSearch: string
  form: ReturnType<typeof useForm<OperationForm>>
  isAdmin: boolean
  isEditing: boolean
  loading: boolean
  properties: Array<{ id: string; title: string; price: string | number }>
  propertySearch: string
  stage: OperationStage
  onClose: () => void
  onContactSearch: (value: string) => void
  onPropertySearch: (value: string) => void
  onSubmit: (values: OperationForm) => Promise<void>
}) => (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
    <form className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{isEditing ? 'Editar operacion' : 'Nueva operacion'}</h2>
        <Button size="icon" type="button" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Contacto" error={form.formState.errors.contact_id?.message}>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar contacto" value={contactSearch} onChange={(event) => onContactSearch(event.target.value)} />
          </div>
          <select className="mt-2 h-10 w-full rounded-md border px-3 text-sm" {...form.register('contact_id')}>
            <option value="">Selecciona contacto</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>{contact.name} {contact.phone ? `- ${contact.phone}` : ''}</option>
            ))}
          </select>
        </Field>
        <Field label="Propiedad" error={form.formState.errors.property_id?.message}>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar propiedad" value={propertySearch} onChange={(event) => onPropertySearch(event.target.value)} />
          </div>
          <select className="mt-2 h-10 w-full rounded-md border px-3 text-sm" {...form.register('property_id')}>
            <option value="">Sin propiedad</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>{property.title}</option>
            ))}
          </select>
        </Field>
        <Field label="Tipo" error={form.formState.errors.type?.message}>
          <select className="h-10 w-full rounded-md border px-3 text-sm" {...form.register('type')}>
            <option value="sale">Venta</option>
            <option value="rent">Alquiler</option>
          </select>
        </Field>
        <Field label="Stage" error={form.formState.errors.stage?.message}>
          <select className="h-10 w-full rounded-md border px-3 text-sm" {...form.register('stage')}>
            {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
          </select>
        </Field>
        <Field label="Valor estimado (€)" error={form.formState.errors.value?.message}>
          <Input type="number" min={0} {...form.register('value')} />
        </Field>
        {isAdmin ? (
          <Field label="Agente" error={form.formState.errors.agent_id?.message}>
            <select className="h-10 w-full rounded-md border px-3 text-sm" {...form.register('agent_id')}>
              <option value="">Yo / sin cambiar</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.full_name || agent.email}</option>
              ))}
            </select>
          </Field>
        ) : null}
        <div className="md:col-span-2">
          <Field label="Notas" error={form.formState.errors.notes?.message}>
            <Textarea {...form.register('notes')} />
          </Field>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button disabled={loading} type="submit">{loading ? 'Guardando...' : 'Guardar'}</Button>
      </div>
    </form>
  </div>
)

const OperationDrawer = ({
  operation,
  onClose,
  onEdit,
  onStage
}: {
  operation: Operation
  onClose: () => void
  onEdit: (operation: Operation) => void
  onStage: (stage: OperationStage) => void
}) => (
  <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-xl overflow-y-auto border-l bg-white shadow-2xl">
    <div className="sticky top-0 flex items-center justify-between border-b bg-white p-6">
      <div>
        <h2 className="text-2xl font-semibold">Detalle de operacion</h2>
        <div className="mt-2 flex gap-2">
          <Badge className={operation.type === 'sale' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}>{typeLabels[operation.type]}</Badge>
          <Badge className={stageClasses[operation.stage]}>{stageLabels[operation.stage]}</Badge>
        </div>
      </div>
      <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
    </div>
    <div className="space-y-5 p-6">
      <Info label="Contacto" value={`${operation.contact_name}${operation.contact_phone ? ` · ${operation.contact_phone}` : ''}`} />
      <Info label="Propiedad" value={operation.property_title || 'Sin propiedad vinculada'} />
      <Info label="Valor estimado" value={Number(operation.value) > 0 ? formatPropertyPrice(operation.value, operation.type) : 'Sin valor'} />
      <Info label="Agente" value={operation.agent_name || operation.agent_email || 'Sin agente'} />
      <Info label="Fecha creacion" value={`${new Date(operation.created_at).toLocaleDateString('es-ES')} · ${daysAgo(operation.created_at)}`} />
      <Info label="Notas" value={operation.notes || 'Sin notas'} />
      <div>
        <label className="text-sm font-semibold text-muted-foreground">Cambiar stage</label>
        <select className="mt-2 h-10 w-full rounded-md border px-3 text-sm" value={operation.stage} onChange={(event) => onStage(event.target.value as OperationStage)}>
          {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onEdit(operation)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
        <Button variant="outline" onClick={() => onStage('closed')}>Cerrar operacion</Button>
        <Button variant="outline" onClick={() => onStage('lost')}>Marcar como perdida</Button>
      </div>
    </div>
  </aside>
)

const FilterSelect = ({
  label,
  options,
  value,
  onChange
}: {
  label: string
  options: Array<[string, string]>
  value: string
  onChange: (value: string) => void
}) => (
  <label className="space-y-2 text-sm font-medium">
    <span>{label}</span>
    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map(([optionValue, optionLabel]) => (
        <option key={optionValue} value={optionValue}>{optionLabel}</option>
      ))}
    </select>
  </label>
)

const Field = ({ children, error, label }: { children: React.ReactNode; error?: string; label: string }) => (
  <label className="space-y-2 text-sm font-medium">
    <span>{label}</span>
    {children}
    {error ? <span className="block text-xs text-red-600">{error}</span> : null}
  </label>
)

const Info = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border p-4">
    <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
    <p className="mt-1 text-base font-medium">{value}</p>
  </div>
)

const MenuButton = ({
  icon: Icon,
  label,
  onClick
}: {
  icon: typeof Eye
  label: string
  onClick: () => void
}) => (
  <button className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted" type="button" onClick={onClick}>
    <Icon className="h-4 w-4" />
    {label}
  </button>
)
