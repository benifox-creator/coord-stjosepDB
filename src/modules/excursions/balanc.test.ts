import { describe, it, expect } from 'vitest'
import { balancSortida, previsioSortida, type DadesSortida } from './balanc'

/** Una sortida de base: 20 assistents, autocar de 500 sense IVA, res més. */
function sortida(canvis: Partial<DadesSortida> = {}): DadesSortida {
  return {
    id: 'e1', lloc: 'Can Montcau', etapa: 'EP', data: '2026-11-18', estat: 'Reservada',
    assistents: 20, previstos: 26, preuAlumne: 30,
    autocars: [500], preuActivitat: 0, preuActivitatTipus: 'per_alumne',
    ampaImport: 0, ampaCobreixActivitat: false, costAcompanyants: 0,
    ivaPct: 10, previsio: 0.75,
    ...canvis,
  }
}

describe('el balanç d’una sortida', () => {
  it('suma l’IVA als autocars', () => {
    // 500 × 1,10 = 550. Els preus es desen nets i l'IVA és el congelat.
    expect(balancSortida(sortida()).haCostat).toBeCloseTo(550, 2)
  })

  it('l’activitat total no es multiplica pels assistents', () => {
    const b = balancSortida(sortida({ preuActivitat: 300, preuActivitatTipus: 'total' }))
    expect(b.haCostat).toBeCloseTo(850, 2)
  })

  it('l’activitat per alumne sí', () => {
    // El cas que ja va enganyar una vegada amb l'Excel: el mateix número vol
    // dir dues coses segons el tipus.
    const b = balancSortida(sortida({ preuActivitat: 8, preuActivitatTipus: 'per_alumne' }))
    expect(b.haCostat).toBeCloseTo(550 + 8 * 20, 2)
  })

  it('els acompanyants són un cost fix', () => {
    expect(balancSortida(sortida({ costAcompanyants: 45 })).haCostat).toBeCloseTo(595, 2)
  })

  it('el que entra són els qui han pagat pel preu congelat', () => {
    expect(balancSortida(sortida()).haEntrat).toBeCloseTo(600, 2)
  })

  it('l’aportació de l’AMPA també entra', () => {
    // L'AMPA rebaixa el que paga la família, així que el centre cobra la
    // diferència d'ella: 20 × 30 + 20 × 4.
    const b = balancSortida(sortida({ ampaImport: 4 }))
    expect(b.haEntrat).toBeCloseTo(680, 2)
  })

  it('quan l’AMPA paga l’activitat sencera, no compta ni com a cost ni com a ingrés', () => {
    // Ha de dir el mateix que `calculaPreu`, que en aquest cas posa
    // l'activitat a zero i tampoc no resta l'aportació.
    const b = balancSortida(sortida({
      preuActivitat: 300, preuActivitatTipus: 'total',
      ampaImport: 4, ampaCobreixActivitat: true,
    }))
    expect(b.haCostat).toBeCloseTo(550, 2)
    expect(b.haEntrat).toBeCloseTo(600, 2)
  })

  it('el coixí és el que entra menys el que costa', () => {
    expect(balancSortida(sortida()).coixi).toBeCloseTo(50, 2)
  })

  it('un coixí negatiu es diu igual, en negatiu', () => {
    expect(balancSortida(sortida({ assistents: 15 })).coixi).toBeCloseTo(15 * 30 - 550, 2)
  })

  it('sense cap pagament apuntat, queda fora del coixí', () => {
    expect(balancSortida(sortida({ assistents: 0 })).foraDelCoixi).toBe('sense-pagaments')
  })

  it('sense preu confirmat, també', () => {
    // Té cost real i cap ingrés possible: comptar-la diria que s'hi ha perdut
    // tot, i el que passa és que ningú no li ha posat preu.
    expect(balancSortida(sortida({ preuAlumne: null })).foraDelCoixi).toBe('sense-preu')
    expect(balancSortida(sortida({ preuAlumne: null })).haEntrat).toBe(0)
  })

  it('menys pagaments que previsions NO la deixa fora', () => {
    // 18 de 26 és una dada bona: la gent no hi va, i el coixí ho ha de notar.
    expect(balancSortida(sortida({ assistents: 18 })).foraDelCoixi).toBeNull()
  })
})

describe('la previsió d’una sortida que encara no ha passat', () => {
  it('compta els assistents que s’esperen, no els previstos crus', () => {
    // 26 × 0,75 = 19,5. No s'arrodoneix, com a `preu.ts`.
    const p = previsioSortida(sortida({ assistents: 0 }))
    expect(p.costara).toBeCloseTo(550, 2)
    expect(p.hauriaDEntrar).toBeCloseTo(19.5 * 30, 2)
  })

  it('el cobrat és el que ja s’ha apuntat', () => {
    expect(previsioSortida(sortida({ assistents: 7 })).cobrat).toBeCloseTo(210, 2)
  })

  it('sense preu confirmat no s’inventa què hauria d’entrar', () => {
    expect(previsioSortida(sortida({ preuAlumne: null })).hauriaDEntrar).toBeNull()
  })
})

import { calculaPreu } from './preu'

describe('el lligam amb el càlcul del preu', () => {
  it('el coixí d’una sortida plena és exactament el marge que hi va posar el preu', () => {
    // Si paguen justos els esperats, el coixí ha de ser el marge i res més.
    // Aquesta és la prova que impedeix que les dues peces divergeixin: si un
    // dia `calculaPreu` canvia de criteri i `balanc` no, aquí es veurà.
    const alumnes = 40
    const parametres = { previsio: 0.75, margePct: 12, ivaPct: 10, arrodoniment: 0.5 }
    const esperats = alumnes * parametres.previsio   // 30, un número enter a posta

    const r = calculaPreu({
      alumnes, autocars: [500], preuActivitat: 8, preuActivitatTipus: 'per_alumne',
      ampaImport: 4, ampaCobreixActivitat: false, costAcompanyants: 45,
    }, parametres)

    const b = balancSortida({
      id: 'e1', lloc: 'Can Montcau', etapa: 'EP', data: '2026-11-18', estat: 'Reservada',
      assistents: esperats, previstos: alumnes, preuAlumne: r.preu,
      autocars: [500], preuActivitat: 8, preuActivitatTipus: 'per_alumne',
      ampaImport: 4, ampaCobreixActivitat: false, costAcompanyants: 45,
      ivaPct: parametres.ivaPct, previsio: parametres.previsio,
    })

    // El coixí és el sobrepreu per alumne multiplicat pels qui paguen.
    expect(b.coixi).toBeCloseTo(esperats * (r.preu - r.base), 2)
    // I cobreix: el preu s'arrodoneix cap amunt, així que mai no es queda curt.
    expect(b.coixi).toBeGreaterThan(0)
  })
})
