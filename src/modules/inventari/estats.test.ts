import { describe, it, expect } from 'vitest'
import { ESTATS_INVENTARI, esAvariat } from './estats'

describe('estats de l’inventari', () => {
  it('són exactament els nou que admet la base de dades, en aquest ordre', () => {
    expect(ESTATS_INVENTARI).toEqual([
      'Actiu', 'Avariat', 'En reparació', 'En préstec', 'En proves',
      'No desplegat', 'Retirat temporalment', 'De baixa', 'Robat',
    ])
  })

  it('compta com a avariat el que s’ha d’arreglar', () => {
    expect(esAvariat('Avariat')).toBe(true)
    expect(esAvariat('En reparació')).toBe(true)
  })

  it('no compta com a avariat cap altre estat', () => {
    for (const e of ['Actiu', 'En préstec', 'En proves', 'No desplegat', 'Retirat temporalment', 'De baixa', 'Robat'] as const) {
      expect(esAvariat(e)).toBe(false)
    }
  })
})
