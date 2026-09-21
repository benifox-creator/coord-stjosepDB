export function schoolYear(date = new Date()): string {
  const year = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1
  return `${year}-${year + 1}`
}

export function yearDates(year: string) {
  if (!/^\d{4}-\d{4}$/.test(year)) throw new Error('Curs escolar invàlid')
  const start = Number(year.slice(0, 4))
  if (Number(year.slice(5)) !== start + 1) throw new Error('Curs escolar invàlid')
  return { start: `${start}-09-01`, end: `${start + 1}-08-31` }
}

export function timeMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!match) throw new Error('Hora invàlida')
  const hour = Number(match[1]), minute = Number(match[2])
  if (hour > 23 || minute > 59) throw new Error('Hora invàlida')
  return hour * 60 + minute
}

export function slotMinutes(slot: string): [number, number] {
  const parts = slot.split('-')
  if (parts.length !== 2) throw new Error('Franja invàlida')
  const start = timeMinutes(parts[0].trim()), end = timeMinutes(parts[1].trim())
  if (end <= start) throw new Error('La franja ha d’acabar després de començar.')
  return [start, end]
}

export function overlaps(a: string, b: string): boolean {
  const [a0, a1] = slotMinutes(a), [b0, b1] = slotMinutes(b)
  return a0 < b1 && b0 < a1
}

/**
 * Si un dia té classe. Es fa servir aquí per calcular les dates de la circular.
 * Nota: `src/modules/excursions/excursions.utils.ts` té la seva pròpia còpia,
 * que s'usa a `ExcursioForm`. Les dues usuen fórmules equivalents (sama dia de
 * la setmana en tots els casos provats), però són independents. Qui canviï una
 * ha de mirar l'altra.
 */
export function esDiaLectiu(iso: string, diesNoLectius: string[]): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const dia = new Date(`${iso}T00:00:00Z`).getUTCDay()
  if (Number.isNaN(dia)) return false
  if (dia === 0 || dia === 6) return false
  return !diesNoLectius.includes(iso)
}
