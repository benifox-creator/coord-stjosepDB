// src/modules/excursions/useAutocarsResum.ts
//
// Un resum d'`excursio_autocars` per a les dues finestres de pressupostos.
// Viu en un store i no en l'estat local del wrapper perquè aquí és on la
// resta del mòdul llegeix dades externes (mateix criteri que `useBalanc` i
// `useFinances`): qui crida `carrega()` decideix quan, el store només sap
// llegir i agrupar.
import { create } from 'zustand'
import { getAll } from '../../services/db'

interface AutocarRow { excursio_id: string; preu: string | number }

export interface AutocarsResum {
  /** Sortides amb algun autocar ja pagat: les que `pendentsDePressupost` ha de descartar. */
  ambPreu: ReadonlySet<string>
  /** Recompte i total per sortida, per a "substitueix N autocars" a `ImportarPressupostModal`. */
  preus: ReadonlyMap<string, { quants: number; total: number }>
}

const BUIT: AutocarsResum = { ambPreu: new Set(), preus: new Map() }

interface AutocarsResumState {
  resum: AutocarsResum
  loading: boolean
  error: string | null
  carrega: () => Promise<void>
}

// Mateix criteri que `generacio` a `useExcursions.load`: si es demanen dues
// lectures seguides, només val la darrera.
let generacio = 0

export const useAutocarsResum = create<AutocarsResumState>((set) => ({
  resum: BUIT,
  loading: false,
  error: null,

  async carrega() {
    const meva = ++generacio
    set({ loading: true, error: null })
    try {
      const files = await getAll<AutocarRow>('excursio_autocars', 'id')
      if (meva !== generacio) return
      const ambPreu = new Set<string>()
      const preus = new Map<string, { quants: number; total: number }>()
      // Només compten les files amb preu > 0: un autocar a 0 encara no té
      // pressupost, no és un ja pagat.
      for (const { excursio_id, preu } of files) {
        const valor = Number(preu)
        if (!(valor > 0)) continue
        ambPreu.add(excursio_id)
        const actual = preus.get(excursio_id) ?? { quants: 0, total: 0 }
        preus.set(excursio_id, { quants: actual.quants + 1, total: actual.total + valor })
      }
      set({ resum: { ambPreu, preus } })
    } catch (err) {
      if (meva === generacio) set({ error: err instanceof Error ? err.message : 'Error carregant els autocars' })
    } finally {
      if (meva === generacio) set({ loading: false })
    }
  },
}))
