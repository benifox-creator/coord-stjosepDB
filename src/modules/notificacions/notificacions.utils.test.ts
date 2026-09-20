import { describe, it, expect } from 'vitest'
import { potReintentar, potCancellar, quan, rowToNotificacio } from './notificacions.utils'
import type { Notificacio } from './types'

const base: Notificacio = {
  id: 'n1', Estat: 'pending', Destinatari: 'a@stjosep.org', Assumpte: 'Prova', Cos: '',
  Intents: 0, UltimError: null, CreatEl: '2026-09-20T10:00:00Z', EnviatEl: null,
  ProperIntent: null, CreatPer: 'b@stjosep.org',
}

describe('què es pot fer amb una notificació', () => {
  it('només es reintenta el que ha fallat', () => {
    expect(potReintentar({ ...base, Estat: 'failed' })).toBe(true)
    for (const e of ['pending', 'sending', 'sent', 'cancel·lada'] as const) {
      expect(potReintentar({ ...base, Estat: e }), e).toBe(false)
    }
  })

  it('només es cancel·la el que encara no ha sortit', () => {
    expect(potCancellar({ ...base, Estat: 'pending' })).toBe(true)
    expect(potCancellar({ ...base, Estat: 'failed' })).toBe(true)
    // Un correu ja enviat no es pot desfer: cancel·lar-lo seria mentir.
    expect(potCancellar({ ...base, Estat: 'sent' })).toBe(false)
    expect(potCancellar({ ...base, Estat: 'sending' })).toBe(false)
  })
})

describe('format de data', () => {
  it('no ensenya res quan no hi ha data', () => {
    expect(quan(null)).toBe('—')
  })
  it('no peta amb una data impossible', () => {
    expect(quan('això no és una data')).toBe('—')
  })
  it('escurça una data real', () => {
    expect(quan('2026-09-20T10:00:00Z')).toMatch(/20\/09/)
  })
})

describe('conversió de la fila', () => {
  it('tradueix els noms de columna als del mòdul', () => {
    const n = rowToNotificacio({
      id: 'n1', status: 'failed', recipient: 'a@stjosep.org', subject: 'Assumpte', body: 'Cos',
      attempts: 3, last_error: 'SMTP 550', created_at: '2026-09-20T10:00:00Z',
      sent_at: null, next_attempt_at: null, created_by: 'b@stjosep.org',
    })
    expect(n.Estat).toBe('failed')
    expect(n.Intents).toBe(3)
    expect(n.UltimError).toBe('SMTP 550')
  })
})
