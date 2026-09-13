import { describe, it, expect } from 'vitest'
import { calcularHores, durataFranja, duradaPeriodes } from './absencies.utils'
import type { PeriodeAbsencia } from './types'

describe('calcularHores', () => {
  it('calcula la diferència en hores entre dues hores vàlides', () => {
    expect(calcularHores('9:00', '10:00')).toBe(1)
  })

  it('arrodoneix a dos decimals', () => {
    expect(calcularHores('8:00', '9:24')).toBe(1.4)
  })

  it('retorna 0 si la hora de fi és anterior o igual a la d\'inici', () => {
    expect(calcularHores('10:00', '9:00')).toBe(0)
    expect(calcularHores('9:00', '9:00')).toBe(0)
  })

  it('retorna 0 amb entrades invàlides', () => {
    expect(calcularHores('', '10:00')).toBe(0)
    expect(calcularHores('9:00', '')).toBe(0)
  })
})

describe('durataFranja', () => {
  it('calcula la durada d\'una franja "HH:MM-HH:MM"', () => {
    expect(durataFranja('9:00-10:00')).toBe(1)
    expect(durataFranja('12:30-13:24')).toBe(0.9)
  })
})

describe('duradaPeriodes', () => {
  const periodes: PeriodeAbsencia[] = [
    { Franja: '9:00-10:00', Etapa: 'EP', Tipus: 'Lectiva', Grup: 'EP-1r A', Materia: 'Mates' },
    { Franja: '10:00-11:00', Etapa: 'EP', Tipus: 'No lectiva', Grup: '', Materia: 'Pati' },
  ]

  it('suma la durada de tots els períodes si no es filtra per tipus', () => {
    expect(duradaPeriodes(periodes)).toBe(2)
  })

  it('suma només els períodes del tipus indicat', () => {
    expect(duradaPeriodes(periodes, 'Lectiva')).toBe(1)
    expect(duradaPeriodes(periodes, 'No lectiva')).toBe(1)
  })

  it('retorna 0 amb una llista buida', () => {
    expect(duradaPeriodes([])).toBe(0)
  })
})
