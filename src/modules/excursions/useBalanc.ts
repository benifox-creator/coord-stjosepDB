import { create } from 'zustand'
import { getAll } from '../../services/db'
import { TAULA_EXCURSIONS } from './excursions.utils'
import type { DadesSortida } from './balanc'

// PostgREST torna els `numeric` com a cadena. Declarar-ho i passar-ho per
// `Number()` evita que els imports se sumin com a text. Mateix criteri que
// `useFinances.ts`.
interface ExcursioRow {
  id: string; lloc: string; etapa: string; data: string | null
  estat: string; preu_alumne: string | number | null
}
interface GrupRow {
  excursio_id: string; alumnes_previstos: number; alumnes_pagats: number | null
}
interface FinancesRow {
  excursio_id: string
  preu_activitat: string | number
  preu_activitat_tipus: 'per_alumne' | 'total'
  ampa_import: string | number
  ampa_cobreix_activitat: boolean
  cost_acompanyants: string | number
  previsio_usada: string | number | null
  iva_pct_usat: string | number | null
}
interface AutocarRow { excursio_id: string; preu: string | number }

const n = (v: string | number | null | undefined, defecte = 0): number => {
  // `Number(null)` és `0`, no `NaN`: cal descartar `null`/`undefined` abans
  // de convertir, o un valor encara no congelat («previsio_usada» abans de
  // confirmar el preu) es llegiria com a zero en comptes del valor de sempre.
  if (v === null || v === undefined) return defecte
  const x = Number(v)
  return Number.isFinite(x) ? x : defecte
}

interface BalancState {
  sortides: DadesSortida[]
  loading: boolean
  error: string | null
  carrega: (curs: string) => Promise<void>
}

// Si se'n demanen dos seguits, només val el darrer: si no, la resposta lenta
// d'un curs anterior podria pisar la del curs que s'està mirant. Mateix
// criteri que `useExcursions.load`.
let generacio = 0

export const useBalanc = create<BalancState>((set) => ({
  sortides: [],
  loading: false,
  error: null,

  async carrega(curs) {
    const meva = ++generacio
    set({ loading: true, error: null })
    try {
      const [excursions, grups, finances, autocars] = await Promise.all([
        getAll<ExcursioRow>(TAULA_EXCURSIONS, 'data', { curs_escolar: curs }),
        getAll<GrupRow>('excursio_grups', 'grup'),
        getAll<FinancesRow>('excursio_finances', 'excursio_id', {}, 'excursio_id'),
        getAll<AutocarRow>('excursio_autocars', 'id'),
      ])
      if (meva !== generacio) return

      set({ sortides: excursions.map((e) => {
        const meus = grups.filter((g) => g.excursio_id === e.id)
        // Zero files de finances no és cap error: o no s'hi ha entrat res, o
        // qui mira no té accés als diners i l'RLS no li'n torna cap. En tots
        // dos casos la sortida té els costos a zero.
        const f = finances.find((x) => x.excursio_id === e.id)
        return {
          id: e.id, lloc: e.lloc, etapa: e.etapa, data: e.data, estat: e.estat,
          previstos: meus.reduce((s, g) => s + g.alumnes_previstos, 0),
          // Mai `null`: «ningú no ha pagat» és zero, no un desconegut.
          assistents: meus.reduce((s, g) => s + (g.alumnes_pagats ?? 0), 0),
          // `null` i zero no són el mateix: sense preu confirmat no hi ha cap
          // ingrés possible, i el balanç ho ha de poder distingir.
          preuAlumne: e.preu_alumne === null ? null : n(e.preu_alumne),
          autocars: autocars.filter((a) => a.excursio_id === e.id).map((a) => n(a.preu)),
          preuActivitat: n(f?.preu_activitat),
          preuActivitatTipus: f?.preu_activitat_tipus ?? 'per_alumne',
          ampaImport: n(f?.ampa_import),
          ampaCobreixActivitat: f?.ampa_cobreix_activitat ?? false,
          costAcompanyants: n(f?.cost_acompanyants),
          // Els congelats en confirmar el preu. Mentre no s'ha confirmat són
          // nuls, i llavors val més el valor de sempre del centre que un NaN.
          previsio: n(f?.previsio_usada, 0.75),
          ivaPct: n(f?.iva_pct_usat, 10),
        }
      }) })
    } catch (err) {
      if (meva === generacio) {
        set({ error: err instanceof Error ? err.message : 'Error carregant les dades econòmiques' })
      }
    } finally {
      if (meva === generacio) set({ loading: false })
    }
  },
}))
