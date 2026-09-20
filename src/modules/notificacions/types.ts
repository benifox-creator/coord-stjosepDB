export const ESTATS_NOTIFICACIO = ['pending', 'sending', 'sent', 'failed', 'cancel·lada'] as const
export type EstatNotificacio = typeof ESTATS_NOTIFICACIO[number]

export const ESTAT_LABELS: Record<EstatNotificacio, string> = {
  'pending': 'Pendent',
  'sending': 'Enviant-se',
  'sent': 'Enviat',
  'failed': 'Ha fallat',
  'cancel·lada': 'Cancel·lada',
}

export const ESTAT_COLORS: Record<EstatNotificacio, string> = {
  'pending': 'bg-amber-100 text-amber-800',
  'sending': 'bg-blue-100 text-blue-800',
  'sent': 'bg-green-100 text-green-800',
  'failed': 'bg-red-100 text-red-700',
  'cancel·lada': 'bg-gray-100 text-gray-500',
}

export interface Notificacio {
  id: string
  Estat: EstatNotificacio
  Destinatari: string
  Assumpte: string
  Cos: string
  Intents: number
  UltimError: string | null
  CreatEl: string
  EnviatEl: string | null
  ProperIntent: string | null
  CreatPer: string
}
