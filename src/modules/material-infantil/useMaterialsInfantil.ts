import { create } from 'zustand'
import { supabase, getAll, insertRow, updateRowById, deleteRowById } from '../../services/db'
import { useAuthStore } from '../../store/authStore'
import type { MaterialInfantil, MaterialInfantilFormData } from './types'
import {
  TABLE_MATERIALS, rowToMaterial, materialToInsert, materialToUpdate, type MaterialInfantilRow,
} from './materialInfantil.utils'

interface MaterialsInfantilState {
  materials: MaterialInfantil[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  crear: (data: MaterialInfantilFormData) => Promise<void>
  editar: (m: MaterialInfantil, data: MaterialInfantilFormData) => Promise<void>
  eliminar: (m: MaterialInfantil) => Promise<void>
  importarMassiu: (dades: MaterialInfantilFormData[]) => Promise<void>
}

export const useMaterialsInfantil = create<MaterialsInfantilState>((set, get) => ({
  materials: [],
  loading: false,
  error: null,

  async load() {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const rows = await getAll<MaterialInfantilRow>(TABLE_MATERIALS, 'nom')
      set({ materials: rows.map(rowToMaterial) })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error carregant materials' })
    } finally {
      set({ loading: false })
    }
  },

  async crear(data) {
    const email = (useAuthStore.getState().user?.email ?? '').toLowerCase()
    const row = await insertRow<MaterialInfantilRow>(TABLE_MATERIALS, materialToInsert({ ...data, Creat_per: email }))
    set((s) => ({ materials: [...s.materials, rowToMaterial(row)] }))
  },

  async editar(m, data) {
    const row = await updateRowById<MaterialInfantilRow>(TABLE_MATERIALS, m.id, materialToUpdate(data))
    const updated = rowToMaterial(row)
    set((s) => ({ materials: s.materials.map((x) => (x.id === m.id ? updated : x)) }))
  },

  async eliminar(m) {
    await deleteRowById(TABLE_MATERIALS, m.id)
    set((s) => ({ materials: s.materials.filter((x) => x.id !== m.id) }))
  },

  async importarMassiu(dades) {
    const email = (useAuthStore.getState().user?.email ?? '').toLowerCase()
    const payload = dades.map((d) => materialToInsert({ ...d, Creat_per: email }))
    const { data, error } = await supabase.from(TABLE_MATERIALS).insert(payload).select()
    if (error) throw new Error(`Error important materials: ${error.message}`)
    const nous = (data as MaterialInfantilRow[]).map(rowToMaterial)
    set((s) => ({ materials: [...s.materials, ...nous] }))
  },
}))
