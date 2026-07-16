import { ensureSheetHeaders } from '../../services/sheets'
import type { ArticleLink } from './types'

export const SHEET = 'Coneixement'
export const HEADERS = [
  'ID', 'Titol', 'Categoria', 'Contingut',
  'Tags', 'Links', 'Autor', 'Creat_el', 'Actualitzat_el', 'Publicat',
]

export async function ensureHeaders(): Promise<void> {
  await ensureSheetHeaders(SHEET, HEADERS)
}

export function generateId(existingIds: string[]): string {
  const nums = existingIds
    .filter((id) => /^ART-\d+$/.test(id))
    .map((id) => parseInt(id.slice(4), 10))
  const max = nums.length > 0 ? Math.max(...nums) : 0
  return `ART-${String(max + 1).padStart(3, '0')}`
}

export function formatDateISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function parseLinks(raw: string): ArticleLink[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((l) => l.label && l.url) : []
  } catch {
    return []
  }
}

export function serializeLinks(links: ArticleLink[]): string {
  const valid = links.filter((l) => l.label.trim() && l.url.trim())
  return valid.length > 0 ? JSON.stringify(valid) : ''
}

export function parseTags(raw: string): string[] {
  return raw.split(',').map((t) => t.trim()).filter(Boolean)
}
