export const formatPropertySource = (source?: string | null) => {
  if (!source) return 'Agencia'

  const labels: Record<string, string> = {
    crown_property: 'Crown Property',
    ego_real_estate: 'Ego Real Estate',
    kyero: 'Kyero',
    sooprema: 'Sooprema',
    internal: 'Exclusiva'
  }

  return labels[source] ?? source.charAt(0).toUpperCase() + source.slice(1)
}

export const formatPropertyPrice = (price: number | string, operation?: string | null) => {
  const value = Number(price)
  const formatted = new Intl.NumberFormat('es-ES').format(Number.isFinite(value) ? value : 0)
  const euro = '\u20ac'

  return operation === 'rent' ? `${euro} ${formatted}/mes` : `${euro} ${formatted}`
}
