'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, FolderOpen, Home, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import {
  useAddInteraction,
  useAgents,
  useContact,
  useContacts,
  useCreateContact,
  useDeleteContact,
  useUpdateContact
} from '@/hooks/useContacts'
import { useRemoveFromShortlist, useShortlist, useUpdateShortlistItem } from '@/hooks/useProperties'
import { formatPropertyPrice } from '@/lib/properties-format'
import { cn } from '@/lib/utils'
import type {
  AddInteractionDto,
  ClientProfile,
  Contact,
  ContactFilters,
  ContactSource,
  ContactStatus,
  ContactType,
  InteractionType
} from '@/types/contacts'
import type { ShortlistItem, ShortlistStatus } from '@/types/properties'

const typeOptions: Array<{ value: ContactType | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'comprador', label: 'Comprador' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'inquilino', label: 'Inquilino' },
  { value: 'propietario', label: 'Propietario' }
]

const statusOptions: Array<{ value: ContactStatus | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'activo', label: 'Activo' },
  { value: 'frio', label: 'Frio' },
  { value: 'cerrado', label: 'Cerrado' }
]

const sourceOptions: Array<{ value: ContactSource; label: string }> = [
  { value: 'web', label: 'Web' },
  { value: 'referral', label: 'Referral' },
  { value: 'portal', label: 'Portal' },
  { value: 'manual', label: 'Manual' }
]

const interactionOptions: Array<{ value: InteractionType; label: string; icon: string }> = [
  { value: 'call', label: 'Llamada', icon: 'Telefono' },
  { value: 'email', label: 'Email', icon: 'Email' },
  { value: 'note', label: 'Nota', icon: 'Nota' },
  { value: 'whatsapp', label: 'WhatsApp', icon: 'WhatsApp' },
  { value: 'visit', label: 'Visita', icon: 'Visita' }
]

const shortlistStatusOptions: Array<{ value: ShortlistStatus; label: string }> = [
  { value: 'investigating', label: 'Investigando' },
  { value: 'visit_pending', label: 'Visita pendiente' },
  { value: 'interested', label: 'Interesado' },
  { value: 'discarded', label: 'Descartado' }
]

const clientProfileOptions: Array<{ value: ClientProfile; label: string }> = [
  { value: 'investor_yield', label: 'Inversor rentabilidad' },
  { value: 'investor_flip', label: 'Inversor reforma' },
  { value: 'first_home', label: 'Primera vivienda' },
  { value: 'second_home', label: 'Segunda residencia' },
  { value: 'foreign', label: 'Cliente extranjero' },
  { value: 'digital_nomad', label: 'Nomada digital' },
  { value: 'luxury_standard', label: 'Lujo estandar' },
  { value: 'luxury_premium', label: 'Lujo premium' }
]

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Nombre obligatorio'),
  phone: z.string().trim().optional(),
  email: z.string().trim().email('Email invalido').or(z.literal('')).optional(),
  type: z.enum(['comprador', 'vendedor', 'inquilino', 'propietario', 'ambos']),
  source: z.enum(['web', 'referral', 'portal', 'manual']).optional(),
  status: z.enum(['activo', 'frio', 'cerrado']),
  notes: z.string().trim().optional(),
  assigned_to: z.string().optional()
})

const interactionSchema = z.object({
  type: z.enum(['call', 'email', 'note', 'whatsapp', 'visit']),
  content: z.string().trim().min(1, 'Escribe una interaccion')
})

type ContactForm = z.infer<typeof contactSchema>
type InteractionForm = z.infer<typeof interactionSchema>

const emptyContactValues: ContactForm = {
  name: '',
  phone: '',
  email: '',
  type: 'comprador',
  source: 'manual',
  status: 'activo',
  notes: '',
  assigned_to: ''
}

const typeStyles: Record<ContactType, string> = {
  comprador: 'bg-blue-100 text-blue-700',
  vendedor: 'bg-purple-100 text-purple-700',
  inquilino: 'bg-green-100 text-green-700',
  propietario: 'bg-orange-100 text-orange-700',
  ambos: 'bg-sky-100 text-sky-700'
}

