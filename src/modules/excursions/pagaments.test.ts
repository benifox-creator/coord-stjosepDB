import { describe, it, expect } from 'vitest'
import { pagamentsAApuntar, recaptat, totalPagats } from './pagaments'
import type { ExcursioGrup } from './types'

const grup = (pagats: number, previstos = 25): ExcursioGrup =>
  ({ id: `g${pagats}`, Grup: 'EP-1 A', AlumnesPrevistos: previstos, AlumnesFinals: null, AlumnesPagats: pagats })

describe('què s’ha recaptat', () => {
  it('suma els pagaments de tots els grups i multiplica pel preu', () => {
    expect(recaptat([grup(18), grup(20)], 12.5)).toBe(475)
  })

  it('sense preu confirmat no hi ha cap xifra, i no és zero', () => {
    // Zero vol dir que no ha pagat ningú; buit vol dir que encara no se sap
    // quant es cobra. A un panell econòmic, confondre-ho seria ensenyar una
    // pèrdua que no existeix.
    expect(recaptat([grup(18)], null)).toBeNull()
  })

  it('amb el preu a zero, el recaptat és zero', () => {
    expect(recaptat([grup(18)], 0)).toBe(0)
  })

  it('sense grups, zero', () => {
    expect(totalPagats([])).toBe(0)
    expect(recaptat([], 12.5)).toBe(0)
  })

  it('no arrossega errors de coma flotant', () => {
    // 3 × 10,10 en coma flotant fa 30,299999999999997, i això acabaria imprès
    // en un panell que parla de diners.
    expect(recaptat([grup(3)], 10.1)).toBe(30.3)
  })
})

describe('què s’envia quan algú acaba d’escriure al camp', () => {
  it('un recompte normal s’envia', () => {
    expect(pagamentsAApuntar('18', 0)).toBe(18)
  })

  it('el mateix que ja hi ha desat no s’envia', () => {
    // Cada desat és una crida al servidor i una recàrrega de tota la llista:
    // entrar al camp i sortir-ne sense tocar res no ho ha de costar.
    expect(pagamentsAApuntar('18', 18)).toBeNull()
  })

  it('els zeros del davant no compten', () => {
    expect(pagamentsAApuntar('007', 0)).toBe(7)
    expect(pagamentsAApuntar('018', 18)).toBeNull()
  })

  it('zero s’envia: vol dir que s’ha desapuntat tothom', () => {
    // Un grup que havia pagat i que torna a zero (una excursió que es refà) és
    // un canvi real, no pas un camp buit.
    expect(pagamentsAApuntar('0', 5)).toBe(0)
  })

  it('el camp buit no s’envia', () => {
    expect(pagamentsAApuntar('', 5)).toBeNull()
    expect(pagamentsAApuntar('   ', 5)).toBeNull()
  })

  it('un negatiu no s’envia', () => {
    expect(pagamentsAApuntar('-3', 5)).toBeNull()
  })

  it('el signe «+» sí que passa: és el mateix nombre', () => {
    // Un camp `type="number"` admet escriure-hi «+18», i ignorar-ho en silenci
    // seria perdre un recompte ben escrit.
    expect(pagamentsAApuntar('+18', 5)).toBe(18)
    expect(pagamentsAApuntar('+18', 18)).toBeNull()
    expect(pagamentsAApuntar('++18', 5)).toBeNull()
  })

  it('un decimal no s’envia: un pagament a mitges no existeix', () => {
    expect(pagamentsAApuntar('1.5', 5)).toBeNull()
    expect(pagamentsAApuntar('1,5', 5)).toBeNull()
  })

  it('«1e3» no s’envia, encara que el camp numèric el deixi escriure', () => {
    // `Number('1e3')` fa 1000 sense queixar-se. Apuntar mil pagaments en un
    // grup de vint-i-cinc perquè algú ha premut la «e» és pitjor que no fer
    // res: a la pantalla només sortiria un «més pagaments que previsions» en
    // gris, que és el que es diu quan la dada és correcta.
    expect(pagamentsAApuntar('1e3', 5)).toBeNull()
  })

  it('el que no és un nombre no s’envia', () => {
    expect(pagamentsAApuntar('divuit', 5)).toBeNull()
    expect(pagamentsAApuntar('18 alumnes', 5)).toBeNull()
  })
})
