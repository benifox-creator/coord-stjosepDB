import { ensureSheetHeaders } from '../../services/sheets'

export const SHEET = 'Inventari'

export const HEADERS = [
  'ID',
  'Nom',
  'Categoria',
  'Marca',
  'Model',
  'Núm_sèrie',
  'Ubicació',
  'Estat',
  'Data_compra',
  'Garantia_fins',
  'MAC_LAN',
  'MAC_WAN',
  'IP_LAN',
  'IP_WAN',
  'Notes',
] as const

export async function ensureHeaders(): Promise<void> {
  await ensureSheetHeaders(SHEET, [...HEADERS])
}

export function generateId(existingIds: string[]): string {
  const nums = existingIds
    .map((id) => parseInt(id.replace('INV-', ''), 10))
    .filter((n) => !isNaN(n))
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `INV-${String(next).padStart(3, '0')}`
}

export function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function garantiaEstat(garantiaFins: string): 'vigent' | 'caducada' | 'desconegut' {
  if (!garantiaFins) return 'desconegut'
  const fi = new Date(garantiaFins)
  if (isNaN(fi.getTime())) return 'desconegut'
  return fi >= new Date() ? 'vigent' : 'caducada'
}
