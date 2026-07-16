import { ensureSheetHeaders } from '../../services/sheets'

export const SHEET_MANTENIMENT = 'Manteniment'

export const HEADERS_MANTENIMENT = [
  'ID', 'Titol', 'Categoria', 'Localitzacio', 'Descripcio',
  'Prioritat', 'Estat', 'Reporter', 'Data_report', 'Data_resolucio', 'Notes', 'Creat_el',
] as const

export const CATEGORIES_MANTENIMENT = [
  'Persianes/Stores', 'Portes/Finestres', 'Mobiliari',
  'Electricitat', 'Fontaneria', 'Pintura', 'Altres',
] as const

export function ensureHeadersManteniment(): Promise<void> {
  return ensureSheetHeaders(SHEET_MANTENIMENT, [...HEADERS_MANTENIMENT])
}

export function generateMantenimentId(existingIds: string[]): string {
  const nums = existingIds
    .map((id) => parseInt(id.replace('MAN-', ''), 10))
    .filter((n) => !isNaN(n))
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `MAN-${String(next).padStart(3, '0')}`
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function formatDateTimeISO(d: Date): string {
  return d.toISOString()
}
