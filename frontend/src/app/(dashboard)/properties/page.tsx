'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import {
  Archive,
  Bath,
  BedDouble,
  Eye,
  Grid2X2,
  Home,
  List,
  Pencil,
  Plus,
  Save,
  Search,
  Upload,
  X
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useContacts } from '@/hooks/useContacts'
import {
  useCreateProperty,
  useDeleteProperty,
  useProperties,
  useProperty,
  usePropertySearch,
  useSaveToShortlist,
  useUpdateProperty,
  useUploadPropertyImage
} from '@/hooks/useProperties'
import { formatPropertyPrice, formatPropertySource } from '@/lib/properties-format'
import { cn } from '@/lib/utils'
import type {
  CreatePropertyDto,
  ExternalProperty,
  Property,
  PropertyFilters,
  PropertyOperation,
  PropertySource,
  PropertyStatus
} from '@/types/properties'

const propertySchema = z.object({
  title: z.string().trim().min(2, 'Titulo obligatorio'),
  address: z.string().trim().min(2, 'Direccion obligatoria'),
  city: z.string().trim().min(2, 'Ciudad obligatoria'),
  zip: z.string().trim().optional(),
  type: z.string().trim().min(2, 'Tipo obligatorio'),
  operation: z.enum(['sale', 'rent']),
  price: z.coerce.number().nonnegative('Precio invalido'),
  surface_m2: z.coerce.number().nonnegative().optional().or(z.literal('')),
  rooms: z.coerce.number().int().nonnegative().optional().or(z.literal('')),
  bathrooms: z.coerce.number().int().nonnegative().optional().or(z.literal('')),
  status: z.enum(['draft', 'active', 'available', 'reserved', 'sold', 'rented']),
  description: z.string().trim().optional(),
  assigned_to: z.string().trim().optional()
})

const shortlistSchema = z.object({
  contact_id: z.string().uuid('Selecciona un cliente'),
  notes: z.string().trim().optional()
})

type PropertyForm = z.infer<typeof propertySchema>
type ShortlistForm = z.infer<typeof shortlistSchema>

const emptyProperty: PropertyForm = {
  title: '',
  address: '',
  city: '',
  zip: '',
  type: 'piso',
  operation: 'sale',
  price: 0,
  surface_m2: '',
  rooms: '',
  bathrooms: '',
  status: 'active',
  description: '',
  assigned_to: ''
}

const statusLabels: Record<PropertyStatus, string> = {
  draft: 'borrador',
  active: 'activa',
  available: 'disponible',
  reserved: 'reservada',
  sold: 'vendida',
  rented: 'alquilada',
  archived: 'archivada'
}

const operationLabels: Record<PropertyOperation, string> = {
  sale: 'venta',
  rent: 'alquiler'
}

const sourceLabels: Record<PropertySource | 'all', string> = {
  all: 'todas',
  internal: 'exclusivas',
  kyero: 'Kyero',
  sooprema: 'Sooprema',
  crown_property: 'Crown Property',
  ego_real_estate: 'Ego Real Estate',
  other: 'agencias'
}

const filterTypeLabels: Record<string, string> = {
  apartment: 'piso apartamento',
  apartment_loft: 'loft estudio',
  apartment_penthouse: 'atico penthouse',
  village_house: 'casa de pueblo',
  townhouse: 'adosado pareado',
  bungalow: 'bungalow',
  villa: 'chalet villa finca',
  land: 'terreno parcela',
  commercial: 'local oficina',
  garage: 'garaje parking'
}

const typeFilterToCanonical: Record<string, string> = {
  apartment: 'apartment',
  apartment_loft: 'apartment',
  apartment_penthouse: 'apartment',
  village_house: 'village_house',
  townhouse: 'townhouse',
  bungalow: 'townhouse',
  villa: 'villa',
  land: 'land',
  commercial: 'commercial',
  garage: 'garage'
}

const filterOperationLabels: Record<string, string> = {
  sale: 'venta',
  rent: 'alquiler'
}

const asNumber = (value: unknown) => {
  if (value === '' || value === undefined || value === null) return null
  return Number(value)
}

const normalizeProperty = (values: PropertyForm): CreatePropertyDto => ({
  ...values,
  zip: values.zip || null,
  surface_m2: asNumber(values.surface_m2),
  rooms: asNumber(values.rooms),
  bathrooms: asNumber(values.bathrooms),
  description: values.description || null,
  assigned_to: values.assigned_to || null
})

const initials = (title: string) =>
  title
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

const normalizeUiText = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const splitUiWords = (text: string) => text.split(/\s+/).filter(Boolean)

