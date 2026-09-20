import { describe, it, expect } from 'vitest'
import { CONFIG_DEFAULTS } from '../../store/configStore'
import { parametresPreu } from './parametres'

describe('paràmetres del preu de les excursions', () => {
  it('EI i EP esperen que en vinguin més', () => {
    expect(CONFIG_DEFAULTS['excursions.previsio.EI']).toEqual(['0.8'])
    expect(CONFIG_DEFAULTS['excursions.previsio.EP']).toEqual(['0.8'])
    expect(CONFIG_DEFAULTS['excursions.previsio.BATX']).toEqual(['0.75'])
  })

  it('el marge és del 12 % a totes les etapes', () => {
    for (const etapa of ['EI','EP','ESO 1r-2n','ESO 3r-4t','BATX','GM']) {
      expect(CONFIG_DEFAULTS[`excursions.marge-pct.${etapa}`], etapa).toEqual(['12'])
    }
  })

  it('els llegeix com a números', () => {
    expect(parametresPreu({}, 'EP')).toEqual({ previsio: 0.8, margePct: 12, ivaPct: 10, arrodoniment: 0.5 })
  })

  it('un valor desat guanya el valor per defecte', () => {
    expect(parametresPreu({ 'excursions.marge-pct.EP': ['8'] }, 'EP').margePct).toBe(8)
  })

  it('un valor escrit malament no deixa el preu en NaN', () => {
    // Si algú desa "dotze" al camp del marge, val més cobrar el 12 % de sempre
    // que ensenyar un preu que no és un número.
    expect(parametresPreu({ 'excursions.marge-pct.EP': ['dotze'] }, 'EP').margePct).toBe(12)
  })

  it('una etapa que no existeix no peta', () => {
    expect(Number.isFinite(parametresPreu({}, 'INVENTADA').previsio)).toBe(true)
  })
})
