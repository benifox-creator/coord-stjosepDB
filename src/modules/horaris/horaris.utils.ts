import type { Horari, DiaSetmana, TipusPeriode } from './types'
import { DIES_SETMANA_HORARI } from './types'
import type { EtapaSubstitucio } from '../substitucions/types'

export const TABLE_HORARIS = 'horaris'

export function diaSetmanaDeData(dataISO: string): DiaSetmana | null {
  const d = new Date(dataISO + 'T00:00:00')
  const dow = d.getDay() // 0 = diumenge ... 6 = dissabte
  if (dow === 0 || dow === 6) return null
  return DIES_SETMANA_HORARI[dow - 1]
}

export interface HorariRow {
  id: string
  professor: string
  dia_setmana: string
  etapa: string
  franja: string
  tipus: string
  grup: string
  materia: string
  curs_escolar: string
  vigent_desde: string
  vigent_fins: string
  necessita_cobertura: boolean
  creat_el: string
  creat_per: string
}

export function rowToHorari(row: HorariRow): Horari {
  return {
    id: row.id,
    Professor: row.professor,
    DiaSetmana: row.dia_setmana as DiaSetmana,
    Etapa: row.etapa as EtapaSubstitucio,
    Franja: row.franja,
    Tipus: (row.tipus as TipusPeriode) ?? 'Lectiva',
    Grup: row.grup,
    Materia: row.materia,
    CursEscolar: row.curs_escolar, VigentDesde: row.vigent_desde, VigentFins: row.vigent_fins, NecessitaCobertura: row.necessita_cobertura,
    Creat_el: row.creat_el,
    Creat_per: row.creat_per,
  }
}

export function horariToInsert(h: {
  Professor: string
  DiaSetmana: DiaSetmana
  Etapa: EtapaSubstitucio
  Franja: string
  Tipus: TipusPeriode
  Grup: string
  Materia: string
  CursEscolar: string
  VigentDesde: string
  VigentFins: string
  NecessitaCobertura: boolean
  Creat_per: string
}): Record<string, unknown> {
  return {
    professor: h.Professor,
    dia_setmana: h.DiaSetmana,
    etapa: h.Etapa,
    franja: h.Franja,
    tipus: h.Tipus,
    grup: h.Grup,
    materia: h.Materia,
    curs_escolar: h.CursEscolar, vigent_desde: h.VigentDesde, vigent_fins: h.VigentFins, necessita_cobertura: h.NecessitaCobertura,
    creat_per: h.Creat_per,
  }
}

export function horariToUpdate(h: Partial<Pick<Horari, 'Tipus' | 'Grup' | 'Materia' | 'VigentDesde' | 'VigentFins' | 'NecessitaCobertura'>>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (h.Tipus !== undefined) out.tipus = h.Tipus
  if (h.Grup !== undefined) out.grup = h.Grup
  if (h.Materia !== undefined) out.materia = h.Materia
  if (h.VigentDesde !== undefined) out.vigent_desde = h.VigentDesde
  if (h.VigentFins !== undefined) out.vigent_fins = h.VigentFins
  if (h.NecessitaCobertura !== undefined) out.necessita_cobertura = h.NecessitaCobertura
  return out
}