const uiHasWholeTerm = (text: string, term: string) => {
  const normalizedTerm = normalizeUiText(term)

  if (normalizedTerm.includes(' ')) {
    return new RegExp(`(^|\\s)${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\s)`).test(text)
  }

  return splitUiWords(text).some((word) => word === normalizedTerm)
}

const externalMatchesFilters = (property: ExternalProperty, filters: PropertyFilters) => {
  if (filters.source && filters.source !== 'all') {
    if (filters.source === 'internal' && property.source !== 'crown_property') return false
    if (filters.source === 'other' && property.source === 'crown_property') return false
    if (filters.source !== 'internal' && filters.source !== 'other' && property.source !== filters.source) return false
  }

  if (filters.operation && filters.operation !== 'all' && property.operation !== filters.operation) {
    return false
  }

  if (filters.type && filters.type !== 'all') {
    const type = normalizeUiText(String(property.detected_type ?? property.type))
    const text = normalizeUiText(`${property.title} ${property.zone ?? ''} ${property.search_text ?? ''}`)
    const selectedType = filters.type
    const expectedType = typeFilterToCanonical[selectedType] ?? selectedType
    const family =
      expectedType === 'villa'
        ? ['villa', 'chalet', 'finca', 'cortijo', 'masia']
        : expectedType === 'village_house'
          ? ['village_house', 'casa', 'pueblo', 'cottage', 'country', 'cortijo']
        : expectedType === 'townhouse'
          ? ['townhouse', 'adosado', 'pareado', 'bungalow', 'terraced']
        : expectedType === 'apartment'
          ? ['apartment', 'piso', 'apartamento', 'apto', 'atico']
          : expectedType === 'land'
            ? ['land', 'parcela', 'terreno', 'solar', 'plot']
            : expectedType === 'commercial'
              ? ['commercial', 'local', 'oficina', 'nave', 'shop', 'office']
              : expectedType === 'garage'
                ? ['garage', 'garaje', 'parking', 'trastero']
                : [selectedType]

    if (type !== expectedType && !family.some((term) => uiHasWholeTerm(text, term))) {
      return false
    }
  }

  return true
}

