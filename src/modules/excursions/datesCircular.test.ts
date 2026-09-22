import { describe, it, expect } from 'vitest'
import { esDiaLectiu } from '../../utils/schoolCalendar'
import { proposaDates } from './datesCircular'

// Cap dia marcat a Configuració: així el que es prova és només la regla dels
// caps de setmana. Quan un test necessita festius, se'ls passa ell mateix.
const CAP_DE_FESTIUS: string[] = []

/** Totes les dates d'un interval, tancat pels dos extrems. */
function interval(desDe: string, finsA: string): string[] {
  const dates: string[] = []
  const fi = new Date(`${finsA}T00:00:00Z`)
  for (const d = new Date(`${desDe}T00:00:00Z`); d <= fi; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

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

  it('la circular tampoc surt en cap de setmana', () => {
    // Amb els quinze dies de sèrie, la resta cau sempre al mateix dia de la
    // setmana que la sortida menys un: **tota** excursió de dilluns proposava
    // un diumenge, i la circular sortia datada en diumenge.
    expect(proposaDates('2026-11-16', CAP_DE_FESTIUS).circular).toBe('2026-10-30')  // el 1 era diumenge
    expect(proposaDates('2026-10-19', CAP_DE_FESTIUS).circular).toBe('2026-10-02')  // el 4 era diumenge
  })

  it('i si els dies lectius anteriors són festius, segueix enrere', () => {
    // 2027-01-11 menys quinze dies és el 27 de desembre: diumenge i, a més, al
    // mig de les vacances de Nadal.
    expect(proposaDates('2027-01-11', ['2026-12-25', '2026-12-24']).circular).toBe('2026-12-23')
  })

  it('el resguard és l\'endemà lectiu del termini', () => {
    // El spec diu «l'endemà»; es pren com l'endemà **lectiu**, perquè el
    // resguard es lliura al tutor i en dissabte no hi ha ningú.
    const d = proposaDates('2026-11-16', CAP_DE_FESTIUS)
    expect(d.circular).toBe('2026-10-30')   // divendres, no diumenge
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

  it('si la recerca recula 30+ dies sense trobar lectiu, torna cadena buida', () => {
    // Un curs sencer marcat com a no lectiu: cap de les tres dates pot
    // aterrar enlloc. Val més tornar-les buides —i que la pantalla digui
    // «Encara sense data»— que imprimir un festiu a la circular.
    const diesNoLectius = interval('2026-08-15', '2027-01-20')
    const d = proposaDates('2026-11-20', diesNoLectius)
    expect(d.circular).toBe('')
    expect(d.pagament).toBe('')
    expect(d.resguard).toBe('')
  })
})
