'use client'

import { Phone, Save, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatPropertyPrice, formatPropertySource } from '@/lib/properties-format'
import type { ExternalProperty } from '@/types/properties'

const agencyName = (property: ExternalProperty) => {
  if (property.source === 'crown_property') return property.source_agency_name || 'Crown Property Jávea'
  if (property.source === 'vicens_ash') return property.source_agency_name || 'Vicens Ash'
  if (property.source === 'ego_real_estate') return property.source_agency_name || property.badge || 'Vicens Ash'

  return property.source_agency_name || property.badge || formatPropertySource(property.source)
}

const badgeName = (property: ExternalProperty) => {
  if (property.source === 'crown_property') return 'Crown Property'
  if (property.source === 'vicens_ash') return 'Vicens Ash'
  if (property.source === 'ego_real_estate') return agencyName(property)

  return formatPropertySource(property.source)
}

export default function ExternalPropertyPage({ params }: { params: { id: string } }) {
  const [property, setProperty] = useState<ExternalProperty | null>(null)

  useEffect(() => {
    const stored = window.sessionStorage.getItem(`external-property:${params.id}`)
    setProperty(stored ? (JSON.parse(stored) as ExternalProperty) : null)
  }, [params.id])

  if (!property) {
    return (
      <Card className="grid gap-4 p-6">
        <h2 className="text-2xl font-semibold">Propiedad de agencia</h2>
        <p className="text-sm text-muted-foreground">
          No hay datos locales para esta propiedad externa. Vuelve a la busqueda y abre el detalle desde la tarjeta.
        </p>
        <Button asChild className="w-fit" variant="outline">
          <Link href="/properties">Volver a propiedades</Link>
        </Button>
      </Card>
    )
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <div>
          <Badge className="bg-blue-600 text-white">AGENCIA {badgeName(property)}</Badge>
          <p className="mt-2 text-sm font-medium text-muted-foreground">{agencyName(property)}</p>
          <h2 className="mt-3 text-3xl font-semibold">{property.title}</h2>
          <p className="text-sm text-muted-foreground">{property.city}</p>
        </div>
        <Button asChild size="icon" variant="ghost">
          <Link href="/properties">
            <X className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <div className="grid h-[420px] place-items-center bg-blue-50">
            {property.image_url ? (
              <img alt={property.title} className="h-full w-full object-cover" src={property.image_url} />
            ) : (
              <span className="text-sm text-muted-foreground">Sin fotografia</span>
            )}
          </div>
        </Card>

        <div className="grid gap-4">
          <Card className="p-5">
            <p className="text-3xl font-semibold">{formatPropertyPrice(property.price, property.operation)}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <Info label="Tipo" value={property.type} />
              <Info label="m2" value={property.surface_m2 ? `${property.surface_m2}` : '-'} />
              <Info label="Hab." value={property.rooms ? `${property.rooms}` : '-'} />
            </div>
          </Card>

          <Card className="grid gap-3 p-5">
            <h3 className="font-semibold">Agencia</h3>
            <p className="text-sm">{agencyName(property)}</p>
            <div className="grid gap-2">
              {property.source_agency_phone ? (
                <Button asChild className="gap-2">
                  <a href={`tel:${property.source_agency_phone}`}>
                    <Phone className="h-4 w-4" /> Llamar
                  </a>
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <a href={property.source_url} rel="noreferrer" target="_blank">
                  Ver anuncio original
                </a>
              </Button>
              <Button className="gap-2" disabled>
                <Save className="h-4 w-4" />
                Guardar en expediente
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold">Descripcion</h3>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {property.description || 'Sin descripcion disponible.'}
        </p>
      </Card>
    </div>
  )
}

const Info = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border p-3">
    <p className="text-xs uppercase text-muted-foreground">{label}</p>
    <p className="mt-1 font-semibold">{value}</p>
  </div>
)
