import type { EtapaSubstitucio } from '../substitucions/types'

export const DIES_SETMANA_HORARI = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres'] as const
export type DiaSetmana = typeof DIES_SETMANA_HORARI[number]

export type TipusPeriode = 'Lectiva' | 'No lectiva'

export interface Horari {
  id: string
  Professor: string
  DiaSetmana: DiaSetmana
  Etapa: EtapaSubstitucio
  Franja: string
  Tipus: TipusPeriode
  Grup: string
  Materia: string
  Creat_el: string
  Creat_per: string
}

export interface HorariFormData {
  DiaSetmana: DiaSetmana
  Etapa: EtapaSubstitucio
  Franja: string
  Tipus: TipusPeriode
  Grup: string
  Materia: string
}
