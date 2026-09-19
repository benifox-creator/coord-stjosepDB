import type { Excursio, ExcursioFormData, EstatExcursio, Transport } from './types'
import type { EtapaSubstitucio } from '../substitucions/types'

export const TAULA_EXCURSIONS = 'excursions'

export interface ExcursioRow {
  id: string
  codi: string
  curs_escolar: string
  estat: string
  etapa: string
  lloc: string
  poblacio: string
  activitat: string
  data: string | null
  hora_sortida: string
  hora_tornada: string
  transport: string
  transport_detall: string
  acompanyants_externs: number
  observacions: string
  responsable: string
  motiu_rebuig: string | null
  motiu_cancellacio: string | null
  proposada_per: string | null
  aprovada_per: string | null
  reservada_per: string | null
  creat_per: string
}

export function rowToExcursio(row: ExcursioRow): Excursio {
  return {
    id: row.id, Codi: row.codi, CursEscolar: row.curs_escolar,
    Estat: row.estat as EstatExcursio, Etapa: row.etapa as EtapaSubstitucio,
    Lloc: row.lloc, Poblacio: row.poblacio, Activitat: row.activitat,
    Data: row.data, HoraSortida: row.hora_sortida, HoraTornada: row.hora_tornada,
    Transport: row.transport as Transport, TransportDetall: row.transport_detall,
    AcompanyantsExterns: row.acompanyants_externs, Observacions: row.observacions,
    Responsable: row.responsable, MotiuRebuig: row.motiu_rebuig,
    MotiuCancellacio: row.motiu_cancellacio, ProposadaPer: row.proposada_per,
    AprovadaPer: row.aprovada_per, ReservadaPer: row.reservada_per,
    Creat_per: row.creat_per, Grups: [], Acompanyants: [],
  }
}

export function excursioToInsert(d: ExcursioFormData): Record<string, unknown> {
  return {
    etapa: d.Etapa, lloc: d.Lloc.trim(), poblacio: d.Poblacio.trim(),
    activitat: d.Activitat.trim(), data: d.Data || null,
    hora_sortida: d.HoraSortida, hora_tornada: d.HoraTornada,
    transport: d.Transport, transport_detall: d.TransportDetall.trim(),
    acompanyants_externs: d.AcompanyantsExterns,
    observacions: d.Observacions.trim(), responsable: d.Responsable,
  }
}

/** Els noms surten tal com s'han d'ensenyar dins d'una frase: "Falten el lloc i la data." */
export function campsQueFalten(d: ExcursioFormData): string[] {
  const falten: string[] = []
  if (!d.Lloc.trim()) falten.push('el lloc')
  if (!d.Activitat.trim()) falten.push("l'activitat")
  if (!d.Data) falten.push('la data')
  if (!d.HoraSortida.trim()) falten.push("l'hora de sortida")
  if (!d.HoraTornada.trim()) falten.push('l’hora de tornada')
  if (d.Transport === 'altres' && !d.TransportDetall.trim()) falten.push('com s’hi va')
  if (!d.Grups.some((g) => g.AlumnesPrevistos > 0)) falten.push('almenys un grup amb alumnes')
  return falten
}

export function esDiaLectiu(data: string, diesNoLectius: string[]): boolean {
  if (!data) return false
  // Amb T12:00:00 el dia no canvia per la zona horària, com a la resta de l'app.
  const dow = new Date(data + 'T12:00:00').getDay()
  // Una data impossible dona NaN, que no és ni 0 ni 6: sense comprovar-ho,
  // passaria per lectiva.
  if (Number.isNaN(dow)) return false
  if (dow === 0 || dow === 6) return false
  return !diesNoLectius.includes(data)
}

/**
 * Passa una data d'un curs escolar a un altre conservant dia i mes, sumant-li
 * els anys de diferència entre els dos cursos.
 */
export function dataTrasladada(data: string | null, cursOrigen: string, cursDesti: string): string | null {
  if (!data) return null
  const salt = Number(cursDesti.slice(0, 4)) - Number(cursOrigen.slice(0, 4))
  const [any, mes, dia] = data.split('-').map(Number)
  const nouAny = any + salt
  // El 29 de febrer no existeix cada any: es queda al 28.
  const ultimDia = new Date(nouAny, mes, 0).getDate()
  const nouDia = Math.min(dia, ultimDia)
  return `${nouAny}-${String(mes).padStart(2, '0')}-${String(nouDia).padStart(2, '0')}`
}
