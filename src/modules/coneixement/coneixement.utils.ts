import type { ArticleLink } from './types'

export function formatDateISO(d: Date): string {
  // `toISOString()` dona la data en UTC, però la base de dades segella
  // `creat_el`, `actualitzat_el` i `caduca_el` en Europe/Madrid (migració
  // `202609240001_coneixement_redaccio.sql`). Entre mitjanit i les dues de
  // la matinada les dues zones discrepen: sense això, «avui» encara seria
  // ahir i un avís ja caducat sortiria com a vigent.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d)
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
