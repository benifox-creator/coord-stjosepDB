import { ensureSheetHeaders } from '../../services/sheets'

export const SHEET = 'Reserves'
export const HEADERS = ['ID', 'Espai', 'Usuari', 'Email', 'Data', 'Hora_inici', 'Hora_fi', 'Motiu', 'Estat', 'Creat_el']

export const ESPAIS = [
  'Aula d\'informàtica',
  'Sala de reunions',
  'Sala de projecció',
  'Laboratori de ciències',
  'Biblioteca',
  'Aula polivalent',
  'Sala d\'actes',
  'Gimnàs',
  'Pati exterior',
  'Altres',
]

export function generateId(existingIds: string[]): string {
  const nums = existingIds
    .map((id) => parseInt(id.replace('RES-', ''), 10))
    .filter((n) => !isNaN(n))
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `RES-${String(next).padStart(3, '0')}`
}

export function formatDate(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function formatDateTimeISO(date: Date): string {
  return date.toISOString().slice(0, 16).replace('T', ' ')
}

export function formatTime(hhmm: string): string {
  return hhmm || '—'
}

export function isDiaAvui(data: string): boolean {
  return data === formatDateISO(new Date())
}

export function isProxima(data: string, diesEndavant = 7): boolean {
  const avui = new Date()
  avui.setHours(0, 0, 0, 0)
  const fi = new Date(avui)
  fi.setDate(fi.getDate() + diesEndavant)
  const d = new Date(data)
  return d >= avui && d <= fi
}

export async function ensureHeaders(): Promise<void> {
  await ensureSheetHeaders(SHEET, [...HEADERS])
}
