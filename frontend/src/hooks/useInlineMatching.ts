import { useMemo } from 'react'
import type { Contact } from '@/types/contacts'
import type { ExternalProperty, Property } from '@/types/properties'

type MatchableProperty = Property | ExternalProperty

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

export const useInlineMatching = (properties: MatchableProperty[], contacts: Contact[]) =>
  useMemo(() => {
    const result = new Map<string, Contact[]>()
    const profiledContacts = contacts.filter((contact) => contact.client_profile && contact.budget_max)

    properties.forEach((property) => {
      const price = Number(property.price)
      const text = propertyText(property)

      const matches = profiledContacts
        .map((contact) => {
          let score = 0
          const budgetMax = Number(contact.budget_max)

          if (Number.isFinite(price) && Number.isFinite(budgetMax) && budgetMax < price * 0.9) {
            return { contact, score: -1 }
          }

          if (Number.isFinite(price) && Number.isFinite(budgetMax) && budgetMax >= price) {
            score += 30
          }

          if (contact.needs_pool && text.includes('piscina')) score += 15
          if (contact.needs_sea_view && text.includes('mar')) score += 15
          if (zoneMatches(property, contact.preferred_zones)) score += 20
          if (contact.client_profile === 'luxury_premium' && price > 1500000) score += 20
          if (contact.client_profile === 'luxury_standard' && price > 600000 && price <= 1500000) score += 20
          if (contact.client_profile === 'foreign') score += 10

          return { contact, score }
        })
        .filter((match) => match.score > 20)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((match) => match.contact)

      if (matches.length) {
        result.set(propertyId(property), matches)
      }
    })

    return result
  }, [contacts, properties])
