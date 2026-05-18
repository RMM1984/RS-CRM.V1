export type ParsedQuery = {
  type: string | null
  operation?: 'sale' | 'rent' | null
  price_max: number | null
  rooms_exact: number | null
  rooms_min: number | null
  bathrooms_min: number | null
  surface_min: number | null
  features: string[]
  raw_terms: string[]
  detected_language: 'es' | 'en' | 'de' | 'nl' | 'fr' | 'unknown'
}

export type SearchableProperty = {
  price?: number | string | null
  rooms?: number | null
  bathrooms?: number | null
  surface_m2?: number | string | null
  type?: string | null
  detected_type?: string | null
  search_text?: string | null
  title?: string | null
  description?: string | null
  city?: string | null
  address?: string | null
  zone?: string | null
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const TYPO_CORRECTIONS: Record<string, string> = {
  appartment: 'apartment',
  appartements: 'apartment',
  aprtment: 'apartment',
  aparment: 'apartment',
  cotagge: 'cottage',
  cotage: 'cottage',
  cottge: 'cottage',
  vlla: 'villa',
  bungallow: 'bungalow',
  bungalow: 'bungalow',
  chalet: 'chalet',
  swiming: 'swimming',
  swimimg: 'swimming',
  swimmig: 'swimming',
  renavtion: 'renovation',
  renovaton: 'renovation',
  renovation: 'renovation',
  terasse: 'terrace',
  terace: 'terrace',
  terraza: 'terrace',
  balconey: 'balcony',
  balkon: 'balcony',
  garaj: 'garage',
  parkng: 'parking',
  jacuzi: 'jacuzzi',
  jakuzzi: 'jacuzzi',
  countrisede: 'countryside',
  countrside: 'countryside',
  coutry: 'country',
  'lees than': 'less than',
  'les than': 'less than',
  'uo to': 'up to',
  upto: 'up to',
  'hast zu': 'bis zu',
  habitaciones: 'hab',
  habitacion: 'hab',
  dormitorios: 'hab',
  dormitorio: 'hab',
  bedrooms: 'bed',
  bedroom: 'bed',
  schlafzimmer: 'zimmer',
  slaapkamers: 'slaap',
  chambres: 'chambre'
}

const TYPE_KEYWORDS: Record<string, Record<string, string[]>> = {
  land: {
    es: ['terreno', 'parcela', 'solar', 'finca rustica', 'suelo', 'huerta', 'campo', 'terreno urbano'],
    en: ['land', 'plot', 'terrain', 'field', 'site', 'building plot', 'rustic land'],
    de: ['grundstuck', 'parzelle', 'baugrundstuck', 'acker'],
    nl: ['grond', 'perceel', 'kavel', 'bouwgrond'],
    fr: ['terrain', 'parcelle', 'fonds', 'champ']
  },
  commercial: {
    es: ['local', 'oficina', 'negocio', 'nave', 'comercial', 'restaurante', 'hotel', 'despacho'],
    en: ['commercial', 'office', 'shop', 'retail', 'warehouse', 'business', 'store', 'premises'],
    de: ['gewerbe', 'buro', 'laden', 'geschaft', 'lager'],
    nl: ['bedrijf', 'kantoor', 'winkel', 'pand', 'loods'],
    fr: ['commerce', 'bureau', 'boutique', 'entrepot']
  },
  garage: {
    es: ['garaje', 'trastero', 'almacen', 'plaza de garaje'],
    en: ['garage', 'parking space', 'car park'],
    de: ['garage', 'parkplatz', 'stellplatz', 'tiefgarage'],
    nl: ['garage', 'parkeerplaats', 'berging'],
    fr: ['garage', 'box', 'stationnement']
  },
  village_house: {
    es: ['casa de pueblo', 'pueblo', 'cortijo', 'masia', 'rustica', 'finca de pueblo', 'cottage'],
    en: ['village house', 'cottage', 'town house', 'village property', 'country house'],
    de: ['dorfhaus', 'stadthaus', 'landhaus', 'bauernhaus', 'landleben', 'dorf'],
    nl: ['dorpshuis', 'stadswoning', 'boerenwoning', 'platteland'],
    fr: ['maison de village', 'maison de bourg', 'maison de campagne', 'corps de ferme', 'charmante maison']
  },
  townhouse: {
    es: ['adosado', 'adosada', 'pareado', 'pareada', 'bungalow', 'unifamiliar adosada'],
    en: ['townhouse', 'terraced', 'semi detached', 'bungalow', 'end of terrace', 'linked'],
    de: ['reihenhaus', 'doppelhaus', 'bungalow'],
    nl: ['rijtjeshuis', 'twee onder een kap', 'bungalow'],
    fr: ['maison en bande', 'mitoyenne', 'bungalow']
  },
  villa: {
    es: ['villa', 'chalet', 'finca', 'casa independiente', 'casa con terreno', 'mansion', 'casa grande'],
    en: ['villa', 'chalet', 'detached', 'manor', 'estate', 'finca', 'farmhouse', 'mountain house'],
    de: ['villa', 'chalet', 'freistehendes haus', 'einfamilienhaus', 'anwesen', 'berghaus'],
    nl: ['villa', 'chalet', 'vrijstaand', 'herenhuis', 'landhuis', 'bergwoning'],
    fr: ['villa', 'chalet', 'maison individuelle', 'propriete', 'manoir', 'bastide']
  },
  apartment: {
    es: ['piso', 'apartamento', 'apto', 'estudio', 'bajo', 'atico', 'loft', 'duplex', 'planta baja', 'primero', 'segundo', 'tercero'],
    en: ['apartment', 'flat', 'studio', 'loft', 'duplex', 'penthouse', 'attic flat', 'ground floor flat', 'first floor', 'second floor'],
    de: ['wohnung', 'apartment', 'studio', 'loft', 'dachgeschoss', 'penthouse', 'erdgeschoss'],
    nl: ['appartement', 'flat', 'studio', 'loft', 'penthouse', 'dakwoning', 'begane grond'],
    fr: ['appartement', 'studio', 'loft', 'duplex', 'penthouse', 'attique', 'rez de chaussee']
  }
}

const TYPE_ORDER = ['land', 'commercial', 'garage', 'village_house', 'townhouse', 'villa', 'apartment']

const FEATURE_KEYWORDS: Record<string, Record<string, string[]>> = {
  pool: {
    es: ['piscina', 'alberca'],
    en: ['pool', 'swimming pool', 'swim', 'swimming'],
    de: ['pool', 'schwimmbad', 'swimmingpool'],
    nl: ['zwembad', 'pool'],
    fr: ['piscine', 'bassin']
  },
  sea_view: {
    es: ['mar', 'vistas', 'vista mar', 'primera linea', 'playa', 'marina', 'oceano'],
    en: ['sea', 'ocean', 'sea view', 'water view', 'beach', 'seafront', 'waterfront'],
    de: ['meer', 'meerblick', 'seeblick', 'strand', 'aussicht'],
    nl: ['zee', 'zeezicht', 'strand', 'uitzicht', 'water'],
    fr: ['mer', 'vue mer', 'plage', 'bord de mer', 'vue']
  },
  terrace: {
    es: ['terraza', 'patio'],
    en: ['terrace', 'patio', 'outdoor space'],
    de: ['terrasse', 'patio'],
    nl: ['terras', 'patio'],
    fr: ['terrasse', 'patio']
  },
  balcony: {
    es: ['balcon', 'balcony'],
    en: ['balcony', 'balconies'],
    de: ['balkon'],
    nl: ['balkon'],
    fr: ['balcon']
  },
  garden: {
    es: ['jardin', 'huerto', 'zona verde'],
    en: ['garden', 'yard', 'lawn', 'green space', 'trees'],
    de: ['garten', 'hof'],
    nl: ['tuin', 'hof'],
    fr: ['jardin', 'cour']
  },
  garage: {
    es: ['garaje', 'parking', 'plaza', 'aparcamiento'],
    en: ['garage', 'parking', 'car space'],
    de: ['garage', 'parkplatz', 'stellplatz'],
    nl: ['garage', 'parkeerplaats'],
    fr: ['garage', 'parking', 'place']
  },
  renovation: {
    es: ['reformar', 'reforma', 'renovar', 'para reformar', 'a reformar', 'reformado', 'para renovar'],
    en: ['renovation', 'renovate', 'refurbish', 'to renovate', 'fixer upper', 'reform', 'needs work', 'project'],
    de: ['renovierung', 'renovieren', 'sanierung', 'zu renovieren', 'umbau'],
    nl: ['renovatie', 'renoveren', 'opknappen', 'verbouwen', 'te renoveren'],
    fr: ['renovation', 'renover', 'a renover', 'travaux', 'rafraichir']
  },
  mountain: {
    es: ['montana', 'sierra', 'monte', 'altura'],
    en: ['mountain', 'hill', 'elevated', 'hillside', 'hilltop', 'mountains', 'hidden'],
    de: ['berg', 'gebirge', 'hohenlage', 'aussicht'],
    nl: ['berg', 'heuvel', 'hoog gelegen'],
    fr: ['montagne', 'colline', 'hauteur', 'dominant']
  },
  countryside: {
    es: ['campo', 'rural', 'rustico', 'naturaleza', 'tranquilo', 'tranquila', 'zona rural'],
    en: ['countryside', 'rural', 'nature', 'peaceful', 'quiet', 'secluded', 'country', 'charming'],
    de: ['land', 'landlich', 'natur', 'ruhig', 'idyllisch'],
    nl: ['landelijk', 'natuur', 'rustig', 'platteland'],
    fr: ['campagne', 'rural', 'nature', 'calme', 'charmant', 'champetre']
  },
  jacuzzi: {
    es: ['jacuzzi', 'hidromasaje', 'spa'],
    en: ['jacuzzi', 'hot tub', 'spa', 'whirlpool'],
    de: ['jacuzzi', 'whirlpool', 'spa'],
    nl: ['jacuzzi', 'bubbelbad', 'spa'],
    fr: ['jacuzzi', 'spa', 'bain a remous']
  },
  views: {
    es: ['panoramica', 'panoramicas'],
    en: ['views', 'nice views', 'panoramic', 'panorama'],
    de: ['aussicht', 'panorama', 'blick'],
    nl: ['uitzicht', 'panorama'],
    fr: ['vue', 'panoramique', 'beau panorama']
  }
}

const NUMBER_WORDS: Record<string, number> = {
  uno: 1,
  one: 1,
  ein: 1,
  een: 1,
  un: 1,
  dos: 2,
  two: 2,
  zwei: 2,
  twee: 2,
  deux: 2,
  tres: 3,
  three: 3,
  drei: 3,
  drie: 3,
  trois: 3,
  cuatro: 4,
  four: 4,
  vier: 4,
  quatre: 4,
  cinco: 5,
  five: 5,
  funf: 5,
  vijf: 5,
  cinq: 5
}

const STOP_WORDS = new Set([
  'con', 'de', 'del', 'la', 'el', 'en', 'y', 'o', 'para', 'por', 'que', 'un', 'una',
  'with', 'in', 'the', 'and', 'or', 'for', 'to', 'than', 'less', 'up',
  'mit', 'im', 'zu', 'bis', 'oder', 'als',
  'of', 'dan', 'tot',
  'ou', 'moins', 'jusqu', 'maximum'
])

const OPERATION_TERMS: Record<'sale' | 'rent', string[]> = {
  sale: ['venta', 'compra', 'sale', 'buy', 'purchase', 'kauf', 'koop', 'achat'],
  rent: ['alquiler', 'rent', 'rental', 'lease', 'miete', 'huur', 'location']
}

const PRICE_PREFIXES = [
  'less than', 'up to', 'under', 'below',
  'menos de', 'hasta', 'maximo', 'max',
  'moins de', 'jusqu a', 'maximum',
  'weniger als', 'bis zu', 'maximal',
  'minder dan', 'tot', 'maximaal'
]

const ROOM_UNITS = ['hab', 'bed', 'zimmer', 'slaap', 'chambre']
const ROOM_MIN_PREFIXES = ['al menos', 'minimum', 'mindestens', 'minimaal', 'au moins']
const ROOM_MORE_THAN_PREFIXES = ['mas de', 'more than', 'mehr als']

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const wordsOf = (text: string) => text.split(/\s+/).filter(Boolean)

const hasTerm = (text: string, term: string) => {
  const normalizedTerm = normalize(term)

  if (normalizedTerm.includes(' ')) {
    return new RegExp(`(^|\\s)${escapeRegExp(normalizedTerm)}($|\\s)`).test(text)
  }

  return wordsOf(text).some((word) => word === normalizedTerm)
}

const applyTypoCorrections = (text: string) => {
  let corrected = ` ${text} `

  Object.entries(TYPO_CORRECTIONS)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([typo, replacement]) => {
      corrected = corrected.replace(new RegExp(`\\b${escapeRegExp(normalize(typo))}\\b`, 'g'), normalize(replacement))
    })

  return corrected.replace(/\s+/g, ' ').trim()
}

