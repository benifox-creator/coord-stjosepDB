import { create } from 'zustand'
import { getAll, callRpc, deleteRowById } from '../../services/db'
import { useSubstitucions } from '../substitucions/useSubstitucions'
import type { Absencia, AbsenciaFormData } from './types'
import { TABLE_ABSENCIES, rowToAbsencia, type AbsenciaRow } from './absencies.utils'

interface AbsenciesState {
  absencies: Absencia[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  crear: (data: AbsenciaFormData) => Promise<void>
  aprovar: (a: Absencia) => Promise<void>
  rebutjar: (a: Absencia, motiu: string) => Promise<void>
  eliminar: (a: Absencia) => Promise<void>
}

export const useAbsencies = create<AbsenciesState>((set, get) => ({
  absencies: [],
  loading: false,
  error: null,

  async load() {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const rows = await getAll<AbsenciaRow>(TABLE_ABSENCIES, 'data')
      set({ absencies: rows.map(rowToAbsencia) })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error carregant absències' })
    } finally {
      set({ loading: false })
    }
  },

  async crear(data) {
    const row = await callRpc<AbsenciaRow>('create_absence', {
      p_request_id: data.RequestId ?? crypto.randomUUID(),
      p_data: { data: data.Data, hora_inici: data.HoraInici, hora_fi: data.HoraFi,
        hores_no_lectives: data.HoresNoLectives, motiu: data.Motiu, notes: data.Notes },
      p_periode_ids: data.Periodes?.map(p => p.HorariId) ?? [],
    })
    const creada = rowToAbsencia(row)
    set(s => ({ absencies: [...s.absencies.filter(a => a.id !== creada.id), creada] }))
  },

  async aprovar(a) {
    const row = await callRpc<AbsenciaRow>('review_absence', { p_id: a.id, p_approve: true, p_reason: '' })
    set(s => ({ absencies: s.absencies.map(x => x.id === a.id ? rowToAbsencia(row) : x) }))
    await useSubstitucions.getState().load()
  },

  async rebutjar(a, motiu) {
    const row = await callRpc<AbsenciaRow>('review_absence', { p_id: a.id, p_approve: false, p_reason: motiu })
    set(s => ({ absencies: s.absencies.map(x => x.id === a.id ? rowToAbsencia(row) : x) }))
  },

  async eliminar(a) {
    await deleteRowById(TABLE_ABSENCIES, a.id)
    set((s) => ({ absencies: s.absencies.filter((x) => x.id !== a.id) }))
  },
}))
