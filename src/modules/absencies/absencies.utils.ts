import { supabase } from '../../services/db'
import { useUsuarisStore } from '../../store/usuarisStore'
import { DIES_CA_LLARG, MESOS_CA_LLARG } from '../substitucions/substitucions.utils'
import type { Absencia, EstatAbsencia } from './types'

export const TABLE_ABSENCIES = 'absencies'

export function calcularHores(horaInici: string, horaFi: string): number {
  const [hIni, mIni] = horaInici.split(':').map(Number)
  const [hFi, mFi] = horaFi.split(':').map(Number)
  if ([hIni, mIni, hFi, mFi].some((n) => Number.isNaN(n))) return 0
  const minuts = (hFi * 60 + mFi) - (hIni * 60 + mIni)
  if (minuts <= 0) return 0
  return Math.round((minuts / 60) * 100) / 100
}

export interface AbsenciaRow {
  id: string
  codi: string
  professor: string
  data: string
  hora_inici: string
  hora_fi: string
  hores: number
  motiu: string
  notes: string
  estat: string
  motiu_rebuig: string
  creat_el: string
  creat_per: string
  revisat_per: string
  revisat_el: string
}

export function rowToAbsencia(row: AbsenciaRow): Absencia {
  return {
    id: row.id,
    ID: row.codi,
    Professor: row.professor,
    Data: row.data,
    HoraInici: row.hora_inici,
    HoraFi: row.hora_fi,
    Hores: row.hores,
    Motiu: row.motiu,
    Notes: row.notes,
    Estat: (row.estat as EstatAbsencia) ?? 'Pendent revisió',
    MotiuRebuig: row.motiu_rebuig,
    Creat_el: row.creat_el,
    Creat_per: row.creat_per,
    Revisat_per: row.revisat_per,
    Revisat_el: row.revisat_el,
  }
}

export function absenciaToInsert(a: {
  Professor: string
  Data: string
  HoraInici: string
  HoraFi: string
  Hores: number
  Motiu: string
  Notes: string
  Estat: EstatAbsencia
  Creat_per: string
}): Record<string, unknown> {
  return {
    professor: a.Professor,
    data: a.Data,
    hora_inici: a.HoraInici,
    hora_fi: a.HoraFi,
    hores: a.Hores,
    motiu: a.Motiu,
    notes: a.Notes,
    estat: a.Estat,
    creat_per: a.Creat_per,
  }
}

export function absenciaToUpdate(a: Partial<Pick<Absencia,
  'Estat' | 'MotiuRebuig' | 'Revisat_per' | 'Revisat_el'
>>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (a.Estat !== undefined) out.estat = a.Estat
  if (a.MotiuRebuig !== undefined) out.motiu_rebuig = a.MotiuRebuig
  if (a.Revisat_per !== undefined) out.revisat_per = a.Revisat_per
  if (a.Revisat_el !== undefined) out.revisat_el = a.Revisat_el
  return out
}

function formatDiaComplet(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${DIES_CA_LLARG[d.getDay()]}, ${d.getDate()} de ${MESOS_CA_LLARG[d.getMonth()]} de ${d.getFullYear()}`
}

export function buildEmailNovaAbsencia(
  a: Absencia,
  nomProfessor: string,
): { subject: string; body: string } {
  const diaStr = formatDiaComplet(a.Data)
  const subject = `Nova absència pendent de revisar — ${nomProfessor}`
  const lines = [
    `Hola,`,
    '',
    `${nomProfessor} ha reportat una absència pendent de revisar:`,
    '',
    `  Data:    ${diaStr}`,
    `  Horari:  ${a.HoraInici}–${a.HoraFi} (${a.Hores.toString().replace('.', ',')} hores)`,
    `  Motiu:   ${a.Motiu}`,
    ...(a.Notes ? ['', `  Notes: ${a.Notes}`] : []),
    '',
    `Accedeix a SJO Hub per aprovar-la o rebutjar-la.`,
    '',
    '— SJO Hub · Col·legi Sant Josep Obrer',
  ]
  return { subject, body: lines.join('\n') }
}

export function buildEmailRevisioAbsencia(a: Absencia): { subject: string; body: string } {
  const diaStr = formatDiaComplet(a.Data)
  const aprovada = a.Estat === 'Aprovada'
  const subject = `Absència ${aprovada ? 'aprovada' : 'rebutjada'} — ${diaStr}`
  const lines = [
    `Hola,`,
    '',
    `La teva absència del ${diaStr} (${a.HoraInici}–${a.HoraFi}) ha estat ${aprovada ? 'aprovada' : 'rebutjada'}.`,
    ...(!aprovada && a.MotiuRebuig ? ['', `Motiu: ${a.MotiuRebuig}`] : []),
    '',
    '— SJO Hub · Col·legi Sant Josep Obrer',
  ]
  return { subject, body: lines.join('\n') }
}

export async function getDireccioICoordinadorEmails(): Promise<string[]> {
  const { usuaris } = useUsuarisStore.getState()
  if (usuaris.length > 0) {
    return usuaris
      .filter((u) => u.Rol === 'coordinador' || u.Rol === 'direccio')
      .map((u) => u.Email)
      .filter(Boolean)
  }
  try {
    const { data, error } = await supabase.from('usuaris').select('email').in('rol', ['coordinador', 'direccio'])
    if (error) throw error
    return (data ?? []).map((r) => r.email).filter(Boolean)
  } catch {
    return []
  }
}
