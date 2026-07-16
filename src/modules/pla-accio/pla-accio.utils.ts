import { ensureSheetHeaders } from '../../services/sheets'

export const SHEET_PROJECTES = 'Projectes'
export const HEADERS_PROJECTES = [
  'ID', 'Nom', 'Descripcio', 'Categoria', 'Estat',
  'Responsable', 'Data_inici', 'Data_fi_prevista', 'Creat_el',
] as const

export const SHEET_TASQUES = 'Tasques'
export const HEADERS_TASQUES = [
  'ID', 'Projecte_ID', 'Titol', 'Descripcio', 'Estat',
  'Prioritat', 'Responsable', 'Data_limit', 'Creat_el',
] as const

export async function ensureHeadersProjectes(): Promise<void> {
  await ensureSheetHeaders(SHEET_PROJECTES, [...HEADERS_PROJECTES])
}

export async function ensureHeadersTasques(): Promise<void> {
  await ensureSheetHeaders(SHEET_TASQUES, [...HEADERS_TASQUES])
}

export function generateProjecteId(existingIds: string[]): string {
  const nums = existingIds
    .map((id) => parseInt(id.replace('PRJ-', ''), 10))
    .filter((n) => !isNaN(n))
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `PRJ-${String(next).padStart(3, '0')}`
}

export function generateTascaId(existingIds: string[]): string {
  const nums = existingIds
    .map((id) => parseInt(id.replace('TAS-', ''), 10))
    .filter((n) => !isNaN(n))
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `TAS-${String(next).padStart(3, '0')}`
}

export function formatDateISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function formatDateTimeISO(d: Date): string {
  return d.toISOString()
}

export function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function isOverdue(dataLimit: string): boolean {
  if (!dataLimit) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dataLimit + 'T00:00:00') < today
}

export function progressPercent(tasques: { Estat: string }[]): number {
  if (tasques.length === 0) return 0
  const completades = tasques.filter((t) => t.Estat === 'Completada').length
  return Math.round((completades / tasques.length) * 100)
}
