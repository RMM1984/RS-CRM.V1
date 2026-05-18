'use client'

import axios from 'axios'
import {
  ArrowLeft,
  Bath,
  Building2,
  ExternalLink,
  Home,
  Leaf,
  LineChart,
  MessageCircle,
  Phone,
  Ruler,
  Save,
  Sparkles,
  UserRound,
  X
} from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { JAVEA_MARKET_STATS } from '@/data/marketStats'
import { useContacts } from '@/hooks/useContacts'
import { useCreateOperation } from '@/hooks/useOperations'
import { useProperty, usePropertyMatches, useSaveToShortlist } from '@/hooks/useProperties'
import { formatPropertyPrice, formatPropertySource } from '@/lib/properties-format'
import { cn } from '@/lib/utils'
import type { ExternalProperty, Property } from '@/types/properties'

type DetailProperty = Property | ExternalProperty

const numberFormat = new Intl.NumberFormat('es-ES')

const profileLabels: Record<string, string> = {
  investor_yield: 'Inversor rentabilidad',
  investor_flip: 'Inversor reforma',
  first_home: 'Primera vivienda',
  second_home: 'Segunda residencia',
  foreign: 'Cliente extranjero',
  digital_nomad: 'Nomada digital',
  luxury_standard: 'Lujo estandar',
  luxury_premium: 'Lujo premium'
}

const toNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)

  return Number.isFinite(numeric) ? numeric : null
}

const isExternalProperty = (property: DetailProperty): property is ExternalProperty =>
  'source_url' in property && property.source !== 'internal' && property.source !== 'colaboracion'

const mainImage = (property: DetailProperty) =>
  ('image_url' in property && property.image_url) || property.images?.[0]?.url || ''

const refValue = (property: DetailProperty) =>
  'ref' in property && property.ref ? property.ref : 'external_ref' in property ? property.external_ref || property.id.slice(0, 8) : property.id.slice(0, 8)

const zoneValue = (property: DetailProperty) =>
  'zone' in property && property.zone ? property.zone : 'address' in property ? property.address : property.city

const sourceUrl = (property: DetailProperty) =>
  'source_url' in property && property.source_url && /^https?:\/\//i.test(property.source_url) ? property.source_url : null

const detailAgencyName = (property: DetailProperty) => {
  if (!isExternalProperty(property)) return null
  if (property.source === 'crown_property') return property.source_agency_name || 'Crown Property Jávea'
  if (property.source === 'vicens_ash') return property.source_agency_name || 'Vicens Ash'
  if (property.source === 'ego_real_estate') return property.source_agency_name || property.badge || 'Vicens Ash'

  return property.source_agency_name || property.badge || formatPropertySource(property.source)
}

const detailBadgeText = (property: DetailProperty) => {
  if (!isExternalProperty(property)) return property.source === 'colaboracion' ? 'COLABORACIÓN' : 'EXCLUSIVA'
  if (property.source === 'crown_property') return 'AGENCIA Crown Property'
  if (property.source === 'vicens_ash') return 'AGENCIA Vicens Ash'
  if (property.source === 'ego_real_estate') return `AGENCIA ${detailAgencyName(property)}`

  return 'AGENCIA'
}

const detailBadgeClass = (property: DetailProperty) => {
  if (!isExternalProperty(property)) {
    return property.source === 'colaboracion' ? 'bg-orange-500' : 'bg-emerald-600'
  }

  return 'bg-blue-600'
}

const priceAnalysis = (pricePerM2: number) => {
  if (pricePerM2 < JAVEA_MARKET_STATS.avgPricePerM2) {
    return {
      label: 'Por debajo de la media',
      text: 'Precio por m² competitivo frente a la media publicada para Jávea/Xàbia.',
      tone: 'emerald'
    }
  }

  if (pricePerM2 <= 5000) {
    return {
      label: 'En mercado',
      text: 'Precio por m² alineado con el rango alto habitual del mercado local.',
      tone: 'blue'
    }
  }

  return {
    label: 'Segmento premium',
    text: 'Precio por m² por encima de la media, propio de producto prime o ubicaciones singulares.',
    tone: 'amber'
  }
}

