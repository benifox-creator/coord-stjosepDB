import { describe, it, expect } from 'vitest'
import { useConfigStore, canAccessModul, MODULS_VISIBILITAT } from './configStore'

describe('configuració de Horaris', () => {
  it('defineix una llista no buida de tipus de no lectiva', () => {
    const valors = useConfigStore.getState().getValues('horaris.tipus-no-lectiva')
    expect(valors.length).toBeGreaterThan(0)
    expect(valors).toContain('Guàrdia')
  })

  it('exclou convidat de la visibilitat per defecte de Horaris', () => {
    expect(canAccessModul({}, 'horaris', 'convidat')).toBe(false)
  })

  it('inclou professorat a la visibilitat per defecte de Horaris', () => {
    expect(canAccessModul({}, 'horaris', 'professorat')).toBe(true)
  })

  it('registra Horaris a la llista de mòduls configurables', () => {
    expect(MODULS_VISIBILITAT.some((m) => m.key === 'horaris')).toBe(true)
  })
})
