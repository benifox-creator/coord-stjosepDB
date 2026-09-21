import { describe, it, expect } from 'vitest'
import { esDiaLectiu } from '../../utils/schoolCalendar'
import { proposaDates } from './datesCircular'

// Dijous 20 d'octubre de 2026 no existeix com a festiu; el 2026-10-20 és dimarts.
const CAP_DE_FESTIUS: string[] = []

describe('dia lectiu', () => {
  it('els caps de setmana no ho són', () => {
    expect(esDiaLectiu('2026-09-19', CAP_DE_FESTIUS)).toBe(false)  // dissabte
    expect(esDiaLectiu('2026-09-20', CAP_DE_FESTIUS)).toBe(false)  // diumenge
    expect(esDiaLectiu('2026-09-21', CAP_DE_FESTIUS)).toBe(true)   // dilluns
  })
  it('ni els dies marcats a Configuració', () => {
    expect(esDiaLectiu('2026-09-21', ['2026-09-21'])).toBe(false)
  })
  it('una data que no s\'entén no es dona per lectiva', () => {
    // Val més no proposar cap data que proposar-ne una inventada.
    expect(esDiaLectiu('ahir', CAP_DE_FESTIUS)).toBe(false)
  })
})

describe('proposar les dates de la circular', () => {
  it('la circular surt quinze dies abans', () => {
    // 2026-11-18 és dimecres; quinze dies abans és el 3 de novembre.
    expect(proposaDates('2026-11-18', CAP_DE_FESTIUS).circular).toBe('2026-11-03')
  })

  it('el termini de pagament, vuit dies abans si és lectiu', () => {
    expect(proposaDates('2026-11-18', CAP_DE_FESTIUS).pagament).toBe('2026-11-10')
  })

  it('i si cau en dissabte, es mou al dia lectiu anterior', () => {
    // 2026-11-21 és dissabte; vuit dies abans és el 13, divendres. Provem-ne
    // un que caigui malament: 2026-11-16 (dilluns) − 8 = 2026-11-08, diumenge.
    expect(proposaDates('2026-11-16', CAP_DE_FESTIUS).pagament).toBe('2026-11-06')
  })

  it('i si el dia lectiu anterior és festiu, segueix enrere', () => {
    expect(proposaDates('2026-11-16', ['2026-11-06', '2026-11-05']).pagament).toBe('2026-11-04')
  })

  it('el resguard és l\'endemà lectiu del termini', () => {
    // El spec diu «l'endemà»; es pren com l'endemà **lectiu**, perquè el
    // resguard es lliura al tutor i en dissabte no hi ha ningú.
    const d = proposaDates('2026-11-16', CAP_DE_FESTIUS)
    expect(d.pagament).toBe('2026-11-06')   // divendres
    expect(d.resguard).toBe('2026-11-09')   // dilluns, no dissabte
  })

  it('els dies configurables es respecten', () => {
    const d = proposaDates('2026-11-18', CAP_DE_FESTIUS, 20, 10)
    expect(d.circular).toBe('2026-10-29')
    expect(d.pagament).toBe('2026-11-06')   // el 8 és diumenge → divendres 6
  })

  it('sense data d\'excursió no s\'inventa res', () => {
    expect(proposaDates('', CAP_DE_FESTIUS)).toEqual({ circular: '', pagament: '', resguard: '' })
  })
})
