import { describe, it, expect } from 'vitest'
import { codiError, missatgeErrorLogin } from './login.utils'

describe('codi d’un error d’inici de sessió', () => {
  it('fa servir el codi de Firebase quan n’hi ha', () => {
    expect(codiError({ code: 'auth/account-exists-with-different-credential' }))
      .toBe('auth/account-exists-with-different-credential')
  })

  it('prefereix el codi al missatge, que sol ser més llarg i menys útil', () => {
    const err = Object.assign(new Error('Firebase: Error (auth/popup-blocked).'), { code: 'auth/popup-blocked' })
    expect(codiError(err)).toBe('auth/popup-blocked')
  })

  it('cau al missatge quan l’error no porta codi', () => {
    expect(codiError(new Error('network request failed'))).toBe('network request failed')
  })

  it('no es queda en blanc amb un error buit, null o d’un tipus inesperat', () => {
    for (const cas of [null, undefined, '', {}, { code: '   ' }, new Error('')]) {
      expect(codiError(cas)).toBe('desconegut')
    }
  })

  it('posa el codi al missatge que veu qui no ha pogut entrar', () => {
    expect(missatgeErrorLogin({ code: 'auth/popup-closed-by-user' }))
      .toContain('(codi: auth/popup-closed-by-user)')
  })
})
