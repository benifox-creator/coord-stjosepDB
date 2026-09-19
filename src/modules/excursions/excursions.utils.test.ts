import { describe, it, expect } from 'vitest'
import { campsQueFalten, esDiaLectiu, dataTrasladada } from './excursions.utils'
import type { ExcursioFormData } from './types'

const completa: ExcursioFormData = {
  Etapa: 'EP', Lloc: 'Can Montcau', Poblacio: 'La Roca', Activitat: 'La Castanyada',
  Data: '2026-10-19', HoraSortida: '9:00', HoraTornada: '17:00',
  Transport: 'autocar', TransportDetall: '', AcompanyantsExterns: 0,
  Observacions: '', Responsable: 'teacher@stjosep.org',
  Grups: [{ Grup: 'EP-1r A', AlumnesPrevistos: 25 }], Acompanyants: [],
}

describe('què falta per enviar una proposta', () => {
  it('no troba res a faltar en una proposta completa', () => {
    expect(campsQueFalten(completa)).toEqual([])
  })

  it('reclama els camps buits pel seu nom', () => {
    const falten = campsQueFalten({ ...completa, Lloc: '  ', Activitat: '', Data: '' })
    expect(falten).toContain('el lloc')
    expect(falten).toContain("l'activitat")
    expect(falten).toContain('la data')
  })

  it('no dona per bo un camp que només té espais', () => {
    expect(campsQueFalten({ ...completa, Activitat: '   ' })).toContain("l'activitat")
  })

  it('no dona per bona una hora que només té espais', () => {
    const falten = campsQueFalten({ ...completa, HoraSortida: '   ', HoraTornada: ' ' })
    expect(falten).toContain("l'hora de sortida")
    expect(falten).toContain('l’hora de tornada')
  })

  it('reclama almenys un grup amb alumnes', () => {
    expect(campsQueFalten({ ...completa, Grups: [] })).toContain('almenys un grup amb alumnes')
    expect(campsQueFalten({ ...completa, Grups: [{ Grup: 'EP-1r A', AlumnesPrevistos: 0 }] }))
      .toContain('almenys un grup amb alumnes')
  })

  it('no reclama els acompanyants, que no són obligatoris per proposar', () => {
    expect(campsQueFalten({ ...completa, Acompanyants: [], AcompanyantsExterns: 0 })).toEqual([])
  })

  it('només reclama el detall del transport quan no és autocar', () => {
    expect(campsQueFalten({ ...completa, Transport: 'autocar', TransportDetall: '' })).toEqual([])
    expect(campsQueFalten({ ...completa, Transport: 'altres', TransportDetall: '' }))
      .toContain('com s’hi va')
    expect(campsQueFalten({ ...completa, Transport: 'altres', TransportDetall: 'metro' })).toEqual([])
  })
})

describe('dia lectiu', () => {
  it('descarta els caps de setmana', () => {
    expect(esDiaLectiu('2026-10-17', [])).toBe(false)   // dissabte
    expect(esDiaLectiu('2026-10-18', [])).toBe(false)   // diumenge
    expect(esDiaLectiu('2026-10-19', [])).toBe(true)    // dilluns
  })

  it('descarta els dies marcats com a no lectius', () => {
    expect(esDiaLectiu('2026-10-19', ['2026-10-19'])).toBe(false)
    expect(esDiaLectiu('2026-10-19', ['2026-10-20'])).toBe(true)
  })

  it('no s’equivoca de dia per la zona horària', () => {
    expect(esDiaLectiu('2026-01-05', [])).toBe(true)    // dilluns
  })

  it('tracta una data buida com a no vàlida', () => {
    expect(esDiaLectiu('', [])).toBe(false)
  })

  it('no dona per lectiva una data impossible', () => {
    // Sense comprovar-ho, getDay() retorna NaN, que no és ni 0 ni 6, i la data
    // passaria per bona.
    expect(esDiaLectiu('2026-13-45', [])).toBe(false)
    expect(esDiaLectiu('aixo-no-es-una-data', [])).toBe(false)
  })
})

describe('traslladar una data al curs nou', () => {
  it('suma els anys de diferència entre els dos cursos', () => {
    expect(dataTrasladada('2025-10-17', '2025-2026', '2026-2027')).toBe('2026-10-17')
    expect(dataTrasladada('2026-03-05', '2025-2026', '2026-2027')).toBe('2027-03-05')
  })

  it('deixa la data buida si no n’hi havia', () => {
    expect(dataTrasladada(null, '2025-2026', '2026-2027')).toBeNull()
  })

  it('no inventa un 29 de febrer', () => {
    expect(dataTrasladada('2024-02-29', '2023-2024', '2024-2025')).toBe('2025-02-28')
  })

  it('manté els dos dígits al mes i al dia', () => {
    expect(dataTrasladada('2025-09-01', '2025-2026', '2026-2027')).toBe('2026-09-01')
  })
})
