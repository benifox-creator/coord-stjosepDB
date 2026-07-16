export function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function garantiaEstat(garantiaFins: string): 'vigent' | 'caducada' | 'desconegut' {
  if (!garantiaFins) return 'desconegut'
  const fi = new Date(garantiaFins)
  if (isNaN(fi.getTime())) return 'desconegut'
  return fi >= new Date() ? 'vigent' : 'caducada'
}
