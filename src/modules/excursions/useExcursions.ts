import { create } from 'zustand'
import { getAll, insertRow, updateRowById, deleteRowById } from '../../services/db'
import { schoolYear } from '../../utils/schoolCalendar'
import type { Excursio, ExcursioFormData, EstatExcursio } from './types'
import { TAULA_EXCURSIONS, rowToExcursio, excursioToInsert, type ExcursioRow } from './excursions.utils'

interface GrupRow { id: string; excursio_id: string; grup: string; alumnes_previstos: number; alumnes_finals: number | null }
interface AcompanyantRow { id: string; excursio_id: string; email: string }

interface ExcursionsState {
  excursions: Excursio[]
  loading: boolean
  error: string | null
  load: (curs?: string) => Promise<void>
  crear: (data: ExcursioFormData) => Promise<Excursio>
  editar: (id: string, data: ExcursioFormData) => Promise<void>
  eliminar: (id: string) => Promise<void>
  canviarEstat: (id: string, estat: EstatExcursio, motiu?: string) => Promise<void>
}

// Si se'n demanen dues seguides, només val la darrera: si no, una resposta
// lenta d'un curs anterior podria pisar la del curs que s'està mirant.
let generacio = 0

export const useExcursions = create<ExcursionsState>((set, get) => ({
  excursions: [],
  loading: false,
  error: null,

  async load(curs = schoolYear()) {
    const meva = ++generacio
    set({ loading: true, error: null })
    try {
      const [files, grups, acompanyants] = await Promise.all([
        getAll<ExcursioRow>(TAULA_EXCURSIONS, 'data', { curs_escolar: curs }),
        getAll<GrupRow>('excursio_grups', 'grup'),
        getAll<AcompanyantRow>('excursio_acompanyants', 'email'),
      ])
      if (meva !== generacio) return
      set({ excursions: files.map((f) => ({
        ...rowToExcursio(f),
        Grups: grups.filter((g) => g.excursio_id === f.id)
          .map((g) => ({ id: g.id, Grup: g.grup, AlumnesPrevistos: g.alumnes_previstos, AlumnesFinals: g.alumnes_finals })),
        Acompanyants: acompanyants.filter((a) => a.excursio_id === f.id).map((a) => a.email),
      })) })
    } catch (err) {
      if (meva === generacio) set({ error: err instanceof Error ? err.message : 'Error carregant les excursions' })
    } finally {
      if (meva === generacio) set({ loading: false })
    }
  },

  async crear(data) {
    const fila = await insertRow<ExcursioRow>(TAULA_EXCURSIONS, { ...excursioToInsert(data), curs_escolar: schoolYear() })
    await sincronitzaFilles(fila.id, data)
    await get().load(fila.curs_escolar)
    return rowToExcursio(fila)
  },

  async editar(id, data) {
    await updateRowById<ExcursioRow>(TAULA_EXCURSIONS, id, excursioToInsert(data))
    await sincronitzaFilles(id, data)
    await get().load()
  },

  async eliminar(id) {
    await deleteRowById(TAULA_EXCURSIONS, id)
    set((s) => ({ excursions: s.excursions.filter((e) => e.id !== id) }))
  },

  async canviarEstat(id, estat, motiu) {
    const camps: Record<string, unknown> = { estat }
    if (estat === 'Esborrany' && motiu !== undefined) camps.motiu_rebuig = motiu
    if (estat === 'Cancel·lada' && motiu !== undefined) camps.motiu_cancellacio = motiu
    const fila = await updateRowById<ExcursioRow>(TAULA_EXCURSIONS, id, camps)
    set((s) => ({ excursions: s.excursions.map((e) => (
      // Es conserven els grups i els acompanyants ja carregats: la fila que
      // torna el servidor no els porta.
      e.id === id ? { ...rowToExcursio(fila), Grups: e.Grups, Acompanyants: e.Acompanyants } : e
    )) }))
  },
}))

/**
 * Posa al dia els grups i els acompanyants sense esborrar-ho tot i tornar-ho a
 * escriure: només toca el que ha canviat. Així, si una escriptura falla, el que
 * ja hi havia i es manté no s'ha perdut pel camí.
 */
async function sincronitzaFilles(excursioId: string, data: ExcursioFormData) {
  const [grupsActuals, acompActuals] = await Promise.all([
    getAll<GrupRow>('excursio_grups', 'grup', { excursio_id: excursioId }),
    getAll<AcompanyantRow>('excursio_acompanyants', 'email', { excursio_id: excursioId }),
  ])

  const volguts = data.Grups.filter((g) => g.Grup)
  for (const actual of grupsActuals) {
    const volgut = volguts.find((g) => g.Grup === actual.grup)
    if (!volgut) await deleteRowById('excursio_grups', actual.id)
    else if (volgut.AlumnesPrevistos !== actual.alumnes_previstos) {
      await updateRowById('excursio_grups', actual.id, { alumnes_previstos: volgut.AlumnesPrevistos })
    }
  }
  for (const g of volguts) {
    if (!grupsActuals.some((a) => a.grup === g.Grup)) {
      await insertRow('excursio_grups', { excursio_id: excursioId, grup: g.Grup, alumnes_previstos: g.AlumnesPrevistos })
    }
  }

  for (const actual of acompActuals) {
    if (!data.Acompanyants.includes(actual.email)) await deleteRowById('excursio_acompanyants', actual.id)
  }
  for (const email of data.Acompanyants) {
    if (!acompActuals.some((a) => a.email === email)) {
      await insertRow('excursio_acompanyants', { excursio_id: excursioId, email })
    }
  }
}
