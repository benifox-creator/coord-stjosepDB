import { create } from 'zustand'
import { getAll, insertRow, updateRowById, deleteRowById, callRpc, supabase } from '../../services/db'
import type { Finances, Autocar } from './finances.types'
import { FINANCES_BUIDES } from './finances.types'

interface FinancesRow {
  excursio_id: string
  preu_activitat: string | number
  preu_activitat_tipus: 'per_alumne' | 'total'
  ampa_import: string | number
  ampa_cobreix_activitat: boolean
  cost_acompanyants: string | number
}
interface AutocarRow { id: string; excursio_id: string; places: number; preu: string | number }

interface FinancesState {
  finances: Finances | null
  loading: boolean
  error: string | null
  carrega: (excursioId: string) => Promise<void>
  desa: (excursioId: string, f: Finances) => Promise<void>
  confirma: (excursioId: string, preu: number) => Promise<void>
}

export const useFinances = create<FinancesState>((set, get) => ({
  finances: null,
  loading: false,
  error: null,

  async carrega(excursioId) {
    set({ loading: true, error: null })
    try {
      const [files, autocars] = await Promise.all([
        getAll<FinancesRow>('excursio_finances', 'excursio_id', { excursio_id: excursioId }, 'excursio_id'),
        getAll<AutocarRow>('excursio_autocars', 'id', { excursio_id: excursioId }),
      ])
      // Zero files no és cap error: o bé encara no s'hi ha entrat res, o bé
      // qui mira no té accés als diners i l'RLS no li'n dona cap. En tots dos
      // casos la pantalla ha d'ensenyar el formulari buit, no un error vermell.
      const f = files[0]
      set({ finances: {
        ...FINANCES_BUIDES,
        ...(f ? {
          PreuActivitat: Number(f.preu_activitat),
          PreuActivitatTipus: f.preu_activitat_tipus,
          AmpaImport: Number(f.ampa_import),
          AmpaCobreixActivitat: f.ampa_cobreix_activitat,
          CostAcompanyants: Number(f.cost_acompanyants),
        } : {}),
        Autocars: autocars.map((a): Autocar => ({ id: a.id, Places: a.places, Preu: Number(a.preu) })),
      } })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error carregant els costos' })
    } finally {
      set({ loading: false })
    }
  },

  async desa(excursioId, f) {
    // `upsert` i no els ajudants de sempre: `updateRowById` filtra per una
    // columna `id` fixa, i `excursio_finances` té `excursio_id` com a clau
    // primària i cap columna `id`. Amb la clau primària, un sol `upsert` ja
    // fa inserir-o-actualitzar.
    const { error } = await supabase.from('excursio_finances').upsert({
      excursio_id: excursioId,
      preu_activitat: f.PreuActivitat,
      preu_activitat_tipus: f.PreuActivitatTipus,
      ampa_import: f.AmpaImport,
      ampa_cobreix_activitat: f.AmpaCobreixActivitat,
      cost_acompanyants: f.CostAcompanyants,
    })
    if (error) throw new Error(`Error desant els costos: ${error.message}`)

    // Els autocars es posen al dia per diferència i no esborrant-ho tot: si una
    // escriptura falla, el que ja hi havia no s'ha perdut pel camí. És el mateix
    // criteri que `sincronitzaFilles` a `useExcursions`.
    const actuals = await getAll<AutocarRow>('excursio_autocars', 'id', { excursio_id: excursioId })
    for (const a of actuals) {
      const volgut = f.Autocars.find((v) => v.id === a.id)
      if (!volgut) await deleteRowById('excursio_autocars', a.id)
      else if (volgut.Places !== a.places || volgut.Preu !== Number(a.preu)) {
        await updateRowById('excursio_autocars', a.id, { places: volgut.Places, preu: volgut.Preu })
      }
    }
    for (const v of f.Autocars) {
      if (!actuals.some((a) => a.id === v.id)) {
        await insertRow('excursio_autocars', { excursio_id: excursioId, places: v.Places, preu: v.Preu })
      }
    }
    await get().carrega(excursioId)
  },

  async confirma(excursioId, preu) {
    await callRpc('confirmar_preu', { p_id: excursioId, p_preu: preu })
  },
}))