const dictionaryMatches = (text: string, dictionary: Record<string, Record<string, string[]>>) => {
  const matches: Array<{ key: string; language: ParsedQuery['detected_language']; term: string }> = []

  Object.entries(dictionary).forEach(([key, languages]) => {
    Object.entries(languages).forEach(([language, terms]) => {
      terms.forEach((term) => {
        if (hasTerm(text, term)) {
          matches.push({ key, language: language as ParsedQuery['detected_language'], term: normalize(term) })
        }
      })
    })
  })

  return matches
}

const toMoney = (raw: string) => {
  const clean = raw.toLowerCase().replace(/\s/g, '')
  const hasK = clean.endsWith('k')
  const value = Number(clean.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''))

  if (!Number.isFinite(value)) return null
  if (hasK) return Math.round(value * 1000)
  if (value >= 100 && value <= 9999) return Math.round(value * 1000)

  return Math.round(value)
}

export function extractPrice(text: string): number | null {
  for (const prefix of PRICE_PREFIXES) {
    const match = text.match(new RegExp(`\\b${escapeRegExp(prefix)}\\s+(\\d[\\d.,\\s]*k?)\\b`))
    if (match) {
      return toMoney(match[1])
    }
  }

  const lessSymbol = text.match(/<\s*(\d[\d.,\s]*k?)\b/)
  if (lessSymbol) return toMoney(lessSymbol[1])

  const withK = text.match(/\b(\d+(?:[.,]\d+)?)\s*k\b/)
  if (withK) return toMoney(withK[0])

  const grouped = text.match(/\b(\d{1,3}(?:[.,]\d{3})+)\b/)
  if (grouped) return toMoney(grouped[1])

  const simple = wordsOf(text)
    .map((word) => (/^\d{3,4}$/.test(word) ? Number(word) : null))
    .find((value): value is number => value !== null && value >= 100 && value <= 9999)

  return simple ? simple * 1000 : null
}