export default function PropertiesPage() {
  const router = useRouter()
  const [filters, setFilters] = useState<PropertyFilters>({
    operation: 'all',
    status: 'all',
    source: 'all',
    type: 'all',
    search: '',
    page: 1,
    limit: 20
  })
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [query, setQuery] = useState('')
  const [searchResult, setSearchResult] = useState<{
    keywords: string[]
    internal: Property[]
    external: ExternalProperty[]
  } | null>(null)
  const [propertyModal, setPropertyModal] = useState<Property | null>(null)
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
  const [shortlistTarget, setShortlistTarget] = useState<Property | ExternalProperty | null>(null)
  const [duplicateShortlist, setDuplicateShortlist] = useState<{ contactId: string; contactName: string } | null>(null)
  const [toast, setToast] = useState<{ contactId: string; contactName: string } | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const propertiesQuery = useProperties(filters)
  const propertyQuery = useProperty(selectedPropertyId)
  const contactsQuery = useContacts({ page: 1, limit: 100, type: 'todos', status: 'todos', search: '' })
  const propertySearch = usePropertySearch(query)
  const searchProperties = propertySearch.mutateAsync
  const createProperty = useCreateProperty()
  const updateProperty = useUpdateProperty()
  const deleteProperty = useDeleteProperty()
  const saveToShortlist = useSaveToShortlist()
  const uploadImage = useUploadPropertyImage(selectedPropertyId)

  const propertyForm = useForm<PropertyForm>({
    resolver: zodResolver(propertySchema),
    defaultValues: emptyProperty,
    mode: 'onChange'
  })

  const shortlistForm = useForm<ShortlistForm>({
    resolver: zodResolver(shortlistSchema),
    defaultValues: {
      contact_id: '',
      notes: ''
    }
  })

  useEffect(() => {
    const subscription = shortlistForm.watch(() => setDuplicateShortlist(null))

    return () => subscription.unsubscribe()
  }, [shortlistForm])

  const baseProperties = propertiesQuery.data?.properties ?? []
  const internalProperties = searchResult ? searchResult.internal : baseProperties.filter((item) => item.source === 'internal')
  const localExternalProperties = baseProperties
    .filter((item) => item.source !== 'internal')
    .map((item) => ({
      id: item.id,
      title: item.title,
      city: item.city,
      price: Number(item.price),
      operation: item.operation,
      type: item.type,
      detected_type: item.type,
      source: item.source === 'internal' ? 'other' : item.source,
      source_url: item.source_url || '#',
      source_agency_name: item.source_agency_name || undefined,
      source_agency_phone: item.source_agency_phone || undefined,
      image_url: item.images?.[0]?.url,
      images: item.images,
      surface_m2: item.surface_m2 ? Number(item.surface_m2) : null,
      rooms: item.rooms ?? null,
      bathrooms: item.bathrooms ?? null,
      description: item.description || undefined,
      ref: item.external_ref ?? '',
      zone: item.address,
      badge: item.external_badge,
      search_text: `${item.title} ${item.address} ${item.external_badge ?? ''}`
    })) satisfies ExternalProperty[]
  const externalProperties: ExternalProperty[] =
    (searchResult ? searchResult.external : localExternalProperties).filter((property) =>
      externalMatchesFilters(property, filters)
    )
  const crownProperties = externalProperties.filter((property) => property.source === 'crown_property')
  const agencyProperties = externalProperties.filter((property) => property.source !== 'crown_property')
  const exclusiveCount = internalProperties.length + crownProperties.length
  const total = searchResult ? exclusiveCount + agencyProperties.length : propertiesQuery.data?.total ?? 0
  const selectedProperty = propertyQuery.data

  const openExternalDetail = (property: ExternalProperty) => {
    window.sessionStorage.setItem(`property-detail:${property.id}`, JSON.stringify(property))
    router.push(`/properties/${property.id}`)
  }

  const buildSearchQuery = useCallback(() => {
    const terms = [query.trim()]

    if (filters.operation && filters.operation !== 'all') {
      terms.push(filterOperationLabels[filters.operation] ?? filters.operation)
    }

    const searchQuery = terms.filter(Boolean).join(' ').trim()

    if (!searchQuery && (filters.type !== 'all' || filters.source !== 'all' || filters.operation !== 'all')) {
      return 'javea'
    }

    return searchQuery
  }, [filters.operation, filters.source, filters.type, query])

  useEffect(() => {
    if (!isPropertyModalOpen) return

    if (propertyModal) {
      propertyForm.reset({
        title: propertyModal.title,
        address: propertyModal.address,
        city: propertyModal.city,
        zip: propertyModal.zip ?? '',
        type: propertyModal.type,
        operation: propertyModal.operation,
        price: Number(propertyModal.price),
        surface_m2: propertyModal.surface_m2 ? Number(propertyModal.surface_m2) : '',
        rooms: propertyModal.rooms ?? '',
        bathrooms: propertyModal.bathrooms ?? '',
        status: propertyModal.status === 'archived' ? 'active' : propertyModal.status,
        description: propertyModal.description ?? '',
        assigned_to: propertyModal.assigned_to ?? ''
      })
    } else {
      propertyForm.reset(emptyProperty)
    }
  }, [isPropertyModalOpen, propertyForm, propertyModal])

  const runSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResult(null)
      return
    }

    const result = await searchProperties({
      query: searchQuery,
      type: filters.type && filters.type !== 'all' ? typeFilterToCanonical[filters.type] ?? filters.type : null
    })
    const chips = [
      result.keywords.type,
      result.keywords.rooms_min ? `${result.keywords.rooms_min} hab` : null,
      result.keywords.city,
      result.keywords.price_max ? `max. ${new Intl.NumberFormat('es-ES').format(result.keywords.price_max)}` : null,
      filters.type && filters.type !== 'all' ? filterTypeLabels[filters.type] ?? filters.type : null,
      filters.operation && filters.operation !== 'all' ? filterOperationLabels[filters.operation] ?? filters.operation : null,
      ...result.keywords.features.slice(0, 4)
    ].filter(Boolean) as string[]

    setSearchResult({ keywords: chips, internal: result.internal, external: result.external })
  }, [filters.operation, filters.type, searchProperties])

  const onSearch = async () => {
    await runSearch(buildSearchQuery())
  }

  useEffect(() => {
    const searchableFilterActive =
      (filters.type && filters.type !== 'all') ||
      (filters.operation && filters.operation !== 'all') ||
      filters.source !== 'all'

    if (!query.trim() && !searchableFilterActive) {
      setSearchResult(null)
      return
    }

    const timer = window.setTimeout(() => {
      void runSearch(buildSearchQuery())
    }, 250)

    return () => window.clearTimeout(timer)
  }, [buildSearchQuery, filters.operation, filters.source, filters.type, query, runSearch])

  const onSaveProperty = async (values: PropertyForm) => {
    const payload = normalizeProperty(values)

    if (propertyModal) {
      await updateProperty.mutateAsync({ id: propertyModal.id, payload })
    } else {
      await createProperty.mutateAsync(payload)
    }

    setIsPropertyModalOpen(false)
    setPropertyModal(null)
  }

  const onSaveToShortlist = async (values: ShortlistForm) => {
    if (!shortlistTarget) return
    const isExternal = 'source_url' in shortlistTarget && shortlistTarget.source !== 'internal'
    const selectedContact = contactsQuery.data?.contacts.find((contact) => contact.id === values.contact_id)

    try {
      await saveToShortlist.mutateAsync({
        contact_id: values.contact_id,
        property_id: isExternal ? null : shortlistTarget.id,
        external_data: isExternal ? (shortlistTarget as ExternalProperty) : null,
        notes: values.notes || null
      })
    } catch (error) {
      const data = axios.isAxiosError(error) ? error.response?.data : null

      if (axios.isAxiosError(error) && error.response?.status === 409 && data?.code === 'ALREADY_IN_SHORTLIST') {
        setDuplicateShortlist({
          contactId: values.contact_id,
          contactName: selectedContact?.name ?? 'este cliente'
        })
        return
      }

      throw error
    }

    setToast({
      contactId: values.contact_id,
      contactName: selectedContact?.name ?? 'este cliente'
    })
    setDuplicateShortlist(null)
    shortlistForm.reset({ contact_id: '', notes: '' })
    setShortlistTarget(null)
  }

  const skeleton = useMemo(() => Array.from({ length: 6 }, (_, index) => index), [])

  return (
    <div className="grid gap-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Propiedades</h2>
          <p className="text-sm text-muted-foreground">{total} propiedades en total</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border bg-background p-1">
            <Button
              className="gap-2"
              onClick={() => setView('grid')}
              size="sm"
              variant={view === 'grid' ? 'default' : 'ghost'}
            >
              <Grid2X2 className="h-4 w-4" /> Grid
            </Button>
            <Button
              className="gap-2"
              onClick={() => setView('list')}
              size="sm"
              variant={view === 'list' ? 'default' : 'ghost'}
            >
              <List className="h-4 w-4" /> Lista
            </Button>
          </div>
          <Button
            className="gap-2"
            onClick={() => {
              setPropertyModal(null)
              setIsPropertyModalOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Nueva propiedad
          </Button>
        </div>
      </section>

      <Card className="grid gap-4 p-4">
        <div className="grid gap-3 xl:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-11 pl-9"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void onSearch()
              }}
              placeholder="Que busca tu cliente? Ej: piso 3 hab vistas al mar menos de 400k"
              value={query}
            />
          </div>
          <div className="flex gap-2">
            <Button disabled={propertySearch.isPending} onClick={() => void onSearch()}>
              Buscar
            </Button>
            {searchResult ? (
              <Button onClick={() => setSearchResult(null)} variant="outline">
                Limpiar
              </Button>
            ) : null}
          </div>
        </div>

        {searchResult ? (
          <div className="flex flex-wrap gap-2">
            {searchResult.keywords.length ? (
              searchResult.keywords.map((keyword) => (
                <Badge className="bg-slate-900 text-white" key={keyword}>
                  {keyword}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">Busqueda sin palabras clave claras.</span>
            )}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-4">
          <FilterSelect
            label="Operacion"
            onChange={(value) => setFilters((current) => ({ ...current, operation: value as PropertyOperation | 'all', page: 1 }))}
            options={[
              ['all', 'Todas'],
              ['sale', 'Venta'],
              ['rent', 'Alquiler']
            ]}
            value={filters.operation ?? 'all'}
          />
          <FilterSelect
            label="Tipo"
            onChange={(value) => setFilters((current) => ({ ...current, type: value, page: 1 }))}
            options={[
              ['all', 'Todos'],
              ['apartment', 'Piso/Apartamento'],
              ['apartment_loft', 'Loft/Estudio'],
              ['apartment_penthouse', 'Atico/Penthouse'],
              ['village_house', 'Casa de pueblo'],
              ['townhouse', 'Adosado/Pareado'],
              ['bungalow', 'Bungalow'],
              ['villa', 'Chalet/Villa/Finca'],
              ['land', 'Terreno/Parcela'],
              ['commercial', 'Local/Oficina'],
              ['garage', 'Garaje/Parking']
            ]}
            value={filters.type ?? 'all'}
          />
          <FilterSelect
            label="Estado"
            onChange={(value) => setFilters((current) => ({ ...current, status: value as PropertyStatus | 'all', page: 1 }))}
            options={[
              ['all', 'Todos'],
              ['available', 'Disponible'],
              ['reserved', 'Reservada'],
              ['sold', 'Vendida']
            ]}
            value={filters.status ?? 'all'}
          />
          <FilterSelect
            label="Origen"
            onChange={(value) => setFilters((current) => ({ ...current, source: value as PropertySource | 'all', page: 1 }))}
            options={[
              ['all', 'Todas'],
              ['internal', 'Exclusivas'],
              ['other', 'Agencias']
            ]}
            value={filters.source ?? 'all'}
          />
        </div>
      </Card>

      {propertiesQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {skeleton.map((item) => (
            <Card className="h-72 animate-pulse bg-muted" key={item} />
          ))}
        </div>
      ) : null}

      {!propertiesQuery.isLoading ? (
        <>
          <SectionTitle count={exclusiveCount} label="EXCLUSIVAS" tone="green" />
          {exclusiveCount ? (
            <>
              {internalProperties.length ? (
                <PropertyCollection
                  onArchive={(property) => deleteProperty.mutate(property.id)}
                  onEdit={(property) => {
                    setPropertyModal(property)
                    setIsPropertyModalOpen(true)
                  }}
                  onSave={(property) => setShortlistTarget(property)}
                  onView={(property) => router.push(`/properties/${property.id}`)}
                  properties={internalProperties}
                  view={view}
                />
              ) : null}
              {crownProperties.length ? (
                <ExternalExclusiveCollection
                  onSave={(property) => setShortlistTarget(property)}
                  onView={openExternalDetail}
                  properties={crownProperties}
                  view={view}
                />
              ) : null}
            </>
          ) : (
            <EmptyState text="No hay exclusivas con estos filtros." />
          )}

          <SectionTitle count={agencyProperties.length} label="AGENCIAS" tone="blue" />
          <ExternalCollection
            onSave={(property) => setShortlistTarget(property)}
            onView={openExternalDetail}
            properties={agencyProperties}
            view={view}
          />
        </>
      ) : null}

      {isPropertyModalOpen ? (
        <PropertyModal
          form={propertyForm}
          isSaving={createProperty.isPending || updateProperty.isPending}
          onClose={() => {
            setIsPropertyModalOpen(false)
            setPropertyModal(null)
          }}
          onSubmit={onSaveProperty}
          title={propertyModal ? 'Editar propiedad' : 'Nueva propiedad'}
        />
      ) : null}

      {shortlistTarget ? (
        <ShortlistModal
          contacts={contactsQuery.data?.contacts ?? []}
          duplicate={duplicateShortlist}
          form={shortlistForm}
          isSaving={saveToShortlist.isPending}
          onClose={() => {
            setDuplicateShortlist(null)
            setShortlistTarget(null)
          }}
          onViewExpediente={(contactId) => {
            router.push(`/contacts?contactId=${contactId}&tab=expediente`)
            setDuplicateShortlist(null)
            setShortlistTarget(null)
          }}
          onSubmit={onSaveToShortlist}
          propertyTitle={shortlistTarget.title}
        />
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 right-5 z-[60] w-[360px] rounded-md border bg-card p-4 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Guardado en el expediente de {toast.contactName}</p>
              <button
                className="mt-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  router.push(`/contacts?contactId=${toast.contactId}&tab=expediente`)
                  setToast(null)
                }}
                type="button"
              >
                Ver expediente
              </button>
            </div>
            <Button onClick={() => setToast(null)} size="icon" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <aside
        className={cn(
          'fixed right-0 top-0 z-50 h-screen w-full max-w-2xl translate-x-full border-l bg-card shadow-2xl transition-transform duration-300',
          selectedPropertyId && 'translate-x-0'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b p-5">
            <h3 className="text-lg font-semibold">Ficha de propiedad</h3>
            <Button onClick={() => setSelectedPropertyId(null)} size="icon" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          </div>
          {selectedProperty ? (
            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-4 grid h-64 place-items-center overflow-hidden rounded-md bg-slate-100">
                {selectedProperty.images?.[0]?.url ? (
                  <img
                    alt={selectedProperty.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    src={selectedProperty.images[0].url}
                  />
                ) : (
                  <Home className="h-16 w-16 text-slate-400" />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-emerald-100 text-emerald-800">EXCLUSIVA</Badge>
                <Badge className="bg-slate-900 text-white">{operationLabels[selectedProperty.operation]}</Badge>
                <Badge>{statusLabels[selectedProperty.status]}</Badge>
              </div>
              <h3 className="mt-4 text-2xl font-semibold">{selectedProperty.title}</h3>
              <p className="text-sm text-muted-foreground">
                {selectedProperty.address}, {selectedProperty.city}
              </p>
              <p className="mt-3 text-3xl font-semibold">{formatPropertyPrice(selectedProperty.price, selectedProperty.operation)}</p>
              <FeatureGrid property={selectedProperty} />
              <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {selectedProperty.description || 'Sin descripcion.'}
              </p>
              <div className="mt-5 rounded-md border p-4 text-sm">
                <p className="text-xs uppercase text-muted-foreground">Agente asignado</p>
                <p className="mt-1 font-medium">{selectedProperty.assigned_to || '-'}</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button className="gap-2" onClick={() => setShortlistTarget(selectedProperty)}>
                  <Save className="h-4 w-4" />
                  Guardar en expediente
                </Button>
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm font-semibold">
                  <Upload className="h-4 w-4" />
                  Subir imagen
                  <input
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        setUploadProgress(0)
                        uploadImage.mutate({ file, onProgress: setUploadProgress })
                      }
                    }}
                    type="file"
                  />
                </label>
              </div>
              {uploadImage.isPending || uploadProgress > 0 ? (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress || 10}%` }} />
                </div>
              ) : null}
              <div className="mt-6 rounded-md border p-4">
                <h4 className="font-semibold">Operaciones vinculadas</h4>
                <p className="mt-2 text-sm text-muted-foreground">Todavia no hay operaciones vinculadas.</p>
              </div>
            </div>
          ) : (
            <div className="p-5 text-sm text-muted-foreground">Cargando propiedad...</div>
          )}
        </div>
      </aside>
    </div>
  )
}

const FilterSelect = ({
  label,
  onChange,
  options,
  value
}: {
  label: string
  onChange: (value: string) => void
  options: Array<[string, string]>
  value: string
}) => (
  <label className="grid gap-2 text-sm font-medium">
    {label}
    <select
      className="h-10 rounded-md border bg-background px-3 text-sm"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {options.map(([optionValue, optionLabel]) => (
        <option key={optionValue} value={optionValue}>
          {optionLabel}
        </option>
      ))}
    </select>
  </label>
)

const SectionTitle = ({ count, label, tone }: { count: number; label: string; tone: 'green' | 'blue' }) => (
  <div className={cn('rounded-md px-4 py-2 text-sm font-semibold', tone === 'green' ? 'bg-emerald-50' : 'bg-blue-50')}>
    <span>{label}</span>
    <Badge className={cn('ml-2', tone === 'green' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white')}>
      {count}
    </Badge>
  </div>
)

const PropertyCollection = ({
  onArchive,
  onEdit,
  onSave,
  onView,
  properties,
  view
}: {
  onArchive: (property: Property) => void
  onEdit: (property: Property) => void
  onSave: (property: Property) => void
  onView: (property: Property) => void
  properties: Property[]
  view: 'grid' | 'list'
}) => {
  if (!properties.length) {
    return <EmptyState text="No hay exclusivas con estos filtros." />
  }

  return (
    <div className={view === 'grid' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'grid gap-3'}>
      {properties.map((property) => (
        <PropertyCard
          key={property.id}
          onArchive={() => onArchive(property)}
          onEdit={() => onEdit(property)}
          onSave={() => onSave(property)}
          onView={() => onView(property)}
          property={property}
        />
      ))}
    </div>
  )
}

const ExternalCollection = ({
  onSave,
  onView,
  properties,
  view
}: {
  onSave: (property: ExternalProperty) => void
  onView: (property: ExternalProperty) => void
  properties: ExternalProperty[]
  view: 'grid' | 'list'
}) => {
  if (!properties.length) {
    return <EmptyState text="No hay propiedades de agencias para esta busqueda." />
  }

  return (
    <div className={view === 'grid' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'grid gap-3'}>
      {properties.map((property) => (
        <ExternalCard key={property.id} onSave={() => onSave(property)} onView={() => onView(property)} property={property} />
      ))}
    </div>
  )
}

const ExternalExclusiveCollection = ({
  onSave,
  onView,
  properties,
  view
}: {
  onSave: (property: ExternalProperty) => void
  onView: (property: ExternalProperty) => void
  properties: ExternalProperty[]
  view: 'grid' | 'list'
}) => (
  <div className={view === 'grid' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'grid gap-3'}>
    {properties.map((property) => (
      <ExternalExclusiveCard key={property.id} onSave={() => onSave(property)} onView={() => onView(property)} property={property} />
    ))}
  </div>
)

const PropertyCard = ({
  onArchive,
  onEdit,
  onSave,
  onView,
  property
}: {
  onArchive: () => void
  onEdit: () => void
  onSave: () => void
  onView: () => void
  property: Property
}) => (
  <Card className="flex h-full flex-col overflow-hidden">
    <div className="relative grid h-48 shrink-0 place-items-center overflow-hidden bg-slate-100">
      {property.images?.[0]?.url ? (
        <img alt={property.title} className="h-full w-full object-cover" loading="lazy" src={property.images[0].url} />
      ) : (
        <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-900 text-lg font-bold text-white">
          {initials(property.title)}
        </div>
      )}
      <Badge className="absolute left-3 top-3 bg-emerald-600 text-white shadow-sm">EXCLUSIVA</Badge>
    </div>
    <div className="flex flex-1 flex-col gap-3 bg-card p-4">
      <div className="min-h-[68px]">
        <h3 className="line-clamp-2 min-h-12 font-semibold leading-6">{property.title}</h3>
        <p className="text-sm text-muted-foreground">{property.city}</p>
      </div>
      <p className="text-lg font-semibold text-foreground">{formatPropertyPrice(property.price, property.operation)}</p>
      <FeatureRow property={property} />
      <p className="text-xs text-muted-foreground">Agente: {property.assigned_to || '-'}</p>
      <div className="mt-auto grid grid-cols-4 gap-1">
        <Button onClick={onView} size="icon" title="Ver ficha" variant="outline">
          <Eye className="h-4 w-4" />
        </Button>
        <Button onClick={onSave} size="icon" title="Guardar en expediente" variant="outline">
          <Save className="h-4 w-4" />
        </Button>
        <Button onClick={onEdit} size="icon" title="Editar" variant="outline">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button onClick={onArchive} size="icon" title="Archivar" variant="outline">
          <Archive className="h-4 w-4" />
        </Button>
      </div>
    </div>
  </Card>
)

const ExternalExclusiveCard = ({ onSave, onView, property }: { onSave: () => void; onView: () => void; property: ExternalProperty }) => {
  const imageUrl = property.image_url || property.images?.[0]?.url

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="relative grid h-48 shrink-0 place-items-center overflow-hidden bg-slate-100">
        {imageUrl ? (
          <img alt={property.title} className="h-full w-full object-cover" loading="lazy" src={imageUrl} />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-900 text-lg font-bold text-white">
            {initials(property.title)}
          </div>
        )}
        <Badge className="absolute left-3 top-3 bg-emerald-600 text-white shadow-sm">EXCLUSIVA</Badge>
      </div>
      <div className="flex flex-1 flex-col gap-3 bg-card p-4">
        <div className="min-h-[68px]">
          <h3 className="line-clamp-2 min-h-12 font-semibold leading-6">{property.title}</h3>
          <p className="text-sm text-muted-foreground">{property.city}</p>
        </div>
        <p className="text-lg font-semibold text-foreground">{formatPropertyPrice(property.price, property.operation)}</p>
        <FeatureRow property={property} />
        <p className="text-xs text-muted-foreground">Agente: Crown Property Jávea</p>
        <div className="mt-auto grid grid-cols-2 gap-2">
          <Button onClick={onView} variant="outline">
            Ver detalle
          </Button>
          <Button className="gap-2" onClick={onSave}>
            <Save className="h-4 w-4" />
            Guardar
          </Button>
        </div>
      </div>
    </Card>
  )
}

const ExternalCard = ({ onSave, onView, property }: { onSave: () => void; onView: () => void; property: ExternalProperty }) => {
  const imageUrl = property.image_url || property.images?.[0]?.url

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="relative grid h-48 shrink-0 place-items-center overflow-hidden bg-blue-50">
        {imageUrl ? (
          <img alt={property.title} className="h-full w-full object-cover" loading="lazy" src={imageUrl} />
        ) : (
          <Home className="h-14 w-14 text-blue-500" />
        )}
        <Badge className="absolute left-3 top-3 bg-blue-600 text-white shadow-sm">
          AGENCIA {property.badge || property.source_agency_name || formatPropertySource(property.source)}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-3 bg-card p-4">
        <div className="min-h-[68px]">
          <h3 className="line-clamp-2 min-h-12 font-semibold leading-6">{property.title}</h3>
          <p className="text-sm text-muted-foreground">{property.city}</p>
        </div>
        <p className="text-lg font-semibold text-foreground">{formatPropertyPrice(property.price, property.operation)}</p>
        <FeatureRow property={property} />
        <div className="mt-auto grid grid-cols-2 gap-2">
          <Button onClick={onView} variant="outline">
            Ver detalle
          </Button>
          <Button className="gap-2" onClick={onSave}>
            <Save className="h-4 w-4" />
            Guardar
          </Button>
        </div>
      </div>
    </Card>
  )
}

const FeatureRow = ({ property }: { property: Property | ExternalProperty }) => (
  <div className="flex flex-wrap gap-2">
    <Badge>{property.type}</Badge>
    {property.surface_m2 ? <Badge>{property.surface_m2} m2</Badge> : null}
    {property.rooms ? <Badge>{property.rooms} hab</Badge> : null}
    {property.bathrooms ? <Badge>{property.bathrooms} banos</Badge> : null}
  </div>
)

const FeatureGrid = ({ property }: { property: Property }) => (
  <div className="mt-5 grid grid-cols-3 gap-3">
    <Card className="p-3">
      <BedDouble className="mb-2 h-4 w-4 text-muted-foreground" />
      <p className="text-xs uppercase text-muted-foreground">Habitaciones</p>
      <p className="font-semibold">{property.rooms || '-'}</p>
    </Card>
    <Card className="p-3">
      <Bath className="mb-2 h-4 w-4 text-muted-foreground" />
      <p className="text-xs uppercase text-muted-foreground">Banos</p>
      <p className="font-semibold">{property.bathrooms || '-'}</p>
    </Card>
    <Card className="p-3">
      <Home className="mb-2 h-4 w-4 text-muted-foreground" />
      <p className="text-xs uppercase text-muted-foreground">Superficie</p>
      <p className="font-semibold">{property.surface_m2 || '-'} m2</p>
    </Card>
  </div>
)

const EmptyState = ({ text }: { text: string }) => (
  <Card className="p-8 text-center text-sm text-muted-foreground">{text}</Card>
)

const PropertyModal = ({
  form,
  isSaving,
  onClose,
  onSubmit,
  title
}: {
  form: ReturnType<typeof useForm<PropertyForm>>
  isSaving: boolean
  onClose: () => void
  onSubmit: (values: PropertyForm) => Promise<void>
  title: string
}) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
    <Card className="w-full max-w-3xl p-5">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-xl font-semibold">{title}</h3>
        <Button onClick={onClose} size="icon" variant="ghost">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Titulo" error={form.formState.errors.title?.message}>
            <Input {...form.register('title')} />
          </Field>
          <Field label="Direccion" error={form.formState.errors.address?.message}>
            <Input {...form.register('address')} />
          </Field>
          <Field label="Ciudad" error={form.formState.errors.city?.message}>
            <Input {...form.register('city')} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Tipo" error={form.formState.errors.type?.message}>
            <Input {...form.register('type')} />
          </Field>
          <Field label="Operacion">
            <select className="h-10 rounded-md border bg-background px-3 text-sm" {...form.register('operation')}>
              <option value="sale">Venta</option>
              <option value="rent">Alquiler</option>
            </select>
          </Field>
          <Field label="Precio" error={form.formState.errors.price?.message}>
            <Input type="number" {...form.register('price')} />
          </Field>
          <Field label="Estado">
            <select className="h-10 rounded-md border bg-background px-3 text-sm" {...form.register('status')}>
              <option value="active">Activa</option>
              <option value="available">Disponible</option>
              <option value="reserved">Reservada</option>
              <option value="sold">Vendida</option>
              <option value="rented">Alquilada</option>
              <option value="draft">Borrador</option>
            </select>
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="CP">
            <Input {...form.register('zip')} />
          </Field>
          <Field label="m2">
            <Input type="number" {...form.register('surface_m2')} />
          </Field>
          <Field label="Habitaciones">
            <Input type="number" {...form.register('rooms')} />
          </Field>
          <Field label="Banos">
            <Input type="number" {...form.register('bathrooms')} />
          </Field>
        </div>
        <Field label="Descripcion">
          <Textarea {...form.register('description')} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">
            Cancelar
          </Button>
          <Button disabled={isSaving} type="submit">
            Guardar
          </Button>
        </div>
      </form>
    </Card>
  </div>
)

const ShortlistModal = ({
  contacts,
  duplicate,
  form,
  isSaving,
  onClose,
  onViewExpediente,
  onSubmit,
  propertyTitle
}: {
  contacts: Array<{ id: string; name: string; email: string | null }>
  duplicate: { contactId: string; contactName: string } | null
  form: ReturnType<typeof useForm<ShortlistForm>>
  isSaving: boolean
  onClose: () => void
  onViewExpediente: (contactId: string) => void
  onSubmit: (values: ShortlistForm) => Promise<void>
  propertyTitle: string
}) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
    <Card className="w-full max-w-xl p-5">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-xl font-semibold">Guardar en expediente</h3>
        <Button onClick={onClose} size="icon" variant="ghost">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="rounded-md border bg-muted/30 p-3 text-sm font-medium">{propertyTitle}</div>
        <Field label="Para que cliente?" error={form.formState.errors.contact_id?.message}>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" {...form.register('contact_id')}>
            <option value="">Selecciona un cliente</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name} {contact.email ? `- ${contact.email}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notas">
          <Textarea {...form.register('notes')} />
        </Field>
        {duplicate ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">
              ⚠️ Esta propiedad ya esta guardada en el expediente de {duplicate.contactName}
            </p>
            <Button
              className="mt-3"
              onClick={() => onViewExpediente(duplicate.contactId)}
              type="button"
              variant="outline"
            >
              Ver expediente →
            </Button>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <Button type="button" variant="outline">
            Crear nuevo contacto
          </Button>
          <div className="flex gap-2">
            <Button onClick={onClose} type="button" variant="outline">
              Cancelar
            </Button>
            <Button disabled={isSaving || Boolean(duplicate)} type="submit">
              Guardar
            </Button>
          </div>
        </div>
      </form>
    </Card>
  </div>
)

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
