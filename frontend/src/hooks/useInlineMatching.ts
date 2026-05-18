import { useMemo } from 'react'
import type { Contact } from '@/types/contacts'
import type { ExternalProperty, Property } from '@/types/properties'

type MatchableProperty = Property | ExternalProperty
export type InlinePropertyMatch = {
  contact: Contact
  score: number
  percentage: number
  reasons: string[]
}

const normalize = (value?: string | null) =>
  (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const propertyId = (property: MatchableProperty) => property.id

const propertyText = (property: MatchableProperty) =>
  normalize(
    [
      property.title,
      property.city,
      'address' in property ? property.address : property.zone,
      property.description,
      'search_text' in property ? property.search_text : null
    ]
      .filter(Boolean)
      .join(' ')
  )

const zoneMatches = (property: MatchableProperty, zones?: string[] | null) => {
  if (!zones?.length) return false
  const text = normalize(`${property.city} ${'address' in property ? property.address : property.zone ?? ''}`)

  return zones.some((zone) => text.includes(normalize(zone)))
}

export const getTopMatchesForProperty = (property: MatchableProperty, contacts: Contact[]): InlinePropertyMatch[] => {
  const profiledContacts = contacts.filter((contact) => contact.client_profile && contact.budget_max)
  const price = Number(property.price)
  const text = propertyText(property)

  return profiledContacts
    .map((contact) => {
      let score = 0
      const reasons: string[] = []
      const budgetMax = Number(contact.budget_max)

      if (Number.isFinite(price) && Number.isFinite(budgetMax) && budgetMax < price * 0.9) {
        return { contact, score: -1, percentage: 0, reasons }
      }

      if (Number.isFinite(price) && Number.isFinite(budgetMax) && budgetMax >= price) {
        score += 30
        reasons.push('Dentro de presupuesto')
      }

      if (contact.needs_pool && text.includes('piscina')) {
        score += 15
        reasons.push('Piscina requerida')
      }

      if (contact.needs_sea_view && text.includes('mar')) {
        score += 15
        reasons.push('Vistas al mar')
      }

      if (contact.needs_terrace && (text.includes('terraza') || text.includes('terrace'))) {
        score += 10
        reasons.push('Terraza requerida')
      }

      if (zoneMatches(property, contact.preferred_zones)) {
        score += 20
        reasons.push('Zona preferida')
      }

      if (contact.client_profile === 'luxury_premium' && price > 1500000) {
        score += 20
        reasons.push('Perfil lujo premium')
      }

      if (contact.client_profile === 'luxury_standard' && price > 600000 && price <= 1500000) {
        score += 20
        reasons.push('Perfil lujo estándar')
      }

      if (contact.client_profile === 'foreign') {
        score += 10
        reasons.push('Cliente internacional')
      }

      return {
        contact,
        score,
        percentage: Math.min(99, Math.round(score)),
        reasons
      }
    })
    .filter((match) => match.score > 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

export const useInlineMatching = (properties: MatchableProperty[], contacts: Contact[]) =>
  useMemo(() => {
    const result = new Map<string, Contact[]>()

    properties.forEach((property) => {
      const matches = getTopMatchesForProperty(property, contacts).map((match) => match.contact)

      if (matches.length) {
        result.set(propertyId(property), matches)
      }
    })

    return result
  }, [contacts, properties])
