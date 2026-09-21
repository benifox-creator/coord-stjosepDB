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

  it('rebutja dates que no existeixen (2026-02-30)', () => {
    // JavaScript roda 2026-02-30 cap a 2026-03-02 en silenci. Rebutjar-la.
    expect(proposaDates('2026-02-30', CAP_DE_FESTIUS)).toEqual({ circular: '', pagament: '', resguard: '' })
  })

  it('rebutja dates amb mes invàlid (2026-13-01)', () => {
    expect(proposaDates('2026-13-01', CAP_DE_FESTIUS)).toEqual({ circular: '', pagament: '', resguard: '' })
  })

  it('si la recerca puja 30+ dies sense trobar lectiu, torna cadena buida', () => {
    // 30+ dies consecutius sense classe. Trip on 2026-11-20, payment on 2026-11-12.
    // Search backward from Nov 12 for up to 30 days would land around Oct 13.
    // Mark August through October and November through January as non-teaching.
    const diesNoLectius = [
      // August 2026: 15-31
      '2026-08-15', '2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19',
      '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23', '2026-08-24',
      '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29',
      '2026-08-30', '2026-08-31',
      // September 2026: 1-30
      '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05',
      '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10',
      '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15',
      '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20',
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25',
      '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30',
      // October 2026: 1-31
      '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05',
      '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10',
      '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15',
      '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20',
      '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25',
      '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30',
      '2026-10-31',
      // November 2026: 1-30
      '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05',
      '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10',
      '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
      '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20',
      '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25',
      '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30',
      // December 2026: 1-31
      '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05',
      '2026-12-06', '2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10',
      '2026-12-11', '2026-12-12', '2026-12-13', '2026-12-14', '2026-12-15',
      '2026-12-16', '2026-12-17', '2026-12-18', '2026-12-19', '2026-12-20',
      '2026-12-21', '2026-12-22', '2026-12-23', '2026-12-24', '2026-12-25',
      '2026-12-26', '2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30',
      '2026-12-31',
      // January 2027: 1-20
      '2027-01-01', '2027-01-02', '2027-01-03', '2027-01-04', '2027-01-05',
      '2027-01-06', '2027-01-07', '2027-01-08', '2027-01-09', '2027-01-10',
      '2027-01-11', '2027-01-12', '2027-01-13', '2027-01-14', '2027-01-15',
      '2027-01-16', '2027-01-17', '2027-01-18', '2027-01-19', '2027-01-20',
    ]
    const d = proposaDates('2026-11-20', diesNoLectius)
    expect(d.pagament).toBe('')
    expect(d.resguard).toBe('')
  })
})
