import { timeMinutes, slotMinutes } from '../../utils/schoolCalendar'
import { getAll, supabase } from '../../services/db'
import { useUsuarisStore } from '../../store/usuarisStore'
import { getFirmaEmail } from '../../store/configStore'
import { DIES_CA_LLARG, MESOS_CA_LLARG } from '../substitucions/substitucions.utils'
import type { Absencia, EstatAbsencia, PeriodeAbsencia } from './types'

export const TABLE_ABSENCIES = 'absencies'

export function calcularHores(horaInici: string, horaFi: string): number {
  try {
    return Math.round(Math.max(0, timeMinutes(horaFi) - timeMinutes(horaInici)) / 60 * 100) / 100
  } catch { return 0 }
}

export function durataFranja(franja: string): number {
  const [inici, fi] = franja.split('-')
  return calcularHores(inici ?? '', fi ?? '')
}

export function duradaPeriodes(periodes: PeriodeAbsencia[], tipus?: PeriodeAbsencia['Tipus']): number {
  const minutes = periodes.filter(p => tipus === undefined || p.Tipus === tipus).reduce((total, p) => {
    const [start, end] = slotMinutes(p.Franja)
    return total + end - start
  }, 0)
  return Math.round(minutes / 60 * 100) / 100
}

export interface AbsenciaRow {
  te_periodes?: boolean
  id: string
  codi: string
  professor: string
  data: string
  hora_inici: string
  hora_fi: string
  hores: number
  hores_no_lectives: number
  motiu: string
  notes: string
  estat: string
  motiu_rebuig: string
  creat_el: string
  creat_per: string
  revisat_per: string
  revisat_el: string
}

export const TABLE_ABSENCIA_PERIODES = 'absencia_periodes'

export interface PeriodeAbsenciaRow {
  necessita_cobertura?: boolean
  id: string
  absencia_id: string
  franja: string
  etapa: string
  tipus: string
  grup: string
  materia: string
}

export function periodeToInsert(absenciaId: string, p: PeriodeAbsencia): Record<string, unknown> {
  return {
    absencia_id: absenciaId,
    franja: p.Franja,
    etapa: p.Etapa,
    tipus: p.Tipus,
    grup: p.Grup,
    materia: p.Materia,
  }
}

export function rowToPeriodeAbsencia(row: PeriodeAbsenciaRow): PeriodeAbsencia {
  return {
    NecessitaCobertura: row.necessita_cobertura ?? false,
    Franja: row.franja,
    Etapa: row.etapa as PeriodeAbsencia['Etapa'],
    Tipus: (row.tipus as PeriodeAbsencia['Tipus']) ?? 'Lectiva',
    Grup: row.grup,
    Materia: row.materia,
  }
}

export async function getPeriodesAbsencia(absenciaId: string): Promise<PeriodeAbsencia[]> {
  const data = await getAll<PeriodeAbsenciaRow>(TABLE_ABSENCIA_PERIODES, 'id', { absencia_id: absenciaId })
  return data.map(rowToPeriodeAbsencia).sort((a,b) => slotMinutes(a.Franja)[0]-slotMinutes(b.Franja)[0])
}

export function rowToAbsencia(row: AbsenciaRow): Absencia {
  return {
    id: row.id,
    ID: row.codi,
    Professor: row.professor,
    TePeriodes: row.te_periodes ?? false,
    Data: row.data,
    HoraInici: row.hora_inici,
    HoraFi: row.hora_fi,
    Hores: row.hores,
    HoresNoLectives: row.hores_no_lectives ?? 0,
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
  HoresNoLectives: number
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
    hores_no_lectives: a.HoresNoLectives,
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
    ...(a.HoresNoLectives > 0 ? [`  (${a.HoresNoLectives.toString().replace('.', ',')} hores no lectives)`] : []),
    `  Motiu:   ${a.Motiu}`,
    ...(a.Notes ? ['', `  Notes: ${a.Notes}`] : []),
    '',
    `Accedeix a SJO Hub per aprovar-la o rebutjar-la.`,
    '',
    `— ${getFirmaEmail()} · Col·legi Sant Josep Obrer`,
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
    `— ${getFirmaEmail()} · Col·legi Sant Josep Obrer`,
  ]
  return { subject, body: lines.join('\n') }
}

export async function getAprovadorsAbsenciesEmails(): Promise<string[]> {
  const { usuaris } = useUsuarisStore.getState()
  if (usuaris.length > 0) {
    return usuaris
      .filter((u) => u.Rol === 'coordinador' || u.Rol === 'direccio' || u.Rol === 'titular')
      .map((u) => u.Email)
      .filter(Boolean)
  }
  try {
    const { data, error } = await supabase.from('usuaris').select('email').in('rol', ['coordinador', 'direccio', 'titular'])
    if (error) throw error
    return (data ?? []).map((r) => r.email).filter(Boolean)
  } catch {
    return []
  }
}
