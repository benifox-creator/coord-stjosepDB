export const CATEGORIES_MANTENIMENT = [
  'Persianes/Stores', 'Portes/Finestres', 'Mobiliari',
  'Electricitat', 'Fontaneria', 'Pintura', 'Altres',
] as const

export function formatDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}
