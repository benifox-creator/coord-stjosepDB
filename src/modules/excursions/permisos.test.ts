import { describe, it, expect } from 'vitest'
import { potAprovar, potGestionar, potVeureCostos, potEditar } from './permisos'
import type { Usuari } from '../usuaris/types'
import type { Excursio } from './types'

function usuari(canvis: Partial<Usuari> = {}): Usuari {
  return {
    id: 'u1', Email: 'algu@stjosep.org', Nom: 'Algú', Rol: 'professorat', Etapa: null,
    PotGestionarMaterial: false, PotGestionarExcursions: false,
    PotGestionarCostosExcursions: false, PotRedactarConeixement: false, Data_alta: '2026-09-01', ...canvis,
  }
}

const excursio: Excursio = {
  id: 'e1', Codi: 'EXC-001', CursEscolar: '2026-2027', Estat: 'Esborrany', Etapa: 'EP',
  Lloc: '', Poblacio: '', Activitat: '', Data: null, HoraSortida: '', HoraTornada: '',
  Transport: 'autocar', TransportDetall: '', AcompanyantsExterns: 0, Observacions: '',
  Responsable: '', MotiuRebuig: null, MotiuCancellacio: null, ProposadaPer: null,
  AprovadaPer: null, ReservadaPer: null, Creat_per: 'autor@stjosep.org',
  PreuAlumne: null, PreuConfirmatPer: null,
  DataCircular: null, DataLimitPagament: null, DataLimitResguard: null,
  CircularEnviadaPer: null, AmpaCollabora: false,
  Grups: [], Acompanyants: [],
}

describe('qui aprova', () => {
  it('són coordinació, direcció i titularitat', () => {
    for (const rol of ['coordinador', 'direccio', 'titular'] as const) expect(potAprovar(rol)).toBe(true)
  })
  it('no ho són el cap d’estudis, el professorat ni el convidat', () => {
    for (const rol of ['cap_estudis', 'professorat', 'convidat'] as const) expect(potAprovar(rol)).toBe(false)
  })
  it('ningú sense rol', () => {
    expect(potAprovar(null)).toBe(false)
  })
})

describe('qui gestiona', () => {
  it('un docent amb la casella de logística, encara que no canviï de rol', () => {
    expect(potGestionar('professorat', usuari({ PotGestionarExcursions: true }))).toBe(true)
  })
  it('també qui només té la de costos: la de diners inclou la logística', () => {
    expect(potGestionar('professorat', usuari({ PotGestionarCostosExcursions: true }))).toBe(true)
  })
  it('no un docent sense cap casella', () => {
    expect(potGestionar('professorat', usuari())).toBe(false)
  })
})

describe('qui veu els costos', () => {
  it('la casella de logística NO hi dona accés', () => {
    // És la distinció per la qual calen dos permisos i no un: un docent que
    // ajuda a organitzar no ha de veure diners.
    expect(potVeureCostos('professorat', usuari({ PotGestionarExcursions: true }))).toBe(false)
  })
  it('la casella de costos sí', () => {
    expect(potVeureCostos('professorat', usuari({ PotGestionarCostosExcursions: true }))).toBe(true)
  })
  it('i els tres rols de sempre', () => {
    expect(potVeureCostos('direccio', usuari({ Rol: 'direccio' }))).toBe(true)
  })
  it('un docent amb la gestió activada organitza, però no veu diners', () => {
    // És la distinció per la qual hi ha dos permisos i no un. Si algun dia
    // algú els unifica, aquesta prova ho ha d'aturar.
    const docent = usuari({ PotGestionarExcursions: true, PotGestionarCostosExcursions: false })
    expect(potGestionar('professorat', docent)).toBe(true)
    expect(potVeureCostos('professorat', docent)).toBe(false)
  })
  it('Secretaria veu els diners encara que no sigui un càrrec', () => {
    const secretaria = usuari({ PotGestionarExcursions: false, PotGestionarCostosExcursions: true })
    expect(potVeureCostos('professorat', secretaria)).toBe(true)
  })
})

describe('qui pot editar una excursió', () => {
  it('el seu autor mentre és un esborrany', () => {
    expect(potEditar(excursio, 'autor@stjosep.org', 'professorat', usuari())).toBe(true)
  })
  it('sense distingir majúscules al correu', () => {
    expect(potEditar(excursio, 'Autor@StJosep.org', 'professorat', usuari())).toBe(true)
  })
  it('ja no, un cop proposada', () => {
    expect(potEditar({ ...excursio, Estat: 'Proposada' }, 'autor@stjosep.org', 'professorat', usuari())).toBe(false)
  })
  it('ni un altre docent, encara que sigui esborrany', () => {
    expect(potEditar(excursio, 'altre@stjosep.org', 'professorat', usuari())).toBe(false)
  })
  it('però qui gestiona sí, en qualsevol estat', () => {
    expect(potEditar({ ...excursio, Estat: 'Reservada' }, 'altre@stjosep.org', 'direccio', usuari({ Rol: 'direccio' }))).toBe(true)
  })
})
