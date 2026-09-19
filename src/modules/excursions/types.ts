import { ETAPES_SUBSTITUCIO, type EtapaSubstitucio } from '../substitucions/types'

export type { EtapaSubstitucio }
export const ETAPES_EXCURSIO = ETAPES_SUBSTITUCIO

export const ESTATS_EXCURSIO = ['Esborrany', 'Proposada', 'Aprovada', 'Reservada', 'Circular enviada', 'Cancel·lada'] as const
export type EstatExcursio = typeof ESTATS_EXCURSIO[number]

export const TRANSPORTS = ['autocar', 'altres'] as const
export type Transport = typeof TRANSPORTS[number]

export const TRANSPORT_LABELS: Record<Transport, string> = {
  autocar: 'Autocar',
  altres: 'Altres (metro, tren, FGC, a peu…)',
}

export const ESTAT_COLORS: Record<EstatExcursio, string> = {
  'Esborrany': 'bg-gray-100 text-gray-600',
  'Proposada': 'bg-amber-100 text-amber-800',
  'Aprovada': 'bg-green-100 text-green-800',
  'Reservada': 'bg-blue-100 text-blue-800',
  'Circular enviada': 'bg-violet-100 text-violet-800',
  'Cancel·lada': 'bg-red-100 text-red-700',
}

export interface ExcursioGrup {
  id: string
  Grup: string
  AlumnesPrevistos: number
  AlumnesFinals: number | null
}

export interface Excursio {
  id: string
  Codi: string
  CursEscolar: string
  Estat: EstatExcursio
  Etapa: EtapaSubstitucio
  Lloc: string
  Poblacio: string
  Activitat: string
  Data: string | null
  HoraSortida: string
  HoraTornada: string
  Transport: Transport
  TransportDetall: string
  AcompanyantsExterns: number
  Observacions: string
  Responsable: string
  MotiuRebuig: string | null
  MotiuCancellacio: string | null
  ProposadaPer: string | null
  AprovadaPer: string | null
  ReservadaPer: string | null
  Creat_per: string
  Grups: ExcursioGrup[]
  Acompanyants: string[]
}

export interface ExcursioFormData {
  Etapa: EtapaSubstitucio
  Lloc: string
  Poblacio: string
  Activitat: string
  Data: string
  HoraSortida: string
  HoraTornada: string
  Transport: Transport
  TransportDetall: string
  AcompanyantsExterns: number
  Observacions: string
  Responsable: string
  Grups: { Grup: string; AlumnesPrevistos: number }[]
  Acompanyants: string[]
}
