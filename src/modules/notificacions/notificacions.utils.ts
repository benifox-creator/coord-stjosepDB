import type { Notificacio, EstatNotificacio } from './types'

export const TAULA_NOTIFICACIONS = 'notifications'

export interface NotificacioRow {
  id: string
  status: string
  recipient: string
  subject: string
  body: string
  attempts: number
  last_error: string | null
  created_at: string
  sent_at: string | null
  next_attempt_at: string | null
  created_by: string
}

export function rowToNotificacio(r: NotificacioRow): Notificacio {
  return {
    id: r.id, Estat: r.status as EstatNotificacio, Destinatari: r.recipient,
    Assumpte: r.subject, Cos: r.body, Intents: r.attempts, UltimError: r.last_error,
    CreatEl: r.created_at, EnviatEl: r.sent_at, ProperIntent: r.next_attempt_at,
    CreatPer: r.created_by,
  }
}

/** Només es pot reintentar el que ha fallat; cancel·lar, el que encara no ha sortit. */
export function potReintentar(n: Notificacio): boolean {
  return n.Estat === 'failed'
}
export function potCancellar(n: Notificacio): boolean {
  return n.Estat === 'pending' || n.Estat === 'failed'
}

/** Data i hora curtes, en el format que fa servir la resta de l'aplicació. */
export function quan(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ca-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
