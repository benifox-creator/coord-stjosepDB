export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString()
}

export function calcularDiesOberts(marcaDeTemps: string, dataResolucio: string): string {
  const inici = new Date(marcaDeTemps)
  const fi = dataResolucio ? new Date(dataResolucio) : new Date()
  if (isNaN(inici.getTime())) return ''
  const dies = Math.floor((fi.getTime() - inici.getTime()) / (1000 * 60 * 60 * 24))
  return String(Math.max(0, dies))
}

export function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDatetime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('ca-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
