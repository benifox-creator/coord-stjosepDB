export const ETAPES_SUBSTITUCIO = ['EI', 'EP', 'ESO 1r-2n', 'ESO 3r-4t', 'BATX', 'GM'] as const
export type EtapaSubstitucio = typeof ETAPES_SUBSTITUCIO[number]

export const ETAPA_FRANJA_KEY: Record<EtapaSubstitucio, string> = {
  'EI':         'substitucions.franges.EI',
  'EP':         'substitucions.franges.EP',
  'ESO 1r-2n':  'substitucions.franges.ESO12',
  'ESO 3r-4t':  'substitucions.franges.ESO34',
  'BATX':       'substitucions.franges.BATX',
  'GM':         'substitucions.franges.GM',
}

export type TipusSubstitucio = 'Classe' | 'Pati'
export type EstatSubstitucio = 'Pendent' | 'Realitzada' | 'Cancel·lada'

export interface Substitucio {
  id: string
  ID: string
  Data: string
  Etapa: EtapaSubstitucio
  Franja: string
  Tipus: TipusSubstitucio
  ProfessorAbsent: string
  ProfessorSubstitut: string
  Grup: string
  Materia: string
  Estat: EstatSubstitucio
  Notes: string
  Creat_el: string
  Creat_per: string
  Absencia_ID?: string
}

export interface SubstitucioFormData {
  Data: string
  Etapa: EtapaSubstitucio
  Franja: string
  Tipus: TipusSubstitucio
  ProfessorAbsent: string
  ProfessorSubstitut: string
  Grup: string
  Materia: string
  Notes: string
  Absencia_ID?: string
}
