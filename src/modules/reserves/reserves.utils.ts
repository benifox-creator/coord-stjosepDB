export function formatDate(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function formatDateTimeISO(date: Date): string {
  return date.toISOString().slice(0, 16).replace('T', ' ')
}

export function formatTime(hhmm: string): string {
  return hhmm || '—'
}

export function isDiaAvui(data: string): boolean {
  return data === formatDateISO(new Date())
}

export function isProxima(data: string, diesEndavant = 7): boolean {
  const avui = new Date()
  avui.setHours(0, 0, 0, 0)
  const fi = new Date(avui)
  fi.setDate(fi.getDate() + diesEndavant)
  const d = new Date(data)
  return d >= avui && d <= fi
}