const extractRoomsBathrooms = (text: string) => {
  const slash = text.match(/\b([1-9])\s*\/\s*([1-9])\b/)
  let roomsExact: number | null = slash ? Number(slash[1]) : null
  let roomsMin: number | null = null
  let bathrooms: number | null = slash ? Number(slash[2]) : null
  const repeatedB = text.match(/\b([1-9])b\s+([1-9])b\b/)

  if (repeatedB) {
    roomsExact = Number(repeatedB[1])
    bathrooms = Number(repeatedB[2])
  }

  for (const prefix of ROOM_MORE_THAN_PREFIXES) {
    const match = text.match(new RegExp(`\\b${escapeRegExp(prefix)}\\s+([1-9])\\s*(${ROOM_UNITS.join('|')})\\b`))
    if (match) {
      roomsMin = Number(match[1]) + 1
      roomsExact = null
    }
  }

  for (const prefix of ROOM_MIN_PREFIXES) {
    const match = text.match(new RegExp(`\\b${escapeRegExp(prefix)}\\s+([1-9])\\s*(${ROOM_UNITS.join('|')})\\b`))
    if (match) {
      roomsMin = Number(match[1])
      roomsExact = null
    }
  }

  const roomMatch = text.match(new RegExp(`\\b([1-9])\\s*(${ROOM_UNITS.join('|')})\\b`))
  if (roomMatch && roomsMin === null) roomsExact = Number(roomMatch[1])

  const bathMatch = text.match(/\b([1-9])\s*(banos|bano|bath|bad|badkamer|salle|wc)\b|\b([1-9])ba\b/)
  if (bathMatch) bathrooms = Number(bathMatch[1] ?? bathMatch[3])

  const tokens = wordsOf(text)
  tokens.forEach((token, index) => {
    const value = NUMBER_WORDS[token]
    const next = tokens[index + 1] ?? ''
    if (!value) return
    if (ROOM_UNITS.includes(next) && roomsMin === null) roomsExact = value
    if (['banos', 'bano', 'bath', 'bad', 'badkamer', 'salle', 'wc'].includes(next)) bathrooms = value
  })

  return { roomsExact, roomsMin, bathrooms }
}

