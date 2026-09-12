import { describe, it, expect } from 'vitest'
import { calcularHores } from './absencies.utils'

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
