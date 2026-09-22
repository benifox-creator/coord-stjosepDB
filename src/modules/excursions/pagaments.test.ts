import { describe, it, expect } from 'vitest'
import { recaptat, totalPagats } from './pagaments'
import type { ExcursioGrup } from './types'

const grup = (pagats: number, previstos = 25): ExcursioGrup =>
  ({ id: `g${pagats}`, Grup: 'EP-1 A', AlumnesPrevistos: previstos, AlumnesFinals: null, AlumnesPagats: pagats })

describe('què s’ha recaptat', () => {
  it('suma els pagaments de tots els grups i multiplica pel preu', () => {
    expect(recaptat([grup(18), grup(20)], 12.5)).toBe(475)
  })

  it('sense preu confirmat no hi ha cap xifra, i no és zero', () => {
    // Zero vol dir que no ha pagat ningú; buit vol dir que encara no se sap
    // quant es cobra. A un panell econòmic, confondre-ho seria ensenyar una
    // pèrdua que no existeix.
    expect(recaptat([grup(18)], null)).toBeNull()
  })

  it('amb el preu a zero, el recaptat és zero', () => {
    expect(recaptat([grup(18)], 0)).toBe(0)
  })

  it('sense grups, zero', () => {
    expect(totalPagats([])).toBe(0)
    expect(recaptat([], 12.5)).toBe(0)
  })

  it('no arrossega errors de coma flotant', () => {
    // 3 × 10,10 en coma flotant fa 30,299999999999997, i això acabaria imprès
    // en un panell que parla de diners.
    expect(recaptat([grup(3)], 10.1)).toBe(30.3)
  })
})
