import { describe, it, expect } from 'vitest'
import { useConfigStore, canAccessModul, MODULS_VISIBILITAT, CONFIG_DEFAULTS } from './configStore'

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

describe('els grups del centre', () => {
  const grups = CONFIG_DEFAULTS['substitucions.grups']

  it('segueixen tots el patró ETAPA-nivell, amb línia o sense', () => {
    for (const g of grups) {
      expect(g, g).toMatch(/^(EI|EP|ESO|BATX|CFGM)-\d( [A-C])?$/)
    }
  })

  it('tenen les línies que toquen a cada etapa', () => {
    const linies: Record<string, number> = {}
    for (const g of grups) {
      const nivell = g.includes(' ') ? g.slice(0, g.lastIndexOf(' ')) : g
      linies[nivell] = (linies[nivell] ?? 0) + 1
    }
    for (const [nivell, n] of Object.entries(linies)) {
      const esperades = nivell.startsWith('CFGM') ? 1 : nivell.startsWith('BATX') ? 2 : 3
      expect(n, `${nivell} hauria de tenir ${esperades} línies`).toBe(esperades)
    }
  })

  it('cobreixen els 17 nivells del centre sense repetir cap grup', () => {
    expect(new Set(grups).size).toBe(grups.length)
    expect(grups).toHaveLength(45)
  })
})
