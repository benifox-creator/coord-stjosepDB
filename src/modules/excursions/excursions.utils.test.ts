import { describe, it, expect } from 'vitest'
import { campsQueFalten, esDiaLectiu, dataTrasladada, grupsTriables, formDataDe, nivellsDeGrups, grupsDelNivell, rowToExcursio, type ExcursioRow } from './excursions.utils'
import type { Excursio, ExcursioFormData } from './types'

// Fila mínima tal com la torna Supabase, per a les proves de rowToExcursio.
// No hi havia cap fixture de fila (a diferència de `excursioDesada`, que ja
// és el resultat convertit): se n'ha creat una de nova amb aquest nom.
const filaBuida: ExcursioRow = {
  id: 'e1', codi: 'EXC-001', curs_escolar: '2026-2027', estat: 'Esborrany', etapa: 'EP',
  lloc: 'Can Montcau', poblacio: 'La Roca', activitat: 'Castanyada', data: '2026-10-19',
  hora_sortida: '9:00', hora_tornada: '17:00', transport: 'autocar', transport_detall: '',
  acompanyants_externs: 0, observacions: '', responsable: 'a@stjosep.org',
  motiu_rebuig: null, motiu_cancellacio: null, proposada_per: null,
  aprovada_per: null, reservada_per: null, creat_per: 'a@stjosep.org',
  preu_alumne: null, preu_confirmat_per: null,
  data_circular: null, data_limit_pagament: null, data_limit_resguard: null,
  circular_enviada_per: null, ampa_collabora: false,
}

const excursioDesada: Excursio = {
  id: 'e1', Codi: 'EXC-001', CursEscolar: '2026-2027', Estat: 'Esborrany', Etapa: 'EP',
  Lloc: 'Can Montcau', Poblacio: 'La Roca', Activitat: 'Castanyada', Data: '2026-10-19',
  HoraSortida: '9:00', HoraTornada: '17:00', Transport: 'autocar', TransportDetall: '',
  AcompanyantsExterns: 0, Observacions: '', Responsable: 'a@stjosep.org',
  MotiuRebuig: null, MotiuCancellacio: null, ProposadaPer: null,
  AprovadaPer: null, ReservadaPer: null, Creat_per: 'a@stjosep.org',
  PreuAlumne: null, PreuConfirmatPer: null,
  DataCircular: null, DataLimitPagament: null, DataLimitResguard: null,
  CircularEnviadaPer: null, AmpaCollabora: false,
  Grups: [{ id: 'g1', Grup: 'EP-1r A', AlumnesPrevistos: 25, AlumnesFinals: null }],
  Acompanyants: [],
}

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

describe('opcions de grup triables', () => {
  const tots = ['EP-1r A', 'EP-1r B', 'EP-2n A']

  it('amaga els grups que ja ha agafat una altra fila', () => {
    expect(grupsTriables(tots, ['EP-1r A'], '')).toEqual(['EP-1r B', 'EP-2n A'])
  })

  it('manté visible el grup de la fila que s’està editant', () => {
    expect(grupsTriables(tots, ['EP-1r A', 'EP-2n A'], 'EP-1r A')).toEqual(['EP-1r A', 'EP-1r B'])
  })

  it('els ofereix tots quan encara no se n’ha triat cap', () => {
    expect(grupsTriables(tots, [], '')).toEqual(tots)
  })
})

describe('valors inicials del formulari', () => {
  it('posa qui l’omple com a responsable en una de nova', () => {
    const d = formDataDe(undefined, 'jo@stjosep.org')
    expect(d.Responsable).toBe('jo@stjosep.org')
    expect(d.Grups).toHaveLength(1)
    expect(d.Data).toBe('')
  })

  it('converteix una data buida en cadena i no en null', () => {
    const d = formDataDe({ ...excursioDesada, Data: null }, 'jo@stjosep.org')
    expect(d.Data).toBe('')
  })

  it('deixa sempre una fila de grup encara que l’excursió no en tingui cap', () => {
    const d = formDataDe({ ...excursioDesada, Grups: [] }, 'jo@stjosep.org')
    expect(d.Grups).toEqual([{ Grup: '', AlumnesPrevistos: 0 }])
  })

  it('no comparteix la llista d’acompanyants amb l’excursió original', () => {
    const original = { ...excursioDesada, Acompanyants: ['a@stjosep.org'] }
    const d = formDataDe(original, 'jo@stjosep.org')
    d.Acompanyants.push('b@stjosep.org')
    expect(original.Acompanyants).toEqual(['a@stjosep.org'])
  })
})

describe('rowToExcursio', () => {
  it('converteix el preu a número, que PostgreSQL el torna com a text', () => {
    // `numeric` arriba com a cadena. Sense convertir-lo, 12.50 + 12.50 faria
    // "12.5012.50" i el total de la pantalla seria absurd.
    const e = rowToExcursio({ ...filaBuida, preu_alumne: '12.50', preu_confirmat_per: 'a@stjosep.org' })
    expect(e.PreuAlumne).toBe(12.5)
    expect(e.PreuConfirmatPer).toBe('a@stjosep.org')
  })

  it('una excursió sense preu confirmat el deixa buit, no a zero', () => {
    // Zero vol dir "gratuïta"; buit vol dir "encara no s'ha decidit".
    // Confondre-ho faria que la fitxa digués que una excursió no costa res.
    const e = rowToExcursio({ ...filaBuida, preu_alumne: null, preu_confirmat_per: null })
    expect(e.PreuAlumne).toBeNull()
  })

  it('una excursió gratuïta manté el preu a zero, no el confon amb "no decidit"', () => {
    // Una condició com `r.preu_alumne ? Number(...) : null` passaria les dues
    // proves de dalt igualment, però convertiria un 0 (gratuïta) en null (no
    // decidit): exactament la confusió que aquest camp ha d'evitar.
    // PostgreSQL sempre l'envia com a cadena, però es comprova també com a
    // número per si mai arriba ja convertit.
    expect(rowToExcursio({ ...filaBuida, preu_alumne: '0', preu_confirmat_per: 'a@stjosep.org' }).PreuAlumne).toBe(0)
    expect(rowToExcursio({ ...filaBuida, preu_alumne: 0, preu_confirmat_per: 'a@stjosep.org' }).PreuAlumne).toBe(0)
  })
})

describe('nivells i línies', () => {
  const grups = [
    'I3 A', 'I3 B', 'EP-1r A', 'EP-1r B', 'EP-1r C',
    '1r ESO A', '1r ESO B', 'GM',
  ]

  it('treu els nivells sense repetir-los i en l’ordre de la llista', () => {
    expect(nivellsDeGrups(grups)).toEqual(['I3', 'EP-1r', '1r ESO', 'GM'])
  })

  it('dona totes les línies d’un nivell', () => {
    expect(grupsDelNivell(grups, 'EP-1r')).toEqual(['EP-1r A', 'EP-1r B', 'EP-1r C'])
  })

  it('tracta un grup sense línia com un nivell d’una sola classe', () => {
    expect(grupsDelNivell(grups, 'GM')).toEqual(['GM'])
  })

  it('no confon un nivell amb un altre que comenci igual', () => {
    const amb = ['EP-1r A', 'EP-1r B', 'EP-10è A']
    expect(grupsDelNivell(amb, 'EP-1r')).toEqual(['EP-1r A', 'EP-1r B'])
  })

  it('no parteix noms que acaben en una paraula i no en una lletra solta', () => {
    expect(nivellsDeGrups(['Aula Oberta', 'GM'])).toEqual(['Aula Oberta', 'GM'])
  })
})
