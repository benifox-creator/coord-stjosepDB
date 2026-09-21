import { describe, it, expect } from 'vitest'
import { CONFIG_DEFAULTS } from '../../../store/configStore'
import { textosCircular } from './textos'

describe('textos de la circular', () => {
  it('la devolució del 75 % parla de qui avisa tard, no de qui paga tard', () => {
    // La plantilla antiga ho lligava al pagament fora de termini i no
    // s'entenia. El centre va confirmar que és per a qui avisa a última hora
    // que no ve.
    expect(CONFIG_DEFAULTS['excursions.text-devolucions'][0]).toContain('no assisteix')
    expect(CONFIG_DEFAULTS['excursions.text-devolucions'][0]).toContain('75')
  })

  it('els passos del pagament són una llista, no un paràgraf', () => {
    expect(CONFIG_DEFAULTS['excursions.passos-pagament'].length).toBeGreaterThan(1)
  })

  it('els llegeix de la configuració quan n’hi ha', () => {
    const t = textosCircular({ 'excursions.text-ampa': ['L’AMPA hi col·labora amb 4 €.'] })
    expect(t.ampa).toBe('L’AMPA hi col·labora amb 4 €.')
  })

  it('i si no n’hi ha, fa servir els de sèrie', () => {
    const t = textosCircular({})
    expect(t.devolucions).toBe(CONFIG_DEFAULTS['excursions.text-devolucions'][0])
    expect(t.passosPagament.length).toBeGreaterThan(1)
  })
})