const statusStyles: Record<ContactStatus, string> = {
  activo: 'bg-emerald-100 text-emerald-700',
  frio: 'bg-slate-200 text-slate-700',
  cerrado: 'bg-slate-900 text-white'
}

const avatarStyles: Record<ContactType, string> = {
  comprador: 'bg-blue-600',
  vendedor: 'bg-purple-600',
  inquilino: 'bg-green-600',
  propietario: 'bg-orange-600',
  ambos: 'bg-sky-600'
}

const normalizeForm = (values: ContactForm) => ({
  ...values,
  email: values.email || null,
  phone: values.phone || null,
  source: values.source || null,
  notes: values.notes || null,
  assigned_to: values.assigned_to || null
})

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

const relativeDate = (date: string) => {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 60) {
    return `hace ${Math.max(1, minutes)} min`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `hace ${hours} h`
  }

  return `hace ${Math.floor(hours / 24)} dias`
}

export default function ContactsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [filters, setFilters] = useState<ContactFilters>({
    type: 'todos',
    status: 'todos',
    search: '',
    page: 1,
    limit: 20
  })
  const [modalContact, setModalContact] = useState<Contact | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [panelTab, setPanelTab] = useState<'datos' | 'actividad' | 'expediente'>('datos')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [operationItem, setOperationItem] = useState<ShortlistItem | null>(null)
  const [confirmAction, setConfirmAction] = useState<
    | { type: 'contact'; id: string; name: string }
    | { type: 'shortlist'; id: string; propertyTitle: string; contactName: string }
    | null
  >(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const contactsQuery = useContacts(filters)
  const contactQuery = useContact(selectedContactId)
  const agentsQuery = useAgents(user?.role === 'admin')
  const createContact = useCreateContact()
  const updateContact = useUpdateContact()
  const deleteContact = useDeleteContact()
  const addInteraction = useAddInteraction(selectedContactId)
  const shortlistQuery = useShortlist(selectedContactId)
  const updateShortlistItem = useUpdateShortlistItem()
  const removeFromShortlist = useRemoveFromShortlist()

  const form = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: emptyContactValues,
    mode: 'onChange'
  })

  const interactionForm = useForm<InteractionForm>({
    resolver: zodResolver(interactionSchema),
    defaultValues: {
      type: 'note',
      content: ''
    }
  })

  const contacts = contactsQuery.data?.contacts ?? []
  const total = contactsQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / filters.limit))
  const contactsError =
    contactsQuery.error instanceof Error
      ? contactsQuery.error.message
      : contactsQuery.error
        ? 'No se pudo cargar la lista de contactos'
        : null

  const selectedContact = contactQuery.data
  const shortlistCount = shortlistQuery.data?.length ?? 0

  const modalTitle = modalContact ? 'Editar contacto' : 'Nuevo contacto'
  const canAssign = user?.role === 'admin'

  useEffect(() => {
    if (!isModalOpen) {
      return
    }

    if (modalContact) {
      form.reset({
        name: modalContact.name,
        phone: modalContact.phone ?? '',
        email: modalContact.email ?? '',
        type: modalContact.type,
        source: modalContact.source ?? 'manual',
        status: modalContact.status,
        notes: modalContact.notes ?? '',
        assigned_to: modalContact.assigned_to ?? ''
      })
    } else {
      form.reset(emptyContactValues)
    }
  }, [form, isModalOpen, modalContact])

  useEffect(() => {
    const contactId = searchParams.get('contactId')
    const tab = searchParams.get('tab')

    if (contactId) {
      setSelectedContactId(contactId)
      setPanelTab(tab === 'expediente' ? 'expediente' : 'datos')
    }
  }, [searchParams])

  const onSaveContact = async (values: ContactForm) => {
    const payload = normalizeForm(values)

    if (modalContact) {
      await updateContact.mutateAsync({ id: modalContact.id, payload })
    } else {
      await createContact.mutateAsync(payload)
    }

    setIsModalOpen(false)
    setModalContact(null)
  }

  const onAddInteraction = async (values: InteractionForm) => {
    await addInteraction.mutateAsync(values as AddInteractionDto)
    interactionForm.reset({ type: 'note', content: '' })
  }

  const runConfirmedAction = async () => {
    if (!confirmAction) return

    setConfirmLoading(true)
    try {
      if (confirmAction.type === 'contact') {
        await deleteContact.mutateAsync(confirmAction.id)
        setNotice({ type: 'success', message: `Contacto ${confirmAction.name} eliminado.` })
        if (selectedContactId === confirmAction.id) setSelectedContactId(null)
      } else {
        await removeFromShortlist.mutateAsync(confirmAction.id)
        setNotice({ type: 'success', message: `${confirmAction.propertyTitle} eliminado del expediente.` })
      }
    } catch {
      setNotice({ type: 'error', message: 'No se pudo completar la accion. Intentalo de nuevo.' })
    } finally {
      setConfirmLoading(false)
      setConfirmAction(null)
    }
  }

  const skeletonRows = useMemo(() => Array.from({ length: 6 }, (_, index) => index), [])

  return (
    <div className="grid gap-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Contactos</h2>
          <p className="text-sm text-muted-foreground">{total} contactos en total</p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            setModalContact(null)
            setIsModalOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          Nuevo contacto
        </Button>
      </section>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                type: event.target.value as ContactFilters['type'],
                page: 1
              }))
            }
            value={filters.type}
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value as ContactFilters['status'],
                page: 1
              }))
            }
            value={filters.status}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="relative min-w-72 flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                  page: 1
                }))
              }
              placeholder="Buscar por nombre, email o telefono"
              value={filters.search}
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {contactsError ? (
          <div className="border-b bg-red-50 px-4 py-3 text-sm text-red-700">
            Error al cargar contactos: {contactsError}
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Telefono</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Agente</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {contactsQuery.isLoading
                ? skeletonRows.map((row) => (
                    <tr className="border-t" key={row}>
                      <td className="px-4 py-4" colSpan={8}>
                        <div className="h-10 animate-pulse rounded-md bg-muted" />
                      </td>
                    </tr>
                  ))
                : null}

              {!contactsQuery.isLoading && !contactsError && contacts.length === 0 ? (
                <tr>
                  <td className="px-4 py-14 text-center text-muted-foreground" colSpan={8}>
                    No hay contactos con estos filtros.
                  </td>
                </tr>
              ) : null}

              {contacts.map((contact) => (
                <tr className="border-t" key={contact.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'grid h-10 w-10 place-items-center rounded-full text-xs font-bold text-white',
                          avatarStyles[contact.type]
                        )}
                      >
                        {initials(contact.name)}
                      </span>
                      <span className="font-medium">{contact.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={typeStyles[contact.type]}>{contact.type}</Badge>
                  </td>
                  <td className="px-4 py-3">{contact.phone ?? '-'}</td>
                  <td className="px-4 py-3">{contact.email ?? '-'}</td>
                  <td className="px-4 py-3">
                    <Badge className={statusStyles[contact.status]}>
                      {contact.status === 'frio' ? 'frio' : contact.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{contact.assigned_to ?? '-'}</td>
                  <td className="px-4 py-3">
                    {new Intl.DateTimeFormat('es').format(new Date(contact.created_at))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        onClick={() => {
                          setSelectedContactId(contact.id)
                          setPanelTab('datos')
                        }}
                        size="icon"
                        title="Ver"
                        variant="ghost"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => {
                          setModalContact(contact)
                          setIsModalOpen(true)
                        }}
                        size="icon"
                        title="Editar"
                        variant="ghost"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => setConfirmAction({ type: 'contact', id: contact.id, name: contact.name })}
                        size="icon"
                        title="Archivar"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            Pagina {filters.page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              disabled={filters.page <= 1}
              onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
              variant="outline"
            >
              Anterior
            </Button>
            <Button
              disabled={filters.page >= totalPages}
              onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
              variant="outline"
            >
              Siguiente
            </Button>
          </div>
        </div>
      </Card>

      {isModalOpen ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/40 p-4">
          <Card className="w-full max-w-2xl p-5">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-semibold">{modalTitle}</h3>
              <Button onClick={() => setIsModalOpen(false)} size="icon" variant="ghost">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form className="grid gap-4" onSubmit={form.handleSubmit(onSaveContact)}>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Nombre" error={form.formState.errors.name?.message}>
                  <Input {...form.register('name')} />
                </Field>
                <Field label="Telefono">
                  <Input {...form.register('phone')} />
                </Field>
                <Field label="Email" error={form.formState.errors.email?.message}>
                  <Input {...form.register('email')} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <Field label="Tipo">
                  <select className="h-10 rounded-md border bg-background px-3 text-sm" {...form.register('type')}>
                    {typeOptions
                      .filter((option) => option.value !== 'todos')
                      .concat({ value: 'ambos', label: 'Ambos' })
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Origen">
                  <select className="h-10 rounded-md border bg-background px-3 text-sm" {...form.register('source')}>
                    {sourceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Estado">
                  <select className="h-10 rounded-md border bg-background px-3 text-sm" {...form.register('status')}>
                    {statusOptions
                      .filter((option) => option.value !== 'todos')
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                </Field>
                {canAssign ? (
                  <Field label="Asignar a">
                    <select
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                      {...form.register('assigned_to')}
                    >
                      <option value="">Yo o sin asignar</option>
                      {agentsQuery.data?.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.full_name || agent.email}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}
              </div>

              <Field label="Notas">
                <Textarea {...form.register('notes')} />
              </Field>

              <div className="flex justify-end gap-2">
                <Button onClick={() => setIsModalOpen(false)} type="button" variant="outline">
                  Cancelar
                </Button>
                <Button disabled={createContact.isPending || updateContact.isPending} type="submit">
                  Guardar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}

      <aside
        className={cn(
          'fixed right-0 top-0 z-50 h-screen w-full max-w-xl translate-x-full border-l bg-card shadow-2xl transition-transform duration-300',
          selectedContactId && 'translate-x-0'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b p-5">
            <h3 className="text-lg font-semibold">Ficha del contacto</h3>
            <Button onClick={() => setSelectedContactId(null)} size="icon" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {selectedContact ? (
            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-5 flex items-center gap-4">
                <span
                  className={cn(
                    'grid h-16 w-16 place-items-center rounded-full text-lg font-bold text-white',
                    avatarStyles[selectedContact.type]
                  )}
                >
                  {initials(selectedContact.name)}
                </span>
                <div>
                  <h4 className="text-xl font-semibold">{selectedContact.name}</h4>
                  <div className="mt-2 flex gap-2">
                    <Badge className={typeStyles[selectedContact.type]}>{selectedContact.type}</Badge>
                    <Badge className={statusStyles[selectedContact.status]}>{selectedContact.status}</Badge>
                  </div>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3 rounded-md border p-4 text-sm">
                <Info label="Telefono" value={selectedContact.phone} />
                <Info label="Email" value={selectedContact.email} />
                <Info label="Origen" value={selectedContact.source} />
                <Info label="Asignado a" value={selectedContact.assigned_to} />
                <Info
                  label="Fecha alta"
                  value={new Intl.DateTimeFormat('es').format(new Date(selectedContact.created_at))}
                />
              </dl>

              <div className="my-5 flex gap-2">
                <Button
                  onClick={() => {
                    setModalContact(selectedContact)
                    setIsModalOpen(true)
                  }}
                  variant="outline"
                >
                  Editar
                </Button>
              </div>

              <div className="mb-4 flex rounded-md border bg-background p-1">
                <Button
                  onClick={() => setPanelTab('datos')}
                  size="sm"
                  type="button"
                  variant={panelTab === 'datos' ? 'default' : 'ghost'}
                >
                  Datos
                </Button>
                <Button
                  onClick={() => setPanelTab('actividad')}
                  size="sm"
                  type="button"
                  variant={panelTab === 'actividad' ? 'default' : 'ghost'}
                >
                  Actividad
                </Button>
                <Button
                  onClick={() => setPanelTab('expediente')}
                  size="sm"
                  type="button"
                  variant={panelTab === 'expediente' ? 'default' : 'ghost'}
                >
                  Expediente ({shortlistCount})
                </Button>
              </div>

              {panelTab === 'datos' ? (
                <BuyerProfileSection contact={selectedContact} />
              ) : panelTab === 'actividad' ? (
                <section className="grid gap-3">
                  <h4 className="font-semibold">Historial de actividad</h4>
                  {selectedContact.interactions.length === 0 ? (
                    <p className="rounded-md border p-4 text-sm text-muted-foreground">
                      Sin interacciones registradas.
                    </p>
                  ) : (
                    selectedContact.interactions.map((interaction) => (
                      <div className="relative border-l pl-4" key={interaction.id}>
                        <span className="absolute -left-2 top-1 grid h-4 w-4 place-items-center rounded-full bg-primary" />
                        <p className="text-sm font-medium">
                          {interactionOptions.find((option) => option.value === interaction.type)?.label}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {relativeDate(interaction.created_at)}
                          </span>
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{interaction.content}</p>
                      </div>
                    ))
                  )}
                </section>
              ) : (
                <section className="grid gap-3">
                  <h4 className="font-semibold">Expediente</h4>
                  {shortlistQuery.isLoading ? <div className="h-20 animate-pulse rounded-md bg-muted" /> : null}
                  {shortlistQuery.data?.length === 0 ? (
                    <div className="grid place-items-center gap-3 rounded-md border p-6 text-center">
                      <FolderOpen className="h-10 w-10 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Sin propiedades guardadas para este cliente
                      </p>
                      <Button onClick={() => router.push('/properties')} type="button" variant="outline">
                        Buscar propiedades
                      </Button>
                    </div>
                  ) : null}
                  {shortlistQuery.data?.map((item) => (
                    <ShortlistCard
                      editingNoteId={editingNoteId}
                      item={item}
                      key={item.id}
                      noteDraft={noteDraft}
                      onCancelNote={() => {
                        setEditingNoteId(null)
                        setNoteDraft('')
                      }}
                      onConvert={() => {
                        setOperationItem(item)
                      }}
                      onDelete={() => {
                        setConfirmAction({
                          type: 'shortlist',
                          id: item.id,
                          propertyTitle: item.property_title || item.external_data?.title || 'esta propiedad',
                          contactName: selectedContact.name
                        })
                      }}
                      onEditNote={() => {
                        setEditingNoteId(item.id)
                        setNoteDraft(item.notes ?? '')
                      }}
                      onOpen={() => openShortlistItem(item, router.push)}
                      onSaveNote={() => {
                        updateShortlistItem.mutate({
                          id: item.id,
                          payload: { notes: noteDraft }
                        })
                        setEditingNoteId(null)
                        setNoteDraft('')
                      }}
                      onStatusChange={(status) =>
                        updateShortlistItem.mutate({
                          id: item.id,
                          payload: { status }
                        })
                      }
                      onUpdateNote={setNoteDraft}
                    />
                  ))}
                </section>
              )}
            </div>
          ) : (
            <div className="p-5 text-sm text-muted-foreground">Cargando contacto...</div>
          )}

          <form
            className="grid gap-3 border-t p-5"
            onSubmit={interactionForm.handleSubmit(onAddInteraction)}
          >
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <select className="h-10 rounded-md border bg-background px-3 text-sm" {...interactionForm.register('type')}>
                {interactionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button disabled={!selectedContactId || addInteraction.isPending} type="submit">
                Anadir
              </Button>
            </div>
            <Textarea placeholder="Contenido de la interaccion" {...interactionForm.register('content')} />
          </form>
        </div>
      </aside>

      {operationItem && selectedContact ? (
        <OperationModal
          contactName={selectedContact.name}
          item={operationItem}
          onClose={() => setOperationItem(null)}
        />
      ) : null}

      <ConfirmDialog
        danger
        confirmLabel={confirmAction?.type === 'contact' ? 'Si, eliminar' : 'Si, eliminar'}
        isOpen={Boolean(confirmAction)}
        loading={confirmLoading}
        message={
          confirmAction?.type === 'contact'
            ? 'Se cancelaran todas sus operaciones activas y visitas programadas. Esta accion no se puede deshacer.'
            : confirmAction?.type === 'shortlist'
              ? `Se eliminara ${confirmAction.propertyTitle} del expediente de ${confirmAction.contactName}.`
              : ''
        }
        onCancel={() => {
          if (!confirmLoading) setConfirmAction(null)
        }}
        onConfirm={() => void runConfirmedAction()}
        title={confirmAction?.type === 'contact' ? `Eliminar a ${confirmAction.name}?` : 'Eliminar del expediente?'}
      />

      {notice ? (
        <div
          className={cn(
            'fixed bottom-5 right-5 z-[95] max-w-sm rounded-md border p-4 text-sm shadow-xl',
            notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">{notice.message}</p>
            <Button onClick={() => setNotice(null)} size="icon" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const Field = ({
  children,
  error,
  label
}: {
  children: React.ReactNode
  error?: string
  label: string
}) => (
  <div className="grid gap-2">
    <Label>{label}</Label>
    {children}
    {error ? <p className="text-xs text-destructive">{error}</p> : null}
  </div>
)

const ShortlistCard = ({
  editingNoteId,
  item,
  noteDraft,
  onCancelNote,
  onConvert,
  onDelete,
  onEditNote,
  onOpen,
  onSaveNote,
  onStatusChange,
  onUpdateNote
}: {
  editingNoteId: string | null
  item: ShortlistItem
  noteDraft: string
  onCancelNote: () => void
  onConvert: () => void
  onDelete: () => void
  onEditNote: () => void
  onOpen: () => void
  onSaveNote: () => void
  onStatusChange: (status: ShortlistStatus) => void
  onUpdateNote: (value: string) => void
}) => {
  const source = item.property_source || item.external_data?.source || 'internal'
  const title = item.property_title || item.external_data?.title || 'Propiedad guardada'
  const price = item.property_price ?? item.external_data?.price
  const rooms = item.property_rooms ?? item.external_data?.rooms
  const surface = item.property_surface_m2 ?? item.external_data?.surface_m2
  const imageUrl =
    item.property_images?.[0]?.url ||
    item.external_data?.image_url ||
    item.external_data?.images?.[0]?.url
  const isInternal = source === 'internal'
  const deletedAt = item.external_deleted_at || item.external_data?.deleted_at
  const isDeleted = Boolean(deletedAt)

  return (
    <div className={cn('grid gap-3 rounded-md border p-3', isDeleted && 'opacity-60')}>
      <div className="grid grid-cols-[56px_1fr] gap-3">
        <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-md bg-muted">
          {imageUrl ? (
            <img alt={title} className="h-full w-full object-cover" src={imageUrl} />
          ) : (
            <Home className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {price ? formatPropertyPrice(price, item.property_operation || item.external_data?.operation) : 'Precio no disponible'}
            {rooms ? ` - ${rooms} hab` : ''}
            {surface ? ` - ${surface} m2` : ''}
          </p>
          <Badge className={cn('mt-2', isInternal ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800')}>
            {isInternal ? 'EXCLUSIVA' : 'AGENCIA'}
          </Badge>
          {isDeleted ? (
            <p className="mt-2 text-xs font-semibold text-amber-700">
              Ya no disponible en mercado · Retirada el {new Date(deletedAt as string).toLocaleDateString('es-ES')}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Estado</Label>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          onChange={(event) => onStatusChange(event.target.value as ShortlistStatus)}
          value={item.status}
        >
          {shortlistStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {item.status === 'interested' && !isDeleted ? (
          <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={onConvert} size="sm" type="button">
            + Convertir en operacion
          </Button>
        ) : null}
      </div>

      {!isDeleted && editingNoteId === item.id ? (
        <div className="grid gap-2">
          <Input onChange={(event) => onUpdateNote(event.target.value)} value={noteDraft} />
          <div className="flex gap-2">
            <Button onClick={onSaveNote} size="sm" type="button">
              Guardar nota
            </Button>
            <Button onClick={onCancelNote} size="sm" type="button" variant="outline">
              Cancelar
            </Button>
          </div>
        </div>
      ) : item.notes ? (
        <p className="rounded-md bg-muted/50 p-2 text-sm text-muted-foreground">{item.notes}</p>
      ) : null}

      {!isDeleted ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={onOpen} size="sm" type="button" variant="outline">
            Ver
          </Button>
          <Button onClick={onEditNote} size="sm" type="button" variant="outline">
            Nota
          </Button>
          <Button onClick={onDelete} size="sm" type="button" variant="outline">
            Eliminar
          </Button>
        </div>
      ) : null}
    </div>
  )
}

const BuyerProfileSection = ({ contact }: { contact: Contact }) => {
  const updateContact = useUpdateContact()
  const [draft, setDraft] = useState({
    client_profile: contact.client_profile ?? '',
    budget_min: contact.budget_min?.toString() ?? '',
    budget_max: contact.budget_max?.toString() ?? '',
    rooms_min: contact.rooms_min?.toString() ?? '',
    bathrooms_min: contact.bathrooms_min?.toString() ?? '',
    surface_min: contact.surface_min?.toString() ?? '',
    price_per_m2_max: contact.price_per_m2_max?.toString() ?? '',
    needs_renovation: Boolean(contact.needs_renovation),
    needs_pool: Boolean(contact.needs_pool),
    needs_sea_view: Boolean(contact.needs_sea_view),
    needs_garden: Boolean(contact.needs_garden),
    needs_parking: Boolean(contact.needs_parking),
    preferred_zones: (contact.preferred_zones ?? []).join(', '),
    languages: (contact.languages ?? []).join(', '),
    requirements_text: contact.requirements_text ?? ''
  })

  useEffect(() => {
    setDraft({
      client_profile: contact.client_profile ?? '',
      budget_min: contact.budget_min?.toString() ?? '',
      budget_max: contact.budget_max?.toString() ?? '',
      rooms_min: contact.rooms_min?.toString() ?? '',
      bathrooms_min: contact.bathrooms_min?.toString() ?? '',
      surface_min: contact.surface_min?.toString() ?? '',
      price_per_m2_max: contact.price_per_m2_max?.toString() ?? '',
      needs_renovation: Boolean(contact.needs_renovation),
      needs_pool: Boolean(contact.needs_pool),
      needs_sea_view: Boolean(contact.needs_sea_view),
      needs_garden: Boolean(contact.needs_garden),
      needs_parking: Boolean(contact.needs_parking),
      preferred_zones: (contact.preferred_zones ?? []).join(', '),
      languages: (contact.languages ?? []).join(', '),
      requirements_text: contact.requirements_text ?? ''
    })
  }, [contact])

  const numberOrNull = (value: string) => {
    const parsed = Number(value)
    return value.trim() && Number.isFinite(parsed) ? parsed : null
  }

  const listOrNull = (value: string) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

  const needs = [
    draft.needs_pool && 'piscina',
    draft.needs_sea_view && 'vistas al mar',
    draft.needs_garden && 'jardin',
    draft.needs_parking && 'parking',
    draft.needs_renovation && 'reforma'
  ].filter(Boolean)

  return (
    <section className="grid gap-4">
      <div className="rounded-md border p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h4 className="font-semibold">Perfil de comprador</h4>
            <p className="text-sm text-muted-foreground">
              Presupuesto, necesidades y zonas para el matching automatico.
            </p>
          </div>
          {draft.client_profile ? (
            <Badge>{clientProfileOptions.find((option) => option.value === draft.client_profile)?.label}</Badge>
          ) : null}
        </div>
        <div className="grid gap-3">
          <Field label="Tipo">
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              onChange={(event) => setDraft((current) => ({ ...current, client_profile: event.target.value }))}
              value={draft.client_profile}
            >
              <option value="">Sin perfil</option>
              {clientProfileOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Presupuesto min.">
              <Input onChange={(event) => setDraft((current) => ({ ...current, budget_min: event.target.value }))} value={draft.budget_min} />
            </Field>
            <Field label="Presupuesto max.">
              <Input onChange={(event) => setDraft((current) => ({ ...current, budget_max: event.target.value }))} value={draft.budget_max} />
            </Field>
            <Field label="Habitaciones min.">
              <Input onChange={(event) => setDraft((current) => ({ ...current, rooms_min: event.target.value }))} value={draft.rooms_min} />
            </Field>
            <Field label="Baños min.">
              <Input onChange={(event) => setDraft((current) => ({ ...current, bathrooms_min: event.target.value }))} value={draft.bathrooms_min} />
            </Field>
            <Field label="Superficie min.">
              <Input onChange={(event) => setDraft((current) => ({ ...current, surface_min: event.target.value }))} value={draft.surface_min} />
            </Field>
            <Field label="Max. euro/m2">
              <Input onChange={(event) => setDraft((current) => ({ ...current, price_per_m2_max: event.target.value }))} value={draft.price_per_m2_max} />
            </Field>
          </div>
          <div className="grid gap-2">
            <Label>Necesidades</Label>
            <div className="flex flex-wrap gap-2">
              {[
                ['needs_pool', 'Piscina'],
                ['needs_sea_view', 'Vistas al mar'],
                ['needs_garden', 'Jardin'],
                ['needs_parking', 'Parking'],
                ['needs_renovation', 'Reforma']
              ].map(([key, label]) => (
                <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm" key={key}>
                  <input
                    checked={Boolean(draft[key as keyof typeof draft])}
                    onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.checked }))}
                    type="checkbox"
                  />
                  {label}
                </label>
              ))}
            </div>
            {needs.length ? <p className="text-xs text-muted-foreground">Activas: {needs.join(', ')}</p> : null}
          </div>
          <Field label="Zonas preferidas">
            <Input
              onChange={(event) => setDraft((current) => ({ ...current, preferred_zones: event.target.value }))}
              placeholder="Montgo, Arenal, Puerto"
              value={draft.preferred_zones}
            />
          </Field>
          <Field label="Idiomas">
            <Input
              onChange={(event) => setDraft((current) => ({ ...current, languages: event.target.value }))}
              placeholder="es, en, de"
              value={draft.languages}
            />
          </Field>
          <Field label="Descripcion">
            <Textarea
              onChange={(event) => setDraft((current) => ({ ...current, requirements_text: event.target.value }))}
              value={draft.requirements_text}
            />
          </Field>
          <Button
            disabled={updateContact.isPending}
            onClick={() =>
              updateContact.mutate({
                id: contact.id,
                payload: {
                  client_profile: draft.client_profile ? (draft.client_profile as ClientProfile) : null,
                  budget_min: numberOrNull(draft.budget_min),
                  budget_max: numberOrNull(draft.budget_max),
                  rooms_min: numberOrNull(draft.rooms_min),
                  bathrooms_min: numberOrNull(draft.bathrooms_min),
                  surface_min: numberOrNull(draft.surface_min),
                  price_per_m2_max: numberOrNull(draft.price_per_m2_max),
                  needs_renovation: draft.needs_renovation,
                  needs_pool: draft.needs_pool,
                  needs_sea_view: draft.needs_sea_view,
                  needs_garden: draft.needs_garden,
                  needs_parking: draft.needs_parking,
                  preferred_zones: listOrNull(draft.preferred_zones),
                  languages: listOrNull(draft.languages),
                  requirements_text: draft.requirements_text || null
                }
              })
            }
            type="button"
          >
            Guardar perfil
          </Button>
        </div>
      </div>
    </section>
  )
}

const openShortlistItem = (item: ShortlistItem, navigate: (href: string) => void) => {
  if (item.property_source === 'internal' && item.property_id) {
    navigate(`/properties?propertyId=${item.property_id}`)
    return
  }

  const url = item.property_source_url || item.external_data?.source_url
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

const OperationModal = ({
  contactName,
  item,
  onClose
}: {
  contactName: string
  item: ShortlistItem
  onClose: () => void
}) => {
  const title = item.property_title || item.external_data?.title || 'Propiedad guardada'
  const operation = item.property_operation || item.external_data?.operation || 'sale'

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4">
      <Card className="w-full max-w-lg p-5">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-semibold">Nueva operacion</h3>
          <Button onClick={onClose} size="icon" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid gap-4">
          <Info label="Cliente" value={contactName} />
          <Info label="Propiedad" value={title} />
          <Info label="Tipo" value={operation === 'rent' ? 'Alquiler' : 'Venta'} />
          <Info label="contact_id" value={item.contact_id} />
          <Info label="property_id" value={item.property_id ?? 'Propiedad externa'} />
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            La operacion queda preparada con los datos del expediente. El guardado final se conectara al modulo de
            Operaciones cuando ese formulario este activo.
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={onClose} variant="outline">
              Cancelar
            </Button>
            <Button disabled>Crear operacion</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

const Info = ({ label, value }: { label: string; value?: string | null }) => (
  <div>
    <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
    <dd className="mt-1 break-words font-medium">{value || '-'}</dd>
  </div>
)
