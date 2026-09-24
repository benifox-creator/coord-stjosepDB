import { describe, it, expect } from 'vitest'
import { potRedactar, potPublicar, potEliminar } from './permisos'
import type { Usuari } from '../usuaris/types'

function usuari(canvis: Partial<Usuari> = {}): Usuari {
  return {
    id: 'u1', Email: 'algu@stjosep.org', Nom: 'Algú', Rol: 'professorat', Etapa: null,
    PotGestionarMaterial: false, PotGestionarExcursions: false,
    PotGestionarCostosExcursions: false, PotRedactarConeixement: false, Data_alta: '2026-09-01', ...canvis,
  }
}

describe('qui redacta', () => {
  it('el coordinador, encara que no tingui la casella marcada', () => {
    expect(potRedactar('coordinador', usuari({ Rol: 'coordinador' }))).toBe(true)
  })
  it('el coordinador fins i tot sense fitxa d’usuari: el rol ja hi dona accés', () => {
    expect(potRedactar('coordinador', null)).toBe(true)
  })
  it('qui té la casella marcada, encara que no sigui coordinador', () => {
    expect(potRedactar('professorat', usuari({ PotRedactarConeixement: true }))).toBe(true)
  })
  it('ningú sense casella ni rol de coordinador', () => {
    expect(potRedactar('professorat', usuari())).toBe(false)
  })
  it('un usuari nul no peta, i sense casella no redacta', () => {
    expect(potRedactar('professorat', null)).toBe(false)
  })
})

describe('qui publica', () => {
  it('el coordinador', () => {
    expect(potPublicar('coordinador')).toBe(true)
  })
  it('ni amb la casella marcada, qui no sigui coordinador: aquí no hi val cap casella', () => {
    expect(potPublicar('professorat')).toBe(false)
  })
  it('ningú sense rol', () => {
    expect(potPublicar(null)).toBe(false)
  })
})

describe('qui esborra un article concret', () => {
  it('el coordinador, encara que estigui publicat', () => {
    expect(potEliminar('coordinador', usuari({ Rol: 'coordinador' }), true)).toBe(true)
  })
  it('el coordinador, amb un esborrany', () => {
    expect(potEliminar('coordinador', usuari({ Rol: 'coordinador' }), false)).toBe(true)
  })
  it('el redactor, amb un esborrany seu', () => {
    expect(potEliminar('professorat', usuari({ PotRedactarConeixement: true }), false)).toBe(true)
  })
  it('el redactor, no un cop publicat: aquí ja li cal la casella de publicar', () => {
    expect(potEliminar('professorat', usuari({ PotRedactarConeixement: true }), true)).toBe(false)
  })
})

describe('els dos conceptes junts', () => {
  it('el coordinador pot les dues coses', () => {
    expect(potRedactar('coordinador', usuari({ Rol: 'coordinador' }))).toBe(true)
    expect(potPublicar('coordinador')).toBe(true)
  })
  it('qui té la casella redacta però no publica', () => {
    const redactor = usuari({ PotRedactarConeixement: true })
    expect(potRedactar('professorat', redactor)).toBe(true)
    expect(potPublicar('professorat')).toBe(false)
  })
  it('sense casella ni rol de coordinador, cap de les dues', () => {
    const ningu = usuari()
    expect(potRedactar('professorat', ningu)).toBe(false)
    expect(potPublicar('professorat')).toBe(false)
  })
})
