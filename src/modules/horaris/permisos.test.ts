import { describe, it, expect } from 'vitest'
import { potVeureTotHorari } from './permisos'
import type { Rol } from '../usuaris/types'

describe('potVeureTotHorari', () => {
  it('permet veure tots els horaris a coordinador, direccio, titular i cap_estudis', () => {
    const rolsAmbAcces: Rol[] = ['coordinador', 'direccio', 'titular', 'cap_estudis']
    for (const rol of rolsAmbAcces) {
      expect(potVeureTotHorari(rol)).toBe(true)
    }
  })

  it('no permet veure tots els horaris a professorat, convidat ni null', () => {
    expect(potVeureTotHorari('professorat')).toBe(false)
    expect(potVeureTotHorari('convidat')).toBe(false)
    expect(potVeureTotHorari(null)).toBe(false)
  })
})
