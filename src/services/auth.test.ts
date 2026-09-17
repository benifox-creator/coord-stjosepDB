import { describe, it, expect } from 'vitest'
import { motiuRebuig } from './auth'

describe('motiu de rebuig d’un inici de sessió', () => {
  it('accepta un compte del centre', () => {
    expect(motiuRebuig('amoreno@stjosep.org')).toBeNull()
    expect(motiuRebuig('  Prova1@StJosep.ORG  ')).toBeNull()
  })

  it('rebutja un compte d’un altre domini', () => {
    expect(motiuRebuig('algu@gmail.com')).toBe('domini-no-autoritzat')
    expect(motiuRebuig('algu@stjosep.org.altre.com')).toBe('domini-no-autoritzat')
  })

  it('distingeix un correu que no s’ha pogut llegir d’un correu d’un altre domini', () => {
    // Abans tots dos donaven "domini-no-autoritzat": a qui entrava per primer
    // cop amb un compte donat d'alta per avançat se li deia que el seu correu
    // del centre no era del centre.
    for (const buit of ['', '   ']) {
      expect(motiuRebuig(buit)).toBe('correu-no-disponible')
    }
  })
})