const DetailImage = ({ alt, src }: { alt: string; src: string }) => {
  const [hasError, setHasError] = useState(false)

  if (!src || hasError) {
    return <Home className="h-24 w-24 text-slate-400" />
  }

  return (
    <img
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => setHasError(true)}
      src={src}
    />
  )
}

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [externalProperty, setExternalProperty] = useState<ExternalProperty | null>(null)
  const [hasCheckedSession, setHasCheckedSession] = useState(false)
  const [isSaveOpen, setIsSaveOpen] = useState(false)
  const [contactId, setContactId] = useState('')
  const [notes, setNotes] = useState('')
  const [duplicate, setDuplicate] = useState<string | null>(null)
  const [savedFor, setSavedFor] = useState<string | null>(null)

  useEffect(() => {
    const stored = window.sessionStorage.getItem(`property-detail:${params.id}`)
    setExternalProperty(stored ? (JSON.parse(stored) as ExternalProperty) : null)
    setHasCheckedSession(true)
  }, [params.id])

  const propertyQuery = useProperty(hasCheckedSession && !externalProperty ? params.id : null)
  const matchesQuery = usePropertyMatches(hasCheckedSession && !externalProperty ? params.id : null)
  const contactsQuery = useContacts({ page: 1, limit: 100, type: 'todos', status: 'todos', search: '' })
  const saveToShortlist = useSaveToShortlist()
  const createOperation = useCreateOperation()

  const property = externalProperty ?? propertyQuery.data ?? null
  const imageUrl = property ? mainImage(property) : ''
  const price = property ? toNumber(property.price) : null
  const surface = property ? toNumber(property.surface_m2) : null
  const plot = property && 'plot_m2' in property ? toNumber(property.plot_m2) : null
  const pricePerM2 = price && surface ? Math.round(price / surface) : null
  const analysis = pricePerM2 ? priceAnalysis(pricePerM2) : null
  const selectedContact = contactsQuery.data?.contacts.find((contact) => contact.id === contactId)
  const agencyPhone = property?.source_agency_phone || '+34 965 791 091'

  const featureCards = useMemo(() => {
    if (!property) return []

    return [
      { icon: Home, label: 'Tipo', value: property.type || '-' },
      { icon: Ruler, label: 'Superficie', value: surface ? `${numberFormat.format(surface)} m²` : '-' },
      { icon: Building2, label: 'Habitaciones', value: property.rooms ? `${property.rooms} hab` : '-' },
      { icon: Bath, label: 'Baños', value: property.bathrooms ? `${property.bathrooms} ${property.bathrooms === 1 ? 'baño' : 'baños'}` : '-' },
      ...(plot ? [{ icon: Leaf, label: 'Parcela', value: `${numberFormat.format(plot)} m² parcela` }] : [])
    ]
  }, [plot, property, surface])

  const onSave = async () => {
    if (!property || !contactId) return

    try {
      await saveToShortlist.mutateAsync({
        contact_id: contactId,
        property_id: isExternalProperty(property) ? null : property.id,
        external_data: isExternalProperty(property) ? property : null,
        notes: notes || null
      })
    } catch (error) {
      const data = axios.isAxiosError(error) ? error.response?.data : null

      if (axios.isAxiosError(error) && error.response?.status === 409 && data?.code === 'ALREADY_IN_SHORTLIST') {
        setDuplicate(selectedContact?.name ?? 'este cliente')
        return
      }

      throw error
    }

    setSavedFor(selectedContact?.name ?? 'este cliente')
    setDuplicate(null)
    setIsSaveOpen(false)
    setContactId('')
    setNotes('')
  }

  if (!hasCheckedSession || (!property && propertyQuery.isLoading)) {
    return <Card className="h-96 animate-pulse bg-muted" />
  }

  if (!property) {
    return (
      <Card className="grid gap-4 p-6">
        <h2 className="text-2xl font-semibold">Propiedad no disponible</h2>
        <p className="text-sm text-muted-foreground">
          No se han encontrado datos para esta propiedad. Vuelve al listado y abre el detalle desde la tarjeta.
        </p>
        <Button className="w-fit" onClick={() => router.push('/properties')} variant="outline">
          Volver a propiedades
        </Button>
      </Card>
    )
  }

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-md border bg-slate-900">
        <div className="absolute left-4 top-4 z-10 flex gap-2">
          <Button className="bg-white text-slate-950 hover:bg-white/90" onClick={() => router.push('/properties')} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <Badge className={cn('px-3 py-1 text-white', detailBadgeClass(property))}>
            {detailBadgeText(property)}
          </Badge>
        </div>
        <Button className="absolute right-4 top-4 z-10 gap-2" onClick={() => setIsSaveOpen(true)}>
          <Save className="h-4 w-4" />
          Guardar en expediente
        </Button>
        <div className="grid h-[440px] place-items-center bg-slate-100">
          {imageUrl ? (
            <DetailImage alt={property.title} src={imageUrl} />
          ) : (
            <Home className="h-24 w-24 text-slate-400" />
          )}
        </div>
      </section>

      {savedFor ? (
        <Card className="flex items-center justify-between border-emerald-200 bg-emerald-50 p-4 text-sm">
          <span className="font-medium text-emerald-900">Guardado en el expediente de {savedFor}</span>
          <Button onClick={() => setSavedFor(null)} size="icon" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </Card>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="grid gap-5">
          <div>
            <h1 className="text-3xl font-semibold leading-tight lg:text-4xl">{property.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {zoneValue(property)} · {property.city} · Ref: {refValue(property)}
            </p>
            <p className="mt-5 text-4xl font-semibold">{formatPropertyPrice(property.price, property.operation)}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {featureCards.map(({ icon: Icon, label, value }) => (
              <Card className="p-4" key={label}>
                <Icon className="mb-3 h-5 w-5 text-primary" />
                <p className="text-xs uppercase text-muted-foreground">{label}</p>
                <p className="mt-1 font-semibold">{value}</p>
              </Card>
            ))}
          </div>

          {pricePerM2 && analysis ? (
            <Card className="grid gap-4 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold">Precio por metro cuadrado</h2>
                  <p className="text-sm text-muted-foreground">Comparativa orientativa con la media de Jávea/Xàbia.</p>
                </div>
                <Badge
                  className={cn(
                    analysis.tone === 'emerald' && 'bg-emerald-100 text-emerald-800',
                    analysis.tone === 'blue' && 'bg-blue-100 text-blue-800',
                    analysis.tone === 'amber' && 'bg-amber-100 text-amber-800'
                  )}
                >
                  {analysis.label}
                </Badge>
              </div>
              <div className="grid gap-2 text-sm">
                <MetricRow label="Esta propiedad" value={`€ ${numberFormat.format(pricePerM2)}/m²`} />
                <MetricRow label="Media Jávea" value={`€ ${numberFormat.format(JAVEA_MARKET_STATS.avgPricePerM2)}/m²`} />
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, Math.max(8, (pricePerM2 / 6500) * 100))}%` }}
                />
              </div>
              <p className="text-sm text-slate-700">{analysis.text}</p>
            </Card>
          ) : null}

          <Card className="p-5">
            <h2 className="font-semibold">Descripción</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {property.description || 'Sin descripción disponible.'}
            </p>
          </Card>

          {!isExternalProperty(property) ? (
            <Card className="grid gap-4 p-5">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <UserRound className="h-5 w-5 text-primary" />
                  Clientes que podrían estar interesados
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Top 5 calculado con presupuesto, zonas y necesidades del perfil comprador.
                </p>
              </div>
              {matchesQuery.isLoading ? <div className="h-28 animate-pulse rounded-md bg-muted" /> : null}
              {!matchesQuery.isLoading && !matchesQuery.data?.length ? (
                <p className="rounded-md border p-4 text-sm text-muted-foreground">
                  Añade perfiles a tus contactos para ver sugerencias aquí.
                </p>
              ) : null}
              {matchesQuery.data?.map((match, index) => (
                <div className="rounded-md border p-4" key={match.contact.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        {index + 1}. {match.contact.name}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {profileLabels[match.contact.client_profile] ?? match.contact.client_profile}
                        {match.contact.budget_max ? ` - hasta ${formatPropertyPrice(match.contact.budget_max, 'sale')}` : ''}
                      </p>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-800">{match.percentage}%</Badge>
                  </div>
                  <div className="mt-3 grid gap-1 text-sm text-slate-700">
                    {match.reasons.slice(0, 4).map((reason) => (
                      <span key={reason}>✓ {reason}</span>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {match.contact.phone ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={`tel:${match.contact.phone.replace(/\s/g, '')}`}>
                          <Phone className="mr-2 h-4 w-4" />
                          Llamar
                        </a>
                      </Button>
                    ) : null}
                    {match.contact.phone ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={`https://wa.me/${match.contact.phone.replace(/[^\d]/g, '')}`} rel="noreferrer" target="_blank">
                          <MessageCircle className="mr-2 h-4 w-4" />
                          WhatsApp
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      disabled={createOperation.isPending}
                      onClick={async () => {
                        await createOperation.mutateAsync({
                          contact_id: match.contact.id,
                          property_id: property.id,
                          type: property.operation === 'rent' ? 'rent' : 'sale',
                          stage: 'lead',
                          value: price,
                          notes: `Operacion creada desde matching de propiedad: ${property.title}`
                        })
                        router.push('/operations')
                      }}
                      size="sm"
                    >
                      + Op.
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          ) : null}
        </div>

        <aside className="grid h-fit gap-4">
          <Card className="grid gap-3 p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Building2 className="h-5 w-5 text-primary" />
              {detailAgencyName(property) || 'RS-CRM'}
            </h2>
            <p className="text-sm text-muted-foreground">Ref: {refValue(property)}</p>
            <Button asChild className="gap-2">
              <a href={`tel:${agencyPhone.replace(/\s/g, '')}`}>
                <Phone className="h-4 w-4" />
                {agencyPhone}
              </a>
            </Button>
            {sourceUrl(property) ? (
              <Button asChild variant="outline">
                <a href={sourceUrl(property) ?? '#'} rel="noreferrer" target="_blank">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ver anuncio original
                </a>
              </Button>
            ) : null}
          </Card>

          <Card className="grid gap-4 p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <LineChart className="h-5 w-5 text-primary" />
              Mercado Jávea/Xàbia
            </h2>
            <div className="grid gap-2 text-sm">
              <MetricRow label="Precio medio" value={`${numberFormat.format(JAVEA_MARKET_STATS.avgPricePerM2)} €/m²`} />
              <MetricRow label="Var. interanual" value={`+${JAVEA_MARKET_STATS.yearlyChange.toString().replace('.', ',')}%`} />
              <MetricRow label="Compradores extranj." value={`${JAVEA_MARKET_STATS.foreignBuyersPercent}%`} />
              <MetricRow label="Oferta disponible" value={`${numberFormat.format(JAVEA_MARKET_STATS.availableProperties)} props`} />
            </div>
            <div className="rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              {JAVEA_MARKET_STATS.ranking}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Precios por zona</p>
              <div className="grid gap-2 text-sm">
                {JAVEA_MARKET_STATS.priceByZone.map((zone) => (
                  <MetricRow key={zone.zone} label={zone.zone} value={`~ ${numberFormat.format(zone.pricePerM2)} €/m²`} />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Principales compradores</p>
              <p className="text-sm text-muted-foreground">{JAVEA_MARKET_STATS.topBuyers.join(' · ')}</p>
            </div>
          </Card>

          {pricePerM2 && analysis ? (
            <Card className="grid gap-3 p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <Sparkles className="h-5 w-5 text-primary" />
                Análisis de precio
              </h2>
              <MetricRow label="€/m² propiedad" value={`${numberFormat.format(pricePerM2)} €`} />
              <MetricRow label="€/m² medio Jávea" value={`${numberFormat.format(JAVEA_MARKET_STATS.avgPricePerM2)} €`} />
              <p className="text-sm text-slate-700">{analysis.text}</p>
            </Card>
          ) : null}
        </aside>
      </section>

      <p className="text-xs text-muted-foreground">
        Datos de mercado: {JAVEA_MARKET_STATS.source}. Período: {JAVEA_MARKET_STATS.period}. Actualizado:{' '}
        {JAVEA_MARKET_STATS.updatedAt}. Datos orientativos.
      </p>

      {isSaveOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Card className="w-full max-w-lg p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Guardar en expediente</h2>
                <p className="mt-1 text-sm text-muted-foreground">{property.title}</p>
              </div>
              <Button onClick={() => setIsSaveOpen(false)} size="icon" variant="ghost">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-medium">
                ¿Para qué cliente?
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  onChange={(event) => {
                    setContactId(event.target.value)
                    setDuplicate(null)
                  }}
                  value={contactId}
                >
                  <option value="">Selecciona un contacto</option>
                  {(contactsQuery.data?.contacts ?? []).map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-2">
                <Label>Notas</Label>
                <Textarea onChange={(event) => setNotes(event.target.value)} rows={4} value={notes} />
              </div>
              {duplicate ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Esta propiedad ya está guardada en el expediente de {duplicate}.
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button onClick={() => setIsSaveOpen(false)} variant="outline">
                  Cancelar
                </Button>
                <Button disabled={!contactId || saveToShortlist.isPending} onClick={() => void onSave()}>
                  Guardar
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}

const MetricRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-semibold">{value}</span>
  </div>
)
