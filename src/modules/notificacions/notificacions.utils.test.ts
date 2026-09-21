import { describe, it, expect } from 'vitest'
import { potReintentar, potCancellar, etiquetaReintent, dinsDelRang, quan, rowToNotificacio } from './notificacions.utils'
import type { Notificacio } from './types'

const base: Notificacio = {
  id: 'n1', Estat: 'pending', Destinatari: 'a@stjosep.org', Assumpte: 'Prova', Cos: '',
  Intents: 0, UltimError: null, CreatEl: '2026-09-20T10:00:00Z', EnviatEl: null,
  ProperIntent: null, CreatPer: 'b@stjosep.org',
}

describe('què es pot fer amb una notificació', () => {
  it('torna a la cua el que ha fallat i el que es va cancel·lar', () => {
    expect(potReintentar({ ...base, Estat: 'failed' })).toBe(true)
    // Cancel·lar ha de ser reversible: la fila cancel·lada ocupa la clau de
    // l'esdeveniment, i sense desfer-ho aquell avís ja no es podria tornar
    // a encuar.
    expect(potReintentar({ ...base, Estat: 'cancel·lada' })).toBe(true)
    for (const e of ['pending', 'sending', 'sent'] as const) {
      expect(potReintentar({ ...base, Estat: e }), e).toBe(false)
    }
  })

  it('el botó diu què farà, que no és el mateix en els dos casos', () => {
    expect(etiquetaReintent({ ...base, Estat: 'failed' })).toBe('Reintenta')
    expect(etiquetaReintent({ ...base, Estat: 'cancel·lada' })).toBe('Torna a la cua')
  })

  it('només es cancel·la el que encara no ha sortit', () => {
    expect(potCancellar({ ...base, Estat: 'pending' })).toBe(true)
    expect(potCancellar({ ...base, Estat: 'failed' })).toBe(true)
    // Un correu ja enviat no es pot desfer: cancel·lar-lo seria mentir.
    expect(potCancellar({ ...base, Estat: 'sent' })).toBe(false)
    expect(potCancellar({ ...base, Estat: 'sending' })).toBe(false)
  })
})

describe('filtrar per dates', () => {
  const correu = '2026-09-21T19:30:00Z'

  it('sense límits, no filtra res', () => {
    expect(dinsDelRang(correu, '', '')).toBe(true)
  })

  it('inclou els dos extrems', () => {
    // Un correu del mateix dia «fins a» hi ha d'entrar encara que sigui de les
    // set de la tarda: qui escriu una data pensa en el dia sencer, no en la
    // mitjanit.
    expect(dinsDelRang(correu, '2026-09-21', '2026-09-21')).toBe(true)
  })

  it('deixa fora el que queda abans o després', () => {
    expect(dinsDelRang(correu, '2026-09-22', '')).toBe(false)
    expect(dinsDelRang(correu, '', '2026-09-20')).toBe(false)
  })

  it('cada límit funciona sol', () => {
    expect(dinsDelRang(correu, '2026-09-01', '')).toBe(true)
    expect(dinsDelRang(correu, '', '2026-12-31')).toBe(true)
  })

  it('una data que no s’entén no s’amaga', () => {
    // Val més ensenyar un correu amb la data rara que fer-lo desaparèixer
    // de la pantalla sense que ningú sàpiga que hi era.
    expect(dinsDelRang('', '2026-09-01', '2026-09-30')).toBe(true)
    expect(dinsDelRang('ahir', '2026-09-01', '2026-09-30')).toBe(true)
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
