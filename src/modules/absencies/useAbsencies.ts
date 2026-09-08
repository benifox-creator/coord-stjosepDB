import { create } from 'zustand'
import { getAll, insertRow, updateRowById, deleteRowById } from '../../services/db'
import { sendEmail } from '../../services/gmail'
import { useAuthStore } from '../../store/authStore'
import { useUsuarisStore } from '../../store/usuarisStore'
import type { Absencia, AbsenciaFormData } from './types'
import {
  TABLE_ABSENCIES, rowToAbsencia, absenciaToInsert, absenciaToUpdate,
  calcularHores, buildEmailNovaAbsencia, buildEmailRevisioAbsencia, getDireccioICoordinadorEmails,
  type AbsenciaRow,
} from './absencies.utils'

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
    const email = (useAuthStore.getState().user?.email ?? '').toLowerCase()
    const hores = calcularHores(data.HoraInici, data.HoraFi)

    const row = await insertRow<AbsenciaRow>(TABLE_ABSENCIES, absenciaToInsert({
      Professor: email,
      Data: data.Data,
      HoraInici: data.HoraInici,
      HoraFi: data.HoraFi,
      Hores: hores,
      Motiu: data.Motiu,
      Notes: data.Notes,
      Estat: 'Pendent revisió',
      Creat_per: email,
    }))
    const creada = rowToAbsencia(row)
    set((s) => ({ absencies: [...s.absencies, creada] }))

    try {
      const usuaris = useUsuarisStore.getState().usuaris
      const nom = usuaris.find((u) => u.Email === email)?.Nom || email
      const { subject, body } = buildEmailNovaAbsencia(creada, nom)
      const destinataris = await getDireccioICoordinadorEmails()
      await Promise.allSettled(destinataris.map((to) => sendEmail({ to, subject, body })))
    } catch {
      // error d'email és no bloquejant
    }
  },

  async aprovar(a) {
    const revisor = useAuthStore.getState().user?.email ?? ''
    const row = await updateRowById<AbsenciaRow>(TABLE_ABSENCIES, a.id, absenciaToUpdate({
      Estat: 'Aprovada', Revisat_per: revisor, Revisat_el: new Date().toISOString(),
    }))
    const updated = rowToAbsencia(row)
    set((s) => ({ absencies: s.absencies.map((x) => (x.id === a.id ? updated : x)) }))
    try {
      const { subject, body } = buildEmailRevisioAbsencia(updated)
      await sendEmail({ to: updated.Professor, subject, body })
    } catch {
      // no bloquejant
    }
  },

  async rebutjar(a, motiu) {
    const revisor = useAuthStore.getState().user?.email ?? ''
    const row = await updateRowById<AbsenciaRow>(TABLE_ABSENCIES, a.id, absenciaToUpdate({
      Estat: 'Rebutjada', MotiuRebuig: motiu, Revisat_per: revisor, Revisat_el: new Date().toISOString(),
    }))
    const updated = rowToAbsencia(row)
    set((s) => ({ absencies: s.absencies.map((x) => (x.id === a.id ? updated : x)) }))
    try {
      const { subject, body } = buildEmailRevisioAbsencia(updated)
      await sendEmail({ to: updated.Professor, subject, body })
    } catch {
      // no bloquejant
    }
  },

  async eliminar(a) {
    await deleteRowById(TABLE_ABSENCIES, a.id)
    set((s) => ({ absencies: s.absencies.filter((x) => x.id !== a.id) }))
  },
}))
