import { getRows, ensureSheetHeaders, updateRow } from '../../services/sheets'
import type { CategoriaMaterial, ItemMaterial, MaterialPrestat } from './types'

export const SHEET = 'Material'

export const HEADERS = [
  'ID',
  'Nom',
  'Categoria',
  'Descripció',
  'Quantitat_total',
  'Quantitat_disponible',
  'Ubicació',
  'Notes',
] as const

export async function ensureHeaders(): Promise<void> {
  await ensureSheetHeaders(SHEET, [...HEADERS])
}

export function generateId(existingIds: string[]): string {
  const nums = existingIds
    .map((id) => parseInt(id.replace('MAT-', ''), 10))
    .filter((n) => !isNaN(n))
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `MAT-${String(next).padStart(3, '0')}`
}

export function rowToItem(row: Record<string, string>, index: number): ItemMaterial {
  return {
    ID: row['ID'] ?? '',
    Nom: row['Nom'] ?? '',
    Categoria: (row['Categoria'] as CategoriaMaterial) || 'Altre',
    Descripció: row['Descripció'] ?? '',
    Quantitat_total: parseInt(row['Quantitat_total'] ?? '0', 10) || 0,
    Quantitat_disponible: parseInt(row['Quantitat_disponible'] ?? '0', 10) || 0,
    Ubicació: row['Ubicació'] ?? '',
    Notes: row['Notes'] ?? '',
    _rowIndex: index,
  }
}

export function itemToRow(item: ItemMaterial): Record<string, string> {
  return {
    ID: item.ID,
    Nom: item.Nom,
    Categoria: item.Categoria,
    Descripció: item.Descripció,
    Quantitat_total: String(item.Quantitat_total),
    Quantitat_disponible: String(item.Quantitat_disponible),
    Ubicació: item.Ubicació,
    Notes: item.Notes,
  }
}

// Ajusta el stock disponible. delta negatiu = préstec; delta positiu = retorn.
export async function adjustStock(adjustments: { ID: string; delta: number }[]): Promise<void> {
  if (adjustments.length === 0) return
  const rows = await getRows(SHEET)
  for (const { ID, delta } of adjustments) {
    const idx = rows.findIndex((r) => r['ID'] === ID)
    if (idx === -1) continue
    const current = parseInt(rows[idx]['Quantitat_disponible'] ?? '0', 10)
    const newVal = Math.max(0, current + delta)
    await updateRow(SHEET, idx, { ...rows[idx], Quantitat_disponible: String(newVal) })
  }
}

// Serialitza una llista de material prestat a string per desar al Sheet.
// Format: "MAT-001:2:Cable HDMI;MAT-003:1:Adaptador VGA"
export function serializeMaterial(items: MaterialPrestat[]): string {
  return items.filter((m) => m.Quantitat > 0).map((m) => `${m.ID}:${m.Quantitat}:${m.Nom}`).join(';')
}

// Parseja el string del Sheet a llista d'ítems.
export function parseMaterial(str: string): MaterialPrestat[] {
  if (!str || !str.trim()) return []
  return str.split(';').flatMap((part) => {
    const [ID, q, ...nomParts] = part.trim().split(':')
    const Quantitat = parseInt(q, 10)
    if (!ID || !Quantitat) return []
    return [{ ID: ID.trim(), Quantitat, Nom: nomParts.join(':').trim() }]
  })
}
