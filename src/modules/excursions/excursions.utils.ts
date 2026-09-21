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
  preu_alumne: string | number | null
  preu_confirmat_per: string | null
  data_circular: string | null
  data_limit_pagament: string | null
  data_limit_resguard: string | null
  circular_enviada_per: string | null
  ampa_collabora: boolean
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
    Creat_per: row.creat_per,
    // `numeric` torna com a cadena per PostgREST: cal convertir-lo o una
    // suma de preus faria concatenació de text en comptes d'aritmètica.
    PreuAlumne: row.preu_alumne == null ? null : Number(row.preu_alumne),
    PreuConfirmatPer: row.preu_confirmat_per ?? null,
    DataCircular: row.data_circular ?? null,
    DataLimitPagament: row.data_limit_pagament ?? null,
    DataLimitResguard: row.data_limit_resguard ?? null,
    CircularEnviadaPer: row.circular_enviada_per ?? null,
    // Booleà: mai `null`, encara que la fila arribés incompleta.
    AmpaCollabora: row.ampa_collabora ?? false,
    Grups: [], Acompanyants: [],
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

/**
 * Opcions de grup que es poden triar en una fila del formulari: les que encara
 * no ha agafat ningú, més la que ja té aquesta fila. La base de dades té un
 * índex únic per (excursió, grup) i rebutjaria un grup repetit en desar.
 */
export function grupsTriables(disponibles: string[], jaTriats: string[], actual: string): string[] {
  return disponibles.filter((op) => op === actual || !jaTriats.includes(op))
}

/** Converteix una excursió desada en els valors del formulari. */
export function formDataDe(e: Excursio | undefined, jo: string): ExcursioFormData {
  if (!e) {
    return {
      Etapa: 'EP', Lloc: '', Poblacio: '', Activitat: '', Data: '',
      HoraSortida: '', HoraTornada: '', Transport: 'autocar', TransportDetall: '',
      AcompanyantsExterns: 0, Observacions: '', Responsable: jo,
      Grups: [{ Grup: '', AlumnesPrevistos: 0 }], Acompanyants: [],
    }
  }
  return {
    Etapa: e.Etapa, Lloc: e.Lloc, Poblacio: e.Poblacio, Activitat: e.Activitat,
    Data: e.Data ?? '', HoraSortida: e.HoraSortida, HoraTornada: e.HoraTornada,
    Transport: e.Transport, TransportDetall: e.TransportDetall,
    AcompanyantsExterns: e.AcompanyantsExterns, Observacions: e.Observacions,
    Responsable: e.Responsable,
    // Sempre almenys una fila, perquè el formulari no surti sense cap selector.
    Grups: e.Grups.length
      ? e.Grups.map((g) => ({ Grup: g.Grup, AlumnesPrevistos: g.AlumnesPrevistos }))
      : [{ Grup: '', AlumnesPrevistos: 0 }],
    Acompanyants: [...e.Acompanyants],
  }
}

/**
 * El nivell d'un grup: el nom sense la lletra de línia final. "EP-1r C" és del
 * nivell "EP-1r"; "GM", que no té línia, és el seu propi nivell.
 *
 * Es dedueix del nom en comptes de mantenir una segona llista de nivells
 * perquè no tots en tenen les mateixes línies (Infantil i GM no segueixen el
 * patró), i dues llistes amb excepcions surten més cares de mantenir que una.
 */
export function nivellDeGrup(grup: string): string {
  const tall = grup.lastIndexOf(' ')
  if (tall === -1) return grup
  const ultim = grup.slice(tall + 1)
  // Només compta com a línia una lletra sola: "Aula Oberta" no s'ha de partir.
  return ultim.length === 1 && /\p{Lu}/u.test(ultim) ? grup.slice(0, tall) : grup
}

/** Els nivells que hi ha a una llista de grups, sense repetits i en el mateix ordre. */
export function nivellsDeGrups(grups: string[]): string[] {
  return [...new Set(grups.map(nivellDeGrup))]
}

/** Totes les línies d'un nivell. */
export function grupsDelNivell(grups: string[], nivell: string): string[] {
  return grups.filter((g) => nivellDeGrup(g) === nivell)
}
