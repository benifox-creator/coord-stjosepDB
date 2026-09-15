import { schoolYear } from '../../utils/schoolCalendar'
import { create } from 'zustand'
import { getAll, insertRow, updateRowById, deleteRowById } from '../../services/db'
import { useAuthStore } from '../../store/authStore'
import type { Horari, HorariFormData } from './types'
import { TABLE_HORARIS, rowToHorari, horariToInsert, horariToUpdate, type HorariRow } from './horaris.utils'

interface HorarisState {
  horaris: Horari[]
  loading: boolean
  error: string | null
  load: (year?: string) => Promise<void>
  // `professor` només l'informa la coordinació en editar l'horari d'algú altre;
  // per omissió l'horari és de qui té la sessió oberta.
  crear: (data: HorariFormData, professor?: string) => Promise<void>
  editar: (h: Horari, data: HorariFormData) => Promise<void>
  eliminar: (h: Horari) => Promise<void>
}

let loadGeneration = 0

export const useHoraris = create<HorarisState>((set) => ({
  horaris: [],
  loading: false,
  error: null,

  async load(year = schoolYear()) {
    const generation = ++loadGeneration
    set({ loading: true, error: null })
    try {
      const rows = await getAll<HorariRow>(TABLE_HORARIS, 'professor', { curs_escolar: year })
      if (generation === loadGeneration) set({ horaris: rows.map(rowToHorari) })
    } catch (err) {
      if (generation === loadGeneration) set({ error: err instanceof Error ? err.message : 'Error carregant horaris' })
    } finally {
      if (generation === loadGeneration) set({ loading: false })
    }
  },

  async crear(data, professor) {
    const email = (useAuthStore.getState().user?.email ?? '').toLowerCase()
    const row = await insertRow<HorariRow>(TABLE_HORARIS, horariToInsert({
      ...data,
      Professor: (professor ?? email).toLowerCase(),
      DiaSetmana: data.DiaSetmana,
      Etapa: data.Etapa,
      Franja: data.Franja,
      Tipus: data.Tipus,
      Grup: data.Grup,
      Materia: data.Materia,
      Creat_per: email,
    }))
    set((s) => ({ horaris: [...s.horaris, rowToHorari(row)] }))
  },

  async editar(h, data) {
    const row = await updateRowById<HorariRow>(TABLE_HORARIS, h.id, horariToUpdate({
      Tipus: data.Tipus, Grup: data.Grup, Materia: data.Materia,
      VigentDesde: data.VigentDesde, VigentFins: data.VigentFins, NecessitaCobertura: data.NecessitaCobertura,
    }))
    const updated = rowToHorari(row)
    set((s) => ({ horaris: s.horaris.map((x) => (x.id === h.id ? updated : x)) }))
  },

  async eliminar(h) {
    await deleteRowById(TABLE_HORARIS, h.id)
    set((s) => ({ horaris: s.horaris.filter((x) => x.id !== h.id) }))
  },
}))
