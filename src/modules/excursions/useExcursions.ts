import { create } from 'zustand'
import { getAll, insertRow, updateRowById, deleteRowById, callRpc } from '../../services/db'
import { schoolYear } from '../../utils/schoolCalendar'
import type { Excursio, ExcursioFormData, EstatExcursio } from './types'
import type { DatesCircular } from './datesCircular'
import { TAULA_EXCURSIONS, rowToExcursio, excursioToInsert, dataTrasladada, type ExcursioRow } from './excursions.utils'

interface GrupRow { id: string; excursio_id: string; grup: string; alumnes_previstos: number; alumnes_finals: number | null; alumnes_pagats: number }
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
  enviarCircular: (id: string, dates: DatesCircular) => Promise<void>
  copiarDelCurs: (cursOrigen: string, ids: string[]) => Promise<void>
  registraPagaments: (grupId: string, pagats: number) => Promise<void>
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
          .map((g) => ({
            id: g.id, Grup: g.grup, AlumnesPrevistos: g.alumnes_previstos, AlumnesFinals: g.alumnes_finals,
            // Mai `null`: "ningú ha pagat" és zero, no un desconegut.
            AlumnesPagats: g.alumnes_pagats ?? 0,
          })),
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

  /**
   * Enviar la circular no és un canvi d'estat qualsevol: desa les tres dates,
   * comprova que el preu ja estigui congelat i avisa els acompanyants. Tot
   * això passa dins `enviar_circular`, i per això aquí no hi ha cap `update`
   * —un `update` directe es saltaria les comprovacions i el correu.
   *
   * No es recarrega la llista des d'aquí, com tampoc ho fa `useFinances.confirma`:
   * qui ho crida ja ho fa, i així no es demana el curs sencer dues vegades.
   */
  async enviarCircular(id, dates) {
    await callRpc('enviar_circular', {
      p_id: id,
      p_circular: dates.circular,
      p_pagament: dates.pagament,
      p_resguard: dates.resguard,
    })
  },

  async copiarDelCurs(cursOrigen, ids) {
    const desti = schoolYear()
    const [files, grups] = await Promise.all([
      getAll<ExcursioRow>(TAULA_EXCURSIONS, 'data', { curs_escolar: cursOrigen }),
      getAll<GrupRow>('excursio_grups', 'grup'),
    ])
    for (const f of files.filter((f) => ids.includes(f.id))) {
      // No es copien l'estat (el disparador obliga que neixi com a esborrany),
      // el responsable (qui hi anava pot no ser-hi ja: el posa qui copia) ni
      // els acompanyants (les persones canvien d'un curs a l'altre).
      const nova = await insertRow<ExcursioRow>(TAULA_EXCURSIONS, {
        etapa: f.etapa, lloc: f.lloc, poblacio: f.poblacio, activitat: f.activitat,
        data: dataTrasladada(f.data, cursOrigen, desti),
        hora_sortida: f.hora_sortida, hora_tornada: f.hora_tornada,
        transport: f.transport, transport_detall: f.transport_detall,
        observacions: f.observacions, curs_escolar: desti,
      })
      for (const g of grups.filter((g) => g.excursio_id === f.id)) {
        // Els alumnes finals del curs passat no es copien: són d'aquell any.
        await insertRow('excursio_grups', { excursio_id: nova.id, grup: g.grup, alumnes_previstos: g.alumnes_previstos })
      }
    }
    await get().load(desti)
  },

  /**
   * El recompte de pagats no s'actualitza amb un `update`: la migració ha
   * revocat el privilegi d'escriptura sobre aquesta columna i només
   * `registra_pagaments` hi pot tocar. Es recarrega després perquè la fitxa
   * de l'excursió ensenyi la xifra nova.
   */
  async registraPagaments(grupId, pagats) {
    await callRpc('registra_pagaments', { p_grup: grupId, p_pagats: pagats })
    await get().load()
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
