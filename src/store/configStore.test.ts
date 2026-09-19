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

describe('configuració d’Excursions', () => {
  it('exclou convidat de la visibilitat per defecte', () => {
    // Ha de coincidir amb el valor per defecte del servidor a
    // `app_private.module_visible`: si divergissin, el menú ensenyaria un
    // mòdul que després la base de dades denega.
    expect(canAccessModul({}, 'excursions', 'convidat')).toBe(false)
  })

  it('inclou professorat, direcció, titular i cap d’estudis', () => {
    for (const rol of ['professorat', 'direccio', 'titular', 'cap_estudis']) {
      expect(canAccessModul({}, 'excursions', rol), rol).toBe(true)
    }
  })

  it('deixa passar el coordinador encara que la llista no l’inclogui', () => {
    expect(canAccessModul({ 'visibilitat.excursions': [] }, 'excursions', 'coordinador')).toBe(true)
  })

  it('respecta una llista buida desada per a la resta de rols', () => {
    expect(canAccessModul({ 'visibilitat.excursions': [] }, 'excursions', 'professorat')).toBe(false)
  })

  it('registra Excursions a la llista de mòduls configurables', () => {
    expect(MODULS_VISIBILITAT.map((m) => m.key)).toContain('excursions')
  })
})
