import type { PoolClient } from 'pg'

type MatchContact = {
  id: string
  name: string
  email: string | null
  phone: string | null
  type: string
  client_profile: string
  budget_min: number | string | null
  budget_max: number | string | null
  rooms_min: number | null
  bathrooms_min: number | null
  surface_min: number | null
  price_per_m2_max: number | string | null
  needs_renovation: boolean
  needs_pool: boolean
  needs_sea_view: boolean
  needs_garden: boolean
  needs_parking: boolean
  preferred_zones: string[] | null
  languages: string[] | null
  requirements_text: string | null
}

type MatchProperty = {
  id: string
  title: string
  address?: string | null
  city?: string | null
  type?: string | null
  price: number | string | null
  surface_m2?: number | string | null
  rooms?: number | null
  bathrooms?: number | null
  description?: string | null
  external_badge?: string | null
  source?: string | null
}

type ContactMatch = {
  contact: MatchContact
  score: number
  percentage: number
  reasons: string[]
}

const touristZones = ['arenal', 'puerto', 'montanar', 'balcon al mar', 'cap marti', 'portichol', 'granadella']

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const toNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)

  return Number.isFinite(numeric) ? numeric : null
}

const includesAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term))

const propertySearchText = (property: MatchProperty) =>
  normalizeText(
    [
      property.title,
      property.address,
      property.city,
      property.type,
      property.description,
      property.external_badge,
      property.source
    ]
      .filter(Boolean)
      .join(' ')
  )

const preferredZoneMatch = (contact: MatchContact, propertyText: string) => {
  const zones = contact.preferred_zones ?? []
  const match = zones.find((zone) => propertyText.includes(normalizeText(zone)))

  return match ?? null
}

export const matchContactsToProperty = (property: MatchProperty, contacts: MatchContact[]): ContactMatch[] => {
  const price = toNumber(property.price) ?? 0
  const surface = toNumber(property.surface_m2)
  const pricePerM2 = price && surface ? Math.round(price / surface) : null
  const text = propertySearchText(property)

  return contacts
    .map((contact) => {
      let score = 0
      const reasons: string[] = []
      const budgetMax = toNumber(contact.budget_max)
      const pricePerM2Max = toNumber(contact.price_per_m2_max)

      if (budgetMax !== null && price <= budgetMax) {
        score += 30
        reasons.push('Dentro de presupuesto')
      } else if (budgetMax !== null && price > budgetMax) {
        score -= 50
      }

      if (!contact.rooms_min || (property.rooms !== null && property.rooms !== undefined && property.rooms >= contact.rooms_min)) {
        score += 15
        reasons.push('Habitaciones suficientes')
      }

      if (!contact.bathrooms_min || (property.bathrooms !== null && property.bathrooms !== undefined && property.bathrooms >= contact.bathrooms_min)) {
        score += 5
      }

      if (!contact.surface_min || (surface !== null && surface >= contact.surface_min)) {
        score += 10
      }

      if (contact.needs_pool && includesAny(text, ['piscina', 'pool', 'swimming', 'zwembad', 'schwimmbad'])) {
        score += 15
        reasons.push('Tiene piscina')
      }

      if (contact.needs_sea_view && includesAny(text, ['mar', 'sea', 'meer', 'zee', 'mer', 'vista', 'view'])) {
        score += 15
        reasons.push('Vistas al mar')
      }

      if (contact.needs_garden && includesAny(text, ['jardin', 'garden', 'garten', 'tuin', 'terraza', 'terrace'])) {
        score += 10
        reasons.push('Tiene jardin')
      }

      if (contact.needs_parking && includesAny(text, ['parking', 'garaje', 'garage', 'plaza'])) {
        score += 10
        reasons.push('Tiene parking')
      }

      if (contact.needs_renovation && includesAny(text, ['reformar', 'renovar', 'renovation', 'needs work', 'para reformar'])) {
        score += 20
        reasons.push('Necesita reforma')
      }

      switch (contact.client_profile) {
        case 'luxury_premium':
          if (price > 1500000) score += 25
          if (pricePerM2 && pricePerM2 > 6000) score += 15
          break
        case 'luxury_standard':
          if (price >= 600000 && price <= 1500000) score += 20
          break
        case 'investor_yield':
          if (pricePerM2 && pricePerM2Max && pricePerM2 < pricePerM2Max) score += 20
          if (touristZones.some((zone) => text.includes(zone))) score += 10
          break
        case 'investor_flip':
          if (contact.needs_renovation) score += 20
          if (pricePerM2 && pricePerM2 < 2500) score += 15
          break
        case 'foreign':
          if (price > 300000) score += 10
          if (contact.needs_sea_view) score += 10
          break
        case 'second_home':
          if (property.type === 'apartment') score += 10
          if (contact.needs_pool) score += 10
          break
        case 'first_home':
          if (budgetMax && price <= budgetMax * 1.1) score += 15
          break
        case 'digital_nomad':
          if (surface && surface >= 80) score += 10
          if (contact.needs_garden) score += 10
          break
      }

      const zone = preferredZoneMatch(contact, text)
      if (zone) {
        score += 20
        reasons.push(`Zona preferida: ${zone}`)
      }

      return {
        contact,
        score,
        percentage: Math.max(0, Math.min(100, score)),
        reasons
      }
    })
    .filter((match) => match.score > 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

export const getPropertyMatches = async (db: PoolClient, property: MatchProperty) => {
  const { rows } = await db.query<MatchContact>(
    `SELECT
      id,
      full_name AS name,
      email,
      phone,
      type,
      client_profile,
      budget_min,
      budget_max,
      rooms_min,
      bathrooms_min,
      surface_min,
      price_per_m2_max,
      COALESCE(needs_renovation, false) AS needs_renovation,
      COALESCE(needs_pool, false) AS needs_pool,
      COALESCE(needs_sea_view, false) AS needs_sea_view,
      COALESCE(needs_garden, false) AS needs_garden,
      COALESCE(needs_parking, false) AS needs_parking,
      preferred_zones,
      languages,
      requirements_text
     FROM contacts
     WHERE active = true AND client_profile IS NOT NULL`
  )

  return matchContactsToProperty(property, rows)
}
