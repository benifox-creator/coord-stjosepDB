import { describe, it, expect } from 'vitest'
import { dataLlarga, dadesCircular } from './dades'
import type { Excursio } from '../types'

const textos = { pagamentIntro: 'a', passosPagament: ['b'], ampa: 'c', devolucions: 'd', resguard: 'e' }
const excursio = {
  Codi: 'EXC-002', CursEscolar: '2026-2027', Etapa: 'EP', Lloc: 'Can Montcau',
  Poblacio: 'La Roca del Vallès', Activitat: 'Visita a la granja',
  Data: '2026-11-18', HoraSortida: '09:15', HoraTornada: '17:00',
  PreuAlumne: 31, AmpaCollabora: false, Grups: [{ id: 'g1', Grup: 'EP-1 A', AlumnesPrevistos: 25, AlumnesFinals: null }],
} as unknown as Excursio

describe('la data en format de circular', () => {
  it('va en català i apostrofada davant de vocal', () => {
    // «de octubre» en un paper que arriba a les famílies es llegeix com una
    // falta. El servidor ja ho fa així per als correus; aquí hi ha d'haver
    // el mateix criteri.
    expect(dataLlarga('2026-10-20')).toBe("Dimarts, 20 d'octubre de 2026")
    expect(dataLlarga('2026-11-18')).toBe('Dimecres, 18 de novembre de 2026')
  })
  it('no peta amb una data buida', () => {
    expect(dataLlarga('')).toBe('')
  })
})

describe('muntar les dades de la circular', () => {
  const dates = { circular: '2026-11-03', pagament: '2026-11-06', resguard: '2026-11-09' }

  it('el preu va amb coma i amb euro', () => {
    const d = dadesCircular(excursio, dates, textos, '')
    expect(d.preu).toBe('31,00 €')
  })

  it('les hores porten la h que la gent espera', () => {
    const d = dadesCircular(excursio, dates, textos, '')
    expect(d.sortida).toBe('9:15 h')
    expect(d.tornada).toBe('17:00 h')
  })

  it('el curs surt dels grups, no de l’etapa', () => {
    // L'etapa és «EP»; a la circular la família ha de llegir el curs del seu
    // fill, que és el que hi ha als grups.
    const d = dadesCircular(excursio, dates, textos, '')
    expect(d.curs).toBe('EP-1 A')
  })

  it('amb dos grups, els uneix amb «i»', () => {
    const e = { ...excursio, Grups: [
      { id:'g1', Grup:'EP-1 A', AlumnesPrevistos:25, AlumnesFinals:null },
      { id:'g2', Grup:'EP-1 B', AlumnesPrevistos:24, AlumnesFinals:null },
    ] } as unknown as Excursio
    expect(dadesCircular(e, dates, textos, '').curs).toBe('EP-1 A i EP-1 B')
  })

  it('amb tres grups, hi ha comes i un «i» final: el cas normal, no l’excepció', () => {
    // El centre té tres línies (A, B, C) per curs: una excursió de tot un
    // curs dona sempre tres grups. Si això surt malament, surt malament a
    // cada circular d'aquest tipus.
    const e = { ...excursio, Grups: [
      { id:'g1', Grup:'EP-1 A', AlumnesPrevistos:25, AlumnesFinals:null },
      { id:'g2', Grup:'EP-1 B', AlumnesPrevistos:24, AlumnesFinals:null },
      { id:'g3', Grup:'EP-1 C', AlumnesPrevistos:23, AlumnesFinals:null },
    ] } as unknown as Excursio
    expect(dadesCircular(e, dates, textos, '').curs).toBe('EP-1 A, EP-1 B i EP-1 C')
  })

  it('amb quatre grups, la coma es repeteix i el darrer «i» es manté', () => {
    const e = { ...excursio, Grups: [
      { id:'g1', Grup:'EP-1 A', AlumnesPrevistos:25, AlumnesFinals:null },
      { id:'g2', Grup:'EP-1 B', AlumnesPrevistos:24, AlumnesFinals:null },
      { id:'g3', Grup:'EP-1 C', AlumnesPrevistos:23, AlumnesFinals:null },
      { id:'g4', Grup:'EP-1 D', AlumnesPrevistos:22, AlumnesFinals:null },
    ] } as unknown as Excursio
    expect(dadesCircular(e, dates, textos, '').curs).toBe('EP-1 A, EP-1 B, EP-1 C i EP-1 D')
  })

  it('la frase de l’AMPA només hi és si l’AMPA hi posa diners', () => {
    // A la plantilla antiga sortia sempre, també amb aportació zero.
    expect(dadesCircular(excursio, dates, textos, '').ampa).toBe(false)
    expect(dadesCircular({ ...excursio, AmpaCollabora: true } as unknown as Excursio, dates, textos, '').ampa).toBe(true)
  })

  it('sense preu confirmat, no s’inventa cap import', () => {
    const e = { ...excursio, PreuAlumne: null } as unknown as Excursio
    expect(dadesCircular(e, dates, textos, '').preu).toBe('')
  })

  it('amb preu confirmat a zero, ho diu: gratuït no és el mateix que pendent', () => {
    // `null` vol dir que ningú ha confirmat encara cap import; `0` vol dir
    // que s'ha confirmat que l'excursió no costa res. Confondre'ls fa que la
    // circular digui una cosa falsa en qualsevol dels dos sentits: si `0`
    // s'escrivís com a buit, una família llegiria «encara no se sap» quan en
    // realitat és gratuït. Per això no val simplificar amb `e.PreuAlumne ? … : ''`.
    const e = { ...excursio, PreuAlumne: 0 } as unknown as Excursio
    expect(dadesCircular(e, dates, textos, '').preu).toBe('0,00 €')
  })

  it('porta la nota lliure de l’excursió', () => {
    expect(dadesCircular(excursio, dates, textos, 'Cal portar esmorzar.').nota)
      .toBe('Cal portar esmorzar.')
  })
})