const extractSurface = (text: string) => {
  const match = text.match(/\b(\d{2,4})\s*(m2|m)\b/)
  if (!match) return null
  const value = Number(match[1])

  return value >= 10 && value <= 9999 ? value : null
}

export function detectPropertyType(text: string): string | null {
  const normalized = applyTypoCorrections(normalize(text))

  if (hasTerm(normalized, 'charming house') && (hasTerm(normalized, 'town') || hasTerm(normalized, 'village'))) {
    return 'village_house'
  }

  if ((hasTerm(normalized, 'hidden') || hasTerm(normalized, 'charming')) && (hasTerm(normalized, 'house') || hasTerm(normalized, 'villa'))) {
    return 'villa'
  }

  if (hasTerm(normalized, 'mountain house')) return 'villa'
  if (hasTerm(normalized, 'country house')) return 'village_house'
  if (hasTerm(normalized, 'house') && (hasTerm(normalized, 'town') || hasTerm(normalized, 'village') || hasTerm(normalized, 'countryside'))) return 'village_house'
  if (hasTerm(normalized, 'countryside') && hasTerm(normalized, 'plot') && !hasTerm(normalized, 'house')) return 'land'

  for (const type of TYPE_ORDER) {
    const terms = Object.values(TYPE_KEYWORDS[type]).flat()
    if (terms.some((term) => hasTerm(normalized, term))) return type
  }

  return null
}

