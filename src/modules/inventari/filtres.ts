import type { ItemInventari } from './types'
import type { EstatInventari } from './estats'
import { esAvariat } from './estats'

// '' = tots; 'avariats' = el grup que compta el Dashboard (Avariat i En
// reparació); si no, un estat concret.
export type FiltreEstat = EstatInventari | 'avariats' | ''

export interface FiltresInventari {
  cerca: string
  estat: FiltreEstat
  categoria: string
  ubicacio: string
  // '' = totes; 'qualsevol' = amb alguna acció pendent; si no, una acció concreta.
  accio: string
}

export const FILTRES_BUITS: FiltresInventari = { cerca: '', estat: '', categoria: '', ubicacio: '', accio: '' }

export type ClauFiltre = 'estat' | 'categoria' | 'ubicacio' | 'accio'

export interface FiltreActiu {
  clau: ClauFiltre
  etiqueta: string
}

function compleix(item: ItemInventari, f: FiltresInventari, q: string): boolean {
  if (f.estat === 'avariats' ? !esAvariat(item.Estat) : f.estat && item.Estat !== f.estat) return false
  if (f.categoria && item.Categoria !== f.categoria) return false
  if (f.ubicacio && item.Ubicació !== f.ubicacio) return false
  if (f.accio === 'qualsevol' ? !item.Accio : f.accio && item.Accio !== f.accio) return false
  if (q) {
    const h = `${item.ID} ${item.Nom} ${item.Marca} ${item.Model} ${item.Ubicació} ${item['Núm_sèrie']} ${item.SistemaOperatiu} ${item.Accio}`
    if (!h.toLowerCase().includes(q)) return false
  }
  return true
}

export function filtraInventari(items: ItemInventari[], f: FiltresInventari): ItemInventari[] {
  const q = f.cerca.trim().toLowerCase()
  return items.filter((i) => compleix(i, f, q)).sort((a, b) => a.ID.localeCompare(b.ID))
}

// Els xips de sota la barra. La cerca no en fa: ja es veu escrita al quadre.
export function filtresActius(f: FiltresInventari): FiltreActiu[] {
  const actius: FiltreActiu[] = []
  if (f.estat) actius.push({ clau: 'estat', etiqueta: `Estat: ${f.estat === 'avariats' ? 'Avariats o en reparació' : f.estat}` })
  if (f.categoria) actius.push({ clau: 'categoria', etiqueta: `Tipus: ${f.categoria}` })
  if (f.ubicacio) actius.push({ clau: 'ubicacio', etiqueta: `Ubicació: ${f.ubicacio}` })
  if (f.accio) actius.push({ clau: 'accio', etiqueta: `Acció: ${f.accio === 'qualsevol' ? 'Amb alguna acció pendent' : f.accio}` })
  return actius
}
