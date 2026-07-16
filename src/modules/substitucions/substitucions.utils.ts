import type { Substitucio } from './types'

export const TABLE_SUBSTITUCIONS = 'substitucions'

function pad(n: number) { return String(n).padStart(2, '0') }

export function formatDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatDateTimeISO(d: Date): string {
  return `${formatDateISO(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const DIES_CA_LLARG = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte']
const MESOS_CA_LLARG = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre']
const MESOS_CA_CURT = ['gen', 'feb', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'des']

export function formatDiaLlarg(d: Date): string {
  return `${DIES_CA_LLARG[d.getDay()]} ${d.getDate()} ${MESOS_CA_CURT[d.getMonth()]}.`
}

export function formatWeekRange(dates: Date[]): string {
  const first = dates[0]
  const last  = dates[4]
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()}–${last.getDate()} ${MESOS_CA_LLARG[last.getMonth()]} ${last.getFullYear()}`
  }
  return `${first.getDate()} ${MESOS_CA_CURT[first.getMonth()]}. – ${last.getDate()} ${MESOS_CA_CURT[last.getMonth()]}. ${last.getFullYear()}`
}

export function getWeekDates(weekOffset: number): Date[] {
  const today = new Date()
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export function isThisWeek(date: Date, weekDates: Date[]): boolean {
  const iso = formatDateISO(date)
  return weekDates.some((d) => formatDateISO(d) === iso)
}

export interface SubstitucioRow {
  id: string
  codi: string
  data: string
  etapa: string
  franja: string
  tipus: string
  professor_absent: string
  professor_substitut: string
  grup: string
  materia: string
  estat: string
  notes: string
  creat_el: string
  creat_per: string
}

export function rowToSubstitucio(row: SubstitucioRow): Substitucio {
  return {
    id: row.id,
    ID: row.codi,
    Data: row.data,
    Etapa: (row.etapa as Substitucio['Etapa']) ?? 'ESO 1r-2n',
    Franja: row.franja,
    Tipus: (row.tipus as Substitucio['Tipus']) ?? 'Classe',
    ProfessorAbsent: row.professor_absent,
    ProfessorSubstitut: row.professor_substitut,
    Grup: row.grup,
    Materia: row.materia,
    Estat: (row.estat as Substitucio['Estat']) ?? 'Pendent',
    Notes: row.notes,
    Creat_el: row.creat_el,
    Creat_per: row.creat_per,
  }
}

export function substitucioToInsert(s: Omit<Substitucio, 'id' | 'ID' | 'Creat_el'>): Record<string, unknown> {
  return {
    data: s.Data, etapa: s.Etapa, franja: s.Franja, tipus: s.Tipus,
    professor_absent: s.ProfessorAbsent, professor_substitut: s.ProfessorSubstitut,
    grup: s.Grup, materia: s.Materia, estat: s.Estat,
    notes: s.Notes, creat_per: s.Creat_per,
  }
}

export function substitucioToUpdate(s: Partial<Pick<Substitucio,
  'Data' | 'Etapa' | 'Franja' | 'Tipus' | 'ProfessorAbsent' | 'ProfessorSubstitut' | 'Grup' | 'Materia' | 'Estat' | 'Notes'
>>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (s.Data !== undefined) out.data = s.Data
  if (s.Etapa !== undefined) out.etapa = s.Etapa
  if (s.Franja !== undefined) out.franja = s.Franja
  if (s.Tipus !== undefined) out.tipus = s.Tipus
  if (s.ProfessorAbsent !== undefined) out.professor_absent = s.ProfessorAbsent
  if (s.ProfessorSubstitut !== undefined) out.professor_substitut = s.ProfessorSubstitut
  if (s.Grup !== undefined) out.grup = s.Grup
  if (s.Materia !== undefined) out.materia = s.Materia
  if (s.Estat !== undefined) out.estat = s.Estat
  if (s.Notes !== undefined) out.notes = s.Notes
  return out
}

export function buildEmailSubstitucio(
  s: Substitucio,
  nomSubstitut: string,
): { subject: string; body: string } {
  const d = new Date(s.Data + 'T00:00:00')
  const diaStr = `${DIES_CA_LLARG[d.getDay()]}, ${d.getDate()} de ${MESOS_CA_LLARG[d.getMonth()]} de ${d.getFullYear()}`
  const subject = `Substitució assignada — ${diaStr} · ${s.Franja}`
  const lines = [
    `Hola ${nomSubstitut},`,
    '',
    `Se t'ha assignat una substitució:`,
    '',
    `  Data:     ${diaStr}`,
    `  Franja:   ${s.Franja}`,
    `  Tipus:    ${s.Tipus}`,
    `  Etapa:    ${s.Etapa}`,
    ...(s.Tipus === 'Classe' ? [
      `  Grup:     ${s.Grup}`,
      `  Matèria:  ${s.Materia}`,
      `  Professor absent: ${s.ProfessorAbsent}`,
    ] : []),
    ...(s.Notes ? ['', `  Notes: ${s.Notes}`] : []),
    '',
    `Accedeix a la plataforma per veure els detalls i marcar-la com a realitzada quan acabis.`,
    '',
    '— Coordinació Digital · Col·legi Sant Josep Obrer',
  ]
  return { subject, body: lines.join('\n') }
}