const detectOperation = (text: string) => {
  for (const [operation, terms] of Object.entries(OPERATION_TERMS) as Array<['sale' | 'rent', string[]]>) {
    if (terms.some((term) => hasTerm(text, term))) return operation
  }

  return null
}

const detectLanguage = (matches: Array<{ language: ParsedQuery['detected_language'] }>): ParsedQuery['detected_language'] =>
  matches.find((match) => match.language !== 'unknown')?.language ?? 'unknown'

export function parseQuery(query: string, overrides?: { type?: string | null }): ParsedQuery {
  const text = applyTypoCorrections(normalize(query))
  const { roomsExact, roomsMin, bathrooms } = extractRoomsBathrooms(text)
  const featureMatches = dictionaryMatches(text, FEATURE_KEYWORDS)
  const typeMatches = dictionaryMatches(text, TYPE_KEYWORDS)
  const features = [...new Set(featureMatches.map((match) => match.key))]
  const recognizedTerms = new Set([
    ...featureMatches.flatMap((match) => match.term.split(' ')),
    ...typeMatches.flatMap((match) => match.term.split(' ')),
    ...Object.values(OPERATION_TERMS).flatMap((terms) => terms.flatMap((term) => normalize(term).split(' ')))
  ])

  PRICE_PREFIXES.forEach((prefix) => normalize(prefix).split(' ').forEach((term) => recognizedTerms.add(term)))
  Object.values(TYPO_CORRECTIONS).forEach((term) => normalize(term).split(' ').forEach((part) => recognizedTerms.add(part)))
  ;['hab', 'bed', 'zimmer', 'slaap', 'chambre', 'banos', 'bano', 'bath', 'bad', 'badkamer', 'salle', 'wc'].forEach((term) => recognizedTerms.add(term))

  const raw_terms = wordsOf(text).filter((word) => {
    if (word.length < 3 || STOP_WORDS.has(word) || /^\d/.test(word)) return false
    return !recognizedTerms.has(word)
  })

  return {
    type: overrides?.type && overrides.type !== 'all' ? overrides.type : detectPropertyType(text),
    operation: detectOperation(text),
    price_max: extractPrice(text),
    rooms_exact: roomsExact,
    rooms_min: roomsMin,
    bathrooms_min: bathrooms,
    surface_min: extractSurface(text),
    features,
    raw_terms: [...new Set(raw_terms)],
    detected_language: detectLanguage([...featureMatches, ...typeMatches])
  }
}

