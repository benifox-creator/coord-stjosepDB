import { describe, it, expect } from 'vitest'
import { preuEsValid } from './preuValid'
import { calculaPreu } from './preu'
import type { ParametresPreu } from './preu'

// Aquest fitxer no renderitza `BlocEconomic` —el projecte no té DOM a Vitest
// (environment: 'node')— però la guarda que decideix si es pot desar o
// confirmar un preu és una funció pura, i és això el que es prova aquí.

describe('preuEsValid', () => {
  it('un preu normal és vàlid', () => {
    expect(preuEsValid(8)).toBe(true)
    expect(preuEsValid(0)).toBe(true)
  })

  it('NaN no ho és', () => {
    expect(preuEsValid(NaN)).toBe(false)
  })

  it('Infinity tampoc: no és un preu que es pugui confirmar', () => {
    expect(preuEsValid(Infinity)).toBe(false)
    expect(preuEsValid(-Infinity)).toBe(false)
  })

  it('reprodueix el cas real: un camp de preu buidat porta NaN fins al resultat', () => {
    // Number('-') és NaN. Un sol autocar amb aquest valor ja n'hi ha prou
    // perquè `calculaPreu` propagui el NaN fins al preu final.
    const parametres: ParametresPreu = { previsio: 0.75, margePct: 12, ivaPct: 10, arrodoniment: 0.5 }
    const resultat = calculaPreu({
      alumnes: 100, autocars: [Number('-')], preuActivitat: 0, preuActivitatTipus: 'per_alumne',
      ampaImport: 0, ampaCobreixActivitat: false, costAcompanyants: 0,
    }, parametres)
    expect(preuEsValid(resultat.preu)).toBe(false)
  })
})
