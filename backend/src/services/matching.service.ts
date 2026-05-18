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
  needs_terrace: boolean
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
  warnings: string[]
  match_reasons: string[]
}

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

const propertyTypeMatches = (property: MatchProperty, candidates: string[]) => {
  const type = normalizeText(property.type ?? '')
  const text = propertySearchText(property)

  return candidates.some((candidate) => type === candidate || text.includes(candidate))
}

const featureMatches = (text: string, terms: string[]) => includesAny(text, terms)

export const matchContactsToProperty = (property: MatchProperty, contacts: MatchContact[]): ContactMatch[] => {
  const price = toNumber(property.price) ?? 0
  const text = propertySearchText(property)

  return contacts
    .map((contact) => {
      let score = 0
      const reasons: string[] = []
      const warnings: string[] = []
      const budgetMax = toNumber(contact.budget_max)

      if (budgetMax !== null && price > budgetMax * 1.1) {
        return null
      }

      if (contact.rooms_min && property.rooms !== null && property.rooms !== undefined && property.rooms < contact.rooms_min) {
        return null
      }

      switch (contact.client_profile) {
        case 'luxury_premium':
          if (price < 800000) return null
          break
        case 'luxury_standard':
          if (price < 400000) return null
          break
        case 'first_home':
          if (price > 450000) return null
          break
        case 'investor_flip':
          if (price > 500000) return null
          break
      }

      if (budgetMax !== null) {
        if (price <= budgetMax * 0.8) {
          score += 40
          reasons.push('Dentro de presupuesto')
        } else if (price <= budgetMax * 0.9) {
          score += 30
          reasons.push('Dentro de presupuesto')
        } else if (price <= budgetMax) {
          score += 20
          reasons.push('Dentro de presupuesto')
        } else {
          score += 10
          warnings.push(`Hasta un 10% sobre presupuesto (${Math.round(((price - budgetMax) / budgetMax) * 100)}%)`)
        }
      }

      if (contact.rooms_min && property.rooms !== null && property.rooms !== undefined && property.rooms >= contact.rooms_min) {
        reasons.push('Habitaciones suficientes')
      } else if (contact.rooms_min && (property.rooms === null || property.rooms === undefined)) {
        warnings.push(`Busca mínimo ${contact.rooms_min} hab (sin dato)`)
      }

      if (contact.needs_pool && featureMatches(text, ['piscina', 'pool', 'swimming', 'zwembad', 'schwimmbad'])) {
        score += 10
        reasons.push('Piscina requerida')
      }

      if (contact.needs_sea_view && featureMatches(text, ['mar', 'sea', 'meer', 'zee', 'mer', 'vista', 'view'])) {
        score += 10
        reasons.push('Vistas al mar requeridas')
      }

      if (contact.needs_garden && featureMatches(text, ['jardin', 'garden', 'garten', 'tuin', 'terraza', 'terrace'])) {
        score += 10
        reasons.push('Jardín requerido')
      }

      if (contact.needs_terrace && featureMatches(text, ['terraza', 'terrace', 'terrasse'])) {
        score += 10
        reasons.push('Terraza requerida')
      }

      if (contact.needs_parking && featureMatches(text, ['parking', 'garaje', 'garage', 'plaza'])) {
        score += 10
        reasons.push('Parking requerido')
      }

      switch (contact.client_profile) {
        case 'luxury_premium':
          if (propertyTypeMatches(property, ['villa', 'chalet', 'finca'])) score += 15
          break
        case 'luxury_standard':
          if (propertyTypeMatches(property, ['villa', 'chalet', 'finca'])) score += 15
          break
        case 'investor_yield':
          if (propertyTypeMatches(property, ['apartment', 'apartamento', 'piso'])) score += 15
          break
        case 'investor_flip':
          if (featureMatches(text, ['reforma', 'reformar', 'renovar', 'renovation', 'needs work', 'para reformar'])) {
            score += 10
            reasons.push('Potencial de reforma')
          }
          break
        case 'foreign':
          score += 10
          break
        case 'second_home':
          if (propertyTypeMatches(property, ['apartment', 'apartamento', 'piso'])) score += 15
          break
        case 'first_home':
          if (propertyTypeMatches(property, ['apartment', 'apartamento', 'piso'])) score += 15
          break
        case 'digital_nomad':
          if (propertyTypeMatches(property, ['house', 'villa', 'chalet', 'casa'])) score += 10
          break
      }

      const zone = preferredZoneMatch(contact, text)
      if (zone) {
        score += 25
        reasons.push(`Zona ${zone} (preferida)`)
      }

      return {
        contact,
        score,
        percentage: Math.min(99, Math.round(score)),
        reasons,
        warnings,
        match_reasons: reasons
      }
    })
    .filter((match): match is ContactMatch => match !== null && match.score >= 25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
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
      COALESCE(needs_terrace, false) AS needs_terrace,
      preferred_zones,
      languages,
      requirements_text
     FROM contacts
     WHERE active = true AND client_profile IS NOT NULL`
  )

  return matchContactsToProperty(property, rows)
}
