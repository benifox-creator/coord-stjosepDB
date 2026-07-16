import { create } from 'zustand'
import { getAll, insertRow, updateRowById, deleteRowById } from '../services/db'

export interface CrudState<T extends { id: string }> {
  items: T[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  crear: (data: Record<string, unknown>) => Promise<T>
  editar: (id: string, data: Record<string, unknown>) => Promise<T>
  eliminar: (id: string) => Promise<void>
}

// Factory genèrica per a mòduls CRUD simples (sense lògica de negoci addicional).
// Mòduls amb efectes secundaris (emails, ajustos d'stock) fan servir els helpers
// de db.ts directament, com useSubstitucions.ts — un wrapper genèric aquí
// només amagaria aquesta lògica sense estalviar codi real.
export function createCrudStore<T extends { id: string }>(table: string, orderBy?: string) {
  return create<CrudState<T>>((set, get) => ({
    items: [],
    loading: false,
    error: null,

    async load() {
      if (get().loading) return
      set({ loading: true, error: null })
      try {
        const items = await getAll<T>(table, orderBy)
        set({ items })
      } catch (err) {
        set({ error: err instanceof Error ? err.message : `Error carregant ${table}` })
      } finally {
        set({ loading: false })
      }
    },

    async crear(data) {
      const row = await insertRow<T>(table, data)
      set((s) => ({ items: [...s.items, row] }))
      return row
    },

    async editar(id, data) {
      const row = await updateRowById<T>(table, id, data)
      set((s) => ({ items: s.items.map((x) => (x.id === id ? row : x)) }))
      return row
    },

    async eliminar(id) {
      await deleteRowById(table, id)
      set((s) => ({ items: s.items.filter((x) => x.id !== id) }))
    },
  }))
}
