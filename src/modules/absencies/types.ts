import type { EtapaSubstitucio } from '../substitucions/types'

export type EstatAbsencia = 'Pendent revisió' | 'Aprovada' | 'Rebutjada'

export interface PeriodeAbsencia {
  Franja: string
  Etapa: EtapaSubstitucio
  Tipus: 'Lectiva' | 'No lectiva'
  Grup: string
  Materia: string
}

export interface Absencia {
  id: string
  ID: string
  Professor: string
  Data: string
  HoraInici: string
  HoraFi: string
  Hores: number
  HoresNoLectives: number
  Motiu: string
  Notes: string
  Estat: EstatAbsencia
  MotiuRebuig: string
  Creat_el: string
  Creat_per: string
  Revisat_per: string
  Revisat_el: string
}

export interface AbsenciaFormData {
  Data: string
  HoraInici: string
  HoraFi: string
  HoresNoLectives: number
  Motiu: string
  Notes: string
  Periodes?: PeriodeAbsencia[]
}
