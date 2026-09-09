import { create } from 'zustand'
import { getAll, insertRow, updateRowById, deleteRowById } from '../../services/db'
import type { ProveidorInfantil, ProveidorInfantilFormData } from './types'
import {
  TABLE_PROVEIDORS, rowToProveidor, proveidorToInsert, proveidorToUpdate, type ProveidorInfantilRow,
} from './materialInfantil.utils'

interface ProveidorsInfantilState {
  proveidors: ProveidorInfantil[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  crear: (data: ProveidorInfantilFormData) => Promise<void>
  editar: (p: ProveidorInfantil, data: ProveidorInfantilFormData) => Promise<void>
  eliminar: (p: ProveidorInfantil) => Promise<void>
}

export const useProveidorsInfantil = create<ProveidorsInfantilState>((set, get) => ({
  proveidors: [],
  loading: false,
  error: null,

  async load() {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const rows = await getAll<ProveidorInfantilRow>(TABLE_PROVEIDORS, 'nom')
      set({ proveidors: rows.map(rowToProveidor) })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error carregant proveïdors' })
    } finally {
      set({ loading: false })
    }
  },

  async crear(data) {
    const row = await insertRow<ProveidorInfantilRow>(TABLE_PROVEIDORS, proveidorToInsert(data))
    set((s) => ({ proveidors: [...s.proveidors, rowToProveidor(row)] }))
  },

  async editar(p, data) {
    const row = await updateRowById<ProveidorInfantilRow>(TABLE_PROVEIDORS, p.id, proveidorToUpdate(data))
    const updated = rowToProveidor(row)
    set((s) => ({ proveidors: s.proveidors.map((x) => (x.id === p.id ? updated : x)) }))
  },

  async eliminar(p) {
    await deleteRowById(TABLE_PROVEIDORS, p.id)
    set((s) => ({ proveidors: s.proveidors.filter((x) => x.id !== p.id) }))
  },
}))
