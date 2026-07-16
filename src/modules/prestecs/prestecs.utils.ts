import { ensureSheetHeaders } from '../../services/sheets'
import type { Prestec, EstatPrestec } from './types'

export const SHEET = 'Prestecs'

export const HEADERS = [
  'ID',
  'Dispositiu_ID',
  'Dispositiu_Nom',
  'Usuari',
  'Email',
  'Data_inici',
  'Data_fi_prevista',
  'Data_fi_real',
  'Material',
  'Estat',
  'Notes',
] as const

export async function ensureHeaders(): Promise<void> {
  await ensureSheetHeaders(SHEET, [...HEADERS])
}

export function generateId(existingIds: string[]): string {
  const nums = existingIds
    .map((id) => parseInt(id.replace('PRE-', ''), 10))
    .filter((n) => !isNaN(n))
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `PRE-${String(next).padStart(3, '0')}`
}

export function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function estatEfectiu(prestec: Prestec): EstatPrestec {
  if (prestec.Estat === 'Retornat') return 'Retornat'
  if (!prestec.Data_fi_prevista) return prestec.Estat
  const fi = new Date(prestec.Data_fi_prevista)
  if (isNaN(fi.getTime())) return prestec.Estat
  const avui = new Date()
  avui.setHours(0, 0, 0, 0)
  fi.setHours(0, 0, 0, 0)
  if (fi < avui) return 'Vençut'
  return 'Actiu'
}

export function diesRestants(dataFiPrevista: string): number | null {
  if (!dataFiPrevista) return null
  const fi = new Date(dataFiPrevista)
  if (isNaN(fi.getTime())) return null
  const avui = new Date()
  avui.setHours(0, 0, 0, 0)
  fi.setHours(0, 0, 0, 0)
  return Math.round((fi.getTime() - avui.getTime()) / (1000 * 60 * 60 * 24))
}
