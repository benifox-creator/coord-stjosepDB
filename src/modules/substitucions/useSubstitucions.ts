import { create } from 'zustand'
import { getAll, insertRow, callRpc, deleteRowById } from '../../services/db'
import { useAuthStore } from '../../store/authStore'
import type { Substitucio, SubstitucioFormData, EstatSubstitucio } from './types'
import {
  TABLE_SUBSTITUCIONS,
  rowToSubstitucio, substitucioToInsert,
  type SubstitucioRow,
} from './substitucions.utils'

interface SubstitucionsState {
  substitucions: Substitucio[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  crear: (data: SubstitucioFormData) => Promise<void>
  canviarEstat: (s: Substitucio, estat: EstatSubstitucio) => Promise<void>
  assignar: (s: Substitucio, email: string) => Promise<Substitucio>
  eliminar: (s: Substitucio) => Promise<void>
}

export const useSubstitucions = create<SubstitucionsState>((set, get) => ({
  substitucions: [],
  loading: false,
  error: null,

  async load() {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const rows = await getAll<SubstitucioRow>(TABLE_SUBSTITUCIONS, 'data')
      set({ substitucions: rows.map(rowToSubstitucio) })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error carregant substitucions' })
    } finally {
      set({ loading: false })
    }
  },

  async crear(data) {
    const emailCreador = useAuthStore.getState().user?.email ?? ''

    const nova: Omit<Substitucio, 'id' | 'ID' | 'Creat_el'> = {
      Data: data.Data,
      Etapa: data.Etapa,
      Franja: data.Franja,
      Tipus: data.Tipus,
      ProfessorAbsent: data.ProfessorAbsent,
      ProfessorSubstitut: data.ProfessorSubstitut,
      Grup: data.Grup,
      Materia: data.Materia,
      Estat: 'Pendent',
      Notes: data.Notes,
      Creat_per: emailCreador,
      Absencia_ID: data.Absencia_ID,
    }

    const row = await insertRow<SubstitucioRow>(TABLE_SUBSTITUCIONS, substitucioToInsert(nova))
    const creada = rowToSubstitucio(row)
    set((s) => ({ substitucions: [...s.substitucions, creada] }))


  },

  async canviarEstat(s, estat) {
    const row = await callRpc<SubstitucioRow>('update_substitution', { p_id: s.id, p_expected_teacher: s.ProfessorSubstitut, p_expected_state: s.Estat, p_teacher: s.ProfessorSubstitut, p_state: estat })
    const updated = rowToSubstitucio(row)
    set((st) => ({
      substitucions: st.substitucions.map((x) => (x.id === s.id ? updated : x)),
    }))
  },

  async assignar(s, email) {
    const row = await callRpc<SubstitucioRow>('update_substitution', { p_id: s.id, p_expected_teacher: s.ProfessorSubstitut, p_expected_state: s.Estat, p_teacher: email, p_state: s.Estat })
    const updated = rowToSubstitucio(row)
    set(st => ({ substitucions: st.substitucions.map(x => x.id === s.id ? updated : x) }))
    return updated
  },

  async eliminar(s) {
    await deleteRowById(TABLE_SUBSTITUCIONS, s.id)
    set((st) => ({
      substitucions: st.substitucions.filter((x) => x.id !== s.id),
    }))
  },
}))
