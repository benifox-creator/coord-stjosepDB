export function formatDateISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function formatDateTimeISO(d: Date): string {
  return d.toISOString()
}

export function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function isOverdue(dataLimit: string): boolean {
  if (!dataLimit) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dataLimit + 'T00:00:00') < today
}

export function progressPercent(tasques: { Estat: string }[]): number {
  if (tasques.length === 0) return 0
  const completades = tasques.filter((t) => t.Estat === 'Completada').length
  return Math.round((completades / tasques.length) * 100)
}
