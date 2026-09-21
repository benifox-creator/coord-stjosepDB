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

/**
 * Torna a la cua el que ha fallat i també el que es va cancel·lar: la fila
 * cancel·lada ocupa la clau de l'esdeveniment, i sense poder desfer-ho aquell
 * avís ja no es podria tornar a encuar mai. Cancel·lar, en canvi, només val
 * per al que encara no ha sortit.
 */
export function potReintentar(n: Notificacio): boolean {
  return n.Estat === 'failed' || n.Estat === 'cancel·lada'
}
export function potCancellar(n: Notificacio): boolean {
  return n.Estat === 'pending' || n.Estat === 'failed'
}

/** Les dues accions acaben igual, però el botó ha de dir què farà. */
export function etiquetaReintent(n: Notificacio): string {
  return n.Estat === 'cancel·lada' ? 'Torna a la cua' : 'Reintenta'
}

/**
 * Si un correu entra dins del rang triat. Els límits són dates (`2026-09-21`)
 * i la data del correu porta hora, així que es compara pel dia i prou: un
 * correu de les set de la tarda del dia «fins a» hi ha de continuar entrant.
 * Un límit buit vol dir que per aquell costat no es filtra.
 */
export function dinsDelRang(iso: string, desDe: string, finsA: string): boolean {
  const dia = iso.slice(0, 10)
  if (dia.length < 10) return true      // una data que no entenem no s'amaga
  if (desDe && dia < desDe) return false
  if (finsA && dia > finsA) return false
  return true
}

/** Data i hora curtes, en el format que fa servir la resta de l'aplicació. */
export function quan(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ca-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
