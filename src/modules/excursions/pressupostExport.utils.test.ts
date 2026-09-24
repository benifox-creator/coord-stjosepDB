import { describe, it, expect } from 'vitest'
import {
  pendentsDePressupost, passatgers, capcaleresPressupost, filesPressupost,
} from './pressupostExport.utils'
import { diaSetmana } from './circular/dades'
import type { Excursio } from './types'

function excursio(canvis: Partial<Excursio> = {}): Excursio {
  return {
    id: 'e1', Codi: 'EXC-0001', CursEscolar: '2026-2027', Estat: 'Aprovada', Etapa: 'EP',
    Lloc: 'Can Montcau', Poblacio: 'La Roca', Activitat: 'Visita', Data: '2026-11-18',
    HoraSortida: '09:00', HoraTornada: '13:00', Transport: 'autocar', TransportDetall: '',
    AcompanyantsExterns: 0, Observacions: '', Responsable: 'a@stjosep.org',
    MotiuRebuig: null, MotiuCancellacio: null, ProposadaPer: null, AprovadaPer: null,
    ReservadaPer: null, Creat_per: 'a@stjosep.org', PreuAlumne: null, PreuConfirmatPer: null,
    DataCircular: null, DataLimitPagament: null, DataLimitResguard: null,
    CircularEnviadaPer: null, AmpaCollabora: false,
    Grups: [{ id: 'g1', Grup: 'EP-5è A', AlumnesPrevistos: 25, AlumnesFinals: null, AlumnesPagats: 0 }],
    Acompanyants: ['a@stjosep.org'],
    ...canvis,
  }
}

describe('el dia de la setmana', () => {
  it('surt en català', () => {
    expect(diaSetmana('2026-11-18')).toBe('Dimecres')
  })

  it('una data que no és una data no peta', () => {
    expect(diaSetmana('')).toBe('')
  })
})

describe('qui està pendent de pressupost', () => {
  it('una aprovada amb autocar i sense preus hi és', () => {
    expect(pendentsDePressupost([excursio()], new Set()).map((e) => e.id)).toEqual(['e1'])
  })

  it('una que ja té un autocar amb preu, no', () => {
    expect(pendentsDePressupost([excursio()], new Set(['e1']))).toEqual([])
  })

  it('una cancel·lada, no', () => {
    expect(pendentsDePressupost([excursio({ Estat: 'Cancel·lada' })], new Set())).toEqual([])
  })

  it('un esborrany i una proposta, tampoc: encara no estan aprovades', () => {
    const caps = [excursio({ Estat: 'Esborrany' }), excursio({ Estat: 'Proposada' })]
    expect(pendentsDePressupost(caps, new Set())).toEqual([])
  })

  it('una reservada o amb la circular enviada, sí: el preu pot arribar tard', () => {
    const totes = [excursio({ id: 'r', Estat: 'Reservada' }), excursio({ id: 'c', Estat: 'Circular enviada' })]
    expect(pendentsDePressupost(totes, new Set()).map((e) => e.id)).toEqual(['r', 'c'])
  })

  it('una que no va amb autocar, no: no hi ha res a demanar', () => {
    expect(pendentsDePressupost([excursio({ Transport: 'altres' })], new Set())).toEqual([])
  })

  it('una sense data, tampoc: l’empresa no pot posar-hi preu sense saber quin dia és', () => {
    expect(pendentsDePressupost([excursio({ Data: null })], new Set())).toEqual([])
  })
})

describe('els passatgers', () => {
  it('són els alumnes previstos més els acompanyants', () => {
    // Els acompanyants ocupen seient i l'empresa cobra per vehicle: comptar
    // només els alumnes faria demanar un autocar més petit del que cal.
    const e = excursio({
      Grups: [
        { id: 'g1', Grup: 'EP-5è A', AlumnesPrevistos: 25, AlumnesFinals: null, AlumnesPagats: 0 },
        { id: 'g2', Grup: 'EP-5è B', AlumnesPrevistos: 24, AlumnesFinals: null, AlumnesPagats: 0 },
      ],
      Acompanyants: ['a@stjosep.org', 'b@stjosep.org'],
      AcompanyantsExterns: 1,
    })
    expect(passatgers(e)).toBe(52)
  })
})

describe('les capçaleres', () => {
  const base = ['Codi', 'Data', 'Dia', 'Destinació', 'Població', 'Grups', 'Passatgers', 'Sortida', 'Tornada']

  it('per a l’autocar', () => {
    expect(capcaleresPressupost('autocar')).toEqual([...base, 'Places', 'Preu autocar'])
  })

  it('per a l’activitat', () => {
    // Dues columnes i no una: el full antic del centre no marcava si la xifra
    // era per alumne o un total de grup, i 16 de 44 eren totals.
    expect(capcaleresPressupost('activitat')).toEqual([...base, 'Preu per alumne', 'Preu total del grup'])
  })

  it('per a totes dues', () => {
    expect(capcaleresPressupost('ambdues'))
      .toEqual([...base, 'Places', 'Preu autocar', 'Preu per alumne', 'Preu total del grup'])
  })
})

describe('les files', () => {
  it('porten el que l’empresa necessita per posar-hi preu', () => {
    expect(filesPressupost([excursio()], 'autocar')[0])
      .toEqual(['EXC-0001', '2026-11-18', 'Dimecres', 'Can Montcau', 'La Roca', 'EP-5è A', 26, '09:00', '13:00', '', ''])
  })

  it('les columnes de preu surten buides, tantes com es demanin', () => {
    expect(filesPressupost([excursio()], 'ambdues')[0].slice(-4)).toEqual(['', '', '', ''])
  })

  it('els grups se separen amb comes', () => {
    const e = excursio({
      Grups: [
        { id: 'g1', Grup: 'EP-5è A', AlumnesPrevistos: 25, AlumnesFinals: null, AlumnesPagats: 0 },
        { id: 'g2', Grup: 'EP-5è B', AlumnesPrevistos: 24, AlumnesFinals: null, AlumnesPagats: 0 },
      ],
    })
    expect(filesPressupost([e], 'autocar')[0][5]).toBe('EP-5è A, EP-5è B')
  })

  it('no hi surt cap nom de persona', () => {
    // El fitxer se'n va del centre. Que no hi entri cap nom és el que manté
    // intacte l'expedient de protecció de dades.
    const text = JSON.stringify(filesPressupost([excursio()], 'ambdues'))
    expect(text).not.toContain('@stjosep.org')
    expect(text).not.toContain('Responsable')
  })
})
