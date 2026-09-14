import { describe, it, expect } from 'vitest'
import { diaSetmanaDeData } from './horaris.utils'

describe('diaSetmanaDeData', () => {
  it('retorna el dia de la setmana en català per a un dia feiner', () => {
    // 2026-09-14 és dilluns
    expect(diaSetmanaDeData('2026-09-14')).toBe('Dilluns')
    // 2026-09-18 és divendres
    expect(diaSetmanaDeData('2026-09-18')).toBe('Divendres')
  })

  it('retorna null per a dissabte i diumenge', () => {
    // 2026-09-19 és dissabte, 2026-09-20 és diumenge
    expect(diaSetmanaDeData('2026-09-19')).toBeNull()
    expect(diaSetmanaDeData('2026-09-20')).toBeNull()
  })
})
