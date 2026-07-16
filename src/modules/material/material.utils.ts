import { supabase } from '../../services/db'
import type { MaterialPrestat } from './types'

// Resol codis humans (MAT-001...) a uuid real, per als punts on cal creuar
// amb prestec_items (que referencia material per id, no per codi).
export async function getMaterialIdsByCodi(codis: string[]): Promise<Record<string, string>> {
  if (codis.length === 0) return {}
  const { data, error } = await supabase.from('material').select('id, codi').in('codi', codis)
  if (error) throw new Error(`Error cercant material: ${error.message}`)
  const map: Record<string, string> = {}
  for (const row of (data ?? []) as { id: string; codi: string }[]) map[row.codi] = row.id
  return map
}

// Ajusta el stock disponible de forma atòmica via la funció Postgres
// adjust_material_stock (substitueix el patró lectura+escriptura sense lock d'abans).
// delta negatiu = préstec; delta positiu = retorn.
export async function adjustStock(adjustments: { ID: string; delta: number }[]): Promise<void> {
  if (adjustments.length === 0) return
  const idMap = await getMaterialIdsByCodi(adjustments.map((a) => a.ID))
  for (const { ID, delta } of adjustments) {
    const materialId = idMap[ID]
    if (!materialId) continue
    const { error } = await supabase.rpc('adjust_material_stock', { p_material_id: materialId, p_delta: delta })
    if (error) throw new Error(`Error ajustant estoc de ${ID}: ${error.message}`)
  }
}

// Serialitza una llista de material prestat a string per mostrar/desar.
// Format: "MAT-001:2:Cable HDMI;MAT-003:1:Adaptador VGA"
export function serializeMaterial(items: MaterialPrestat[]): string {
  return items.filter((m) => m.Quantitat > 0).map((m) => `${m.ID}:${m.Quantitat}:${m.Nom}`).join(';')
}

// Parseja el string a llista d'ítems.
export function parseMaterial(str: string): MaterialPrestat[] {
  if (!str || !str.trim()) return []
  return str.split(';').flatMap((part) => {
    const [ID, q, ...nomParts] = part.trim().split(':')
    const Quantitat = parseInt(q, 10)
    if (!ID || !Quantitat) return []
    return [{ ID: ID.trim(), Quantitat, Nom: nomParts.join(':').trim() }]
  })
}