const propertyText = (property: SearchableProperty) =>
  normalize(
    [
      property.search_text,
      property.title,
      property.description,
      property.city,
      property.address,
      property.zone,
      property.type,
      property.detected_type
    ]
      .filter(Boolean)
      .join(' ')
  )

const numberValue = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

export function passesHardFilters(property: SearchableProperty, parsed: ParsedQuery) {
  const propertyType = property.detected_type ?? property.type
  const price = numberValue(property.price)
  const surface = numberValue(property.surface_m2)

  if (parsed.type && propertyType !== parsed.type) return false
  if (parsed.price_max !== null && price !== null && price > parsed.price_max) return false
  if (parsed.rooms_exact !== null && (!property.rooms || property.rooms !== parsed.rooms_exact)) return false
  if (parsed.rooms_min !== null && (property.rooms === null || property.rooms === undefined || property.rooms < parsed.rooms_min)) return false
  if (parsed.bathrooms_min !== null && property.bathrooms !== null && property.bathrooms !== undefined && property.bathrooms < parsed.bathrooms_min) return false
  if (parsed.surface_min !== null && surface !== null && surface < parsed.surface_min) return false

  return true
}

export function scoreProperty(property: SearchableProperty, parsed: ParsedQuery) {
  const text = propertyText(property)
  let score = 0

  parsed.features.forEach((feature) => {
    const terms = Object.values(FEATURE_KEYWORDS[feature] ?? {}).flat()
    if (terms.some((term) => hasTerm(text, term))) score += 1
  })

  parsed.raw_terms.forEach((term) => {
    if (hasTerm(text, term)) score += 1
  })

  return score
}

export function hasAnyDetectedParameter(parsed: ParsedQuery) {
  return Boolean(
    parsed.type ||
      parsed.operation ||
      parsed.price_max !== null ||
      parsed.rooms_exact !== null ||
      parsed.rooms_min !== null ||
      parsed.bathrooms_min !== null ||
      parsed.surface_min !== null ||
      parsed.features.length ||
      parsed.raw_terms.length
  )
}
