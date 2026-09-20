import { create } from 'zustand'
import { getAll, callRpc } from '../../services/db'
import type { Notificacio } from './types'
import { TAULA_NOTIFICACIONS, rowToNotificacio, type NotificacioRow } from './notificacions.utils'

interface NotificacionsState {
  notificacions: Notificacio[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  reintentar: (id: string) => Promise<void>
  cancellar: (id: string) => Promise<void>
}

export const useNotificacions = create<NotificacionsState>((set, get) => ({
  notificacions: [],
  loading: false,
  error: null,

  async load() {
    set({ loading: true, error: null })
    try {
      const files = await getAll<NotificacioRow>(TAULA_NOTIFICACIONS, 'created_at')
      // Les més noves primer: el que interessa és què passa ara, no el 2019.
      set({ notificacions: files.map(rowToNotificacio).reverse() })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error carregant les notificacions' })
    } finally {
      set({ loading: false })
    }
  },

  async reintentar(id) {
    await callRpc('retry_notification', { p_id: id })
    await get().load()
  },

  async cancellar(id) {
    await callRpc('cancel_notification', { p_id: id })
    await get().load()
  },
}))
