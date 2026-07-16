import type { ArticleLink } from './types'

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
