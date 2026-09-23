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

import { resumCurs, perEtapa } from './balanc'

const AVUI = '2026-12-01'

describe('el resum del curs', () => {
  it('parteix per data: les d’abans d’avui són fetes, la resta per venir', () => {
    const r = resumCurs([
      sortida({ id: 'a', data: '2026-10-05' }),
      sortida({ id: 'b', data: '2027-03-20' }),
    ], AVUI)
    expect(r.fetes.map((f) => f.id)).toEqual(['a'])
    expect(r.perVenir.map((p) => p.id)).toEqual(['b'])
  })

  it('una sortida d’avui mateix ja compta com a feta', () => {
    const r = resumCurs([sortida({ id: 'a', data: AVUI })], AVUI)
    expect(r.fetes.map((f) => f.id)).toEqual(['a'])
  })

  it('una sortida sense data encara no ha passat', () => {
    const r = resumCurs([sortida({ id: 'a', data: null })], AVUI)
    expect(r.perVenir.map((p) => p.id)).toEqual(['a'])
  })

  it('les cancel·lades no surten enlloc', () => {
    // No han costat res ni han ingressat res.
    const r = resumCurs([
      sortida({ id: 'a', data: '2026-10-05', estat: 'Cancel·lada' }),
      sortida({ id: 'b', data: '2027-03-20', estat: 'Cancel·lada' }),
    ], AVUI)
    expect(r.fetes).toHaveLength(0)
    expect(r.perVenir).toHaveLength(0)
    expect(r.foraDelCoixi).toHaveLength(0)
  })

  it('els esborranys tampoc', () => {
    // Un esborrany és privat del seu autor i pot no enviar-se mai: el seu
    // cost no està compromès.
    const r = resumCurs([sortida({ id: 'a', data: '2027-03-20', estat: 'Esborrany' })], AVUI)
    expect(r.perVenir).toHaveLength(0)
  })

  it('suma el que ha entrat i el que ha costat de les fetes', () => {
    const r = resumCurs([
      sortida({ id: 'a', data: '2026-10-05' }),
      sortida({ id: 'b', data: '2026-11-05' }),
    ], AVUI)
    expect(r.totals.haEntrat).toBeCloseTo(1200, 2)
    expect(r.totals.haCostat).toBeCloseTo(1100, 2)
    expect(r.totals.coixi).toBeCloseTo(100, 2)
  })

  it('una feta sense pagaments queda fora dels totals i surt a l’avís', () => {
    // Si comptés, el total diria que s'hi ha perdut tot el cost.
    const r = resumCurs([
      sortida({ id: 'a', data: '2026-10-05' }),
      sortida({ id: 'b', data: '2026-11-05', assistents: 0 }),
    ], AVUI)
    expect(r.totals.coixi).toBeCloseTo(50, 2)
    expect(r.foraDelCoixi.map((f) => [f.id, f.foraDelCoixi])).toEqual([['b', 'sense-pagaments']])
    // Però segueix sent una sortida feta: la taula l'ha d'ensenyar.
    expect(r.fetes.map((f) => f.id)).toEqual(['a', 'b'])
  })

  it('el pendent de cobrar és el que falta de les que vénen', () => {
    // 26 × 0,75 × 30 = 585 esperats, 7 × 30 = 210 ja cobrats.
    const r = resumCurs([sortida({ id: 'b', data: '2027-03-20', assistents: 7 })], AVUI)
    expect(r.totals.pendent).toBeCloseTo(585 - 210, 2)
  })

  it('una que ve sense preu no inventa pendent', () => {
    const r = resumCurs([sortida({ id: 'b', data: '2027-03-20', preuAlumne: null })], AVUI)
    expect(r.totals.pendent).toBe(0)
  })

  it('un pendent no pot ser negatiu', () => {
    // Si en paguen més dels esperats abans d'anar-hi, no falta res per cobrar
    // —i un pendent negatiu es llegiria com que sobren diners.
    const r = resumCurs([sortida({ id: 'b', data: '2027-03-20', assistents: 26 })], AVUI)
    expect(r.totals.pendent).toBe(0)
  })

  it('les fetes surten de la més recent a la més antiga', () => {
    const r = resumCurs([
      sortida({ id: 'a', data: '2026-10-05' }),
      sortida({ id: 'b', data: '2026-11-20' }),
    ], AVUI)
    expect(r.fetes.map((f) => f.id)).toEqual(['b', 'a'])
  })

  it('les que vénen surten de la més pròxima a la més llunyana, i les sense data al final', () => {
    const r = resumCurs([
      sortida({ id: 'a', data: null }),
      sortida({ id: 'b', data: '2027-05-10' }),
      sortida({ id: 'c', data: '2027-01-15' }),
    ], AVUI)
    expect(r.perVenir.map((p) => p.id)).toEqual(['c', 'b', 'a'])
  })
})

describe('el repartiment per etapa', () => {
  const fetes = () => resumCurs([
    sortida({ id: 'a', etapa: 'EP', data: '2026-10-05' }),
    sortida({ id: 'b', etapa: 'EP', data: '2026-11-05' }),
    sortida({ id: 'c', etapa: 'EI', data: '2026-11-10', assistents: 10 }),
  ], AVUI).fetes

  it('suma el gastat per etapa', () => {
    expect(perEtapa(fetes(), 'total')).toEqual([
      { etapa: 'EI', valor: 550 },
      { etapa: 'EP', valor: 1100 },
    ])
  })

  it('el cost per alumne divideix pels assistents de l’etapa', () => {
    // EI: 550 € entre 10 assistents. EP: 1.100 € entre 40.
    expect(perEtapa(fetes(), 'per_alumne')).toEqual([
      { etapa: 'EI', valor: 55 },
      { etapa: 'EP', valor: 27.5 },
    ])
  })

  it('el coixí per etapa pot ser negatiu', () => {
    // EI: 10 × 30 − 550 = −250.
    expect(perEtapa(fetes(), 'coixi')).toEqual([
      { etapa: 'EI', valor: -250 },
      { etapa: 'EP', valor: 100 },
    ])
  })

  it('una etapa sense sortides no surt', () => {
    expect(perEtapa(fetes(), 'total').map((f) => f.etapa)).not.toContain('ESO 1r-2n')
  })

  it('les que estan fora del coixí no compten al gràfic', () => {
    // Mateix criteri que als totals: no tenen res a dir sobre el coixí.
    const amb = resumCurs([
      sortida({ id: 'a', etapa: 'EP', data: '2026-10-05' }),
      sortida({ id: 'z', etapa: 'EP', data: '2026-10-06', assistents: 0 }),
    ], AVUI).fetes
    expect(perEtapa(amb, 'total')).toEqual([{ etapa: 'EP', valor: 550 }])
  })

  it('sense assistents no divideix per zero', () => {
    // Amb totes les de l'etapa fora del coixí, l'etapa no hi surt: és
    // preferible a una barra amb «Infinity €».
    const cap = resumCurs([sortida({ id: 'z', etapa: 'EP', data: '2026-10-06', assistents: 0 })], AVUI).fetes
    expect(perEtapa(cap, 'per_alumne')).toEqual([])
  })
})
