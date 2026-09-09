import { create } from 'zustand'
import { getAll, insertRow, deleteRowById } from '../../services/db'
import { useAuthStore } from '../../store/authStore'
import type { ComandaInfantil, ComandaInfantilFormData } from './types'
import {
  TABLE_COMANDES, rowToComanda, comandaToInsert, type ComandaInfantilRow,
} from './materialInfantil.utils'

interface ComandesInfantilState {
  comandes: ComandaInfantil[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  crear: (data: ComandaInfantilFormData) => Promise<void>
  eliminar: (c: ComandaInfantil) => Promise<void>
}

export const useComandesInfantil = create<ComandesInfantilState>((set, get) => ({
  comandes: [],
  loading: false,
  error: null,

  async load() {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const rows = await getAll<ComandaInfantilRow>(TABLE_COMANDES, 'curs_escolar')
      set({ comandes: rows.map(rowToComanda) })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error carregant comandes' })
    } finally {
      set({ loading: false })
    }
  },

  async crear(data) {
    const email = (useAuthStore.getState().user?.email ?? '').toLowerCase()
    const row = await insertRow<ComandaInfantilRow>(TABLE_COMANDES, comandaToInsert({ ...data, Creat_per: email }))
    set((s) => ({ comandes: [...s.comandes, rowToComanda(row)] }))
  },

  async eliminar(c) {
    await deleteRowById(TABLE_COMANDES, c.id)
    set((s) => ({ comandes: s.comandes.filter((x) => x.id !== c.id) }))
  },
}))
