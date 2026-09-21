import { describe, it, expect } from 'vitest'
import { calculaPreu, arrodoneixAmunt, type CostosExcursio, type ParametresPreu } from './preu'
import excursionsReals from '../../../tests/fixtures/excursions-excel.json'

const params: ParametresPreu = { previsio: 0.8, margePct: 12, ivaPct: 10, arrodoniment: 0.5 }
const base: CostosExcursio = {
  alumnes: 100, autocars: [500],
  preuActivitat: 0, preuActivitatTipus: 'total',
  ampaImport: 0, ampaCobreixActivitat: false, costAcompanyants: 0,
}

describe('arrodoniment', () => {
  it('puja al pas següent i no baixa mai', () => {
    expect(arrodoneixAmunt(10.01, 0.5)).toBe(10.5)
    expect(arrodoneixAmunt(10.5, 0.5)).toBe(10.5)   // ja hi és: no puja
    expect(arrodoneixAmunt(0, 0.5)).toBe(0)
  })
  it('no es menja cèntims per l’aritmètica de coma flotant', () => {
    // 0.1+0.2 no fa 0.3 en coma flotant: si l'arrodoniment es fa a la babalà,
    // un preu just al pas puja un graó i les famílies paguen 50 cèntims de més.
    expect(arrodoneixAmunt(11.1, 0.1)).toBe(11.1)
    expect(arrodoneixAmunt(28.35, 0.05)).toBe(28.35)
  })
  it('amb pas 0 no arrodoneix', () => {
    expect(arrodoneixAmunt(10.37, 0)).toBe(10.37)
  })
})

describe('càlcul del preu', () => {
  it('reparteix els costos entre els que s’espera que paguin, no entre tots', () => {
    // 100 alumnes × 0,8 = 80 esperats. Autocar 500 + 10% IVA = 550.
    // 550 / 80 = 6,875 → × 1,12 = 7,70 → arrodonit amunt a 0,50 = 8,00
    const r = calculaPreu(base, params)
    expect(r.esperats).toBe(80)
    expect(r.costosFixos).toBeCloseTo(550, 6)
    expect(r.costAlumne).toBeCloseTo(6.875, 6)
    expect(r.preu).toBe(8)
  })

  it('no arrodoneix els esperats, que desquadraria el repartiment', () => {
    // 89 × 0,75 = 66,75. Si s'arrodonís a 67, el cost per alumne baixaria i
    // deixaria de coincidir amb el que el centre ha estat calculant. Ho vam
    // comprovar contra quatre excursions reals abans d'escriure això.
    const r = calculaPreu({ ...base, alumnes: 89, autocars: [959.2] }, { ...params, previsio: 0.75, ivaPct: 0 })
    expect(r.esperats).toBeCloseTo(66.75, 6)
    expect(r.costAlumne).toBeCloseTo(959.2 / 66.75, 6)
  })

  it('l’activitat per alumne no es divideix', () => {
    const r = calculaPreu({ ...base, preuActivitat: 5, preuActivitatTipus: 'per_alumne' }, params)
    expect(r.costAlumne).toBeCloseTo(6.875 + 5, 6)
  })

  it('l’activitat total sí', () => {
    const r = calculaPreu({ ...base, preuActivitat: 400, preuActivitatTipus: 'total' }, params)
    expect(r.costosFixos).toBeCloseTo(950, 6)
    expect(r.costAlumne).toBeCloseTo(950 / 80, 6)
  })

  it('l’IVA només toca els autocars', () => {
    const r = calculaPreu({ ...base, autocars: [1000], preuActivitat: 100, preuActivitatTipus: 'total' }, params)
    expect(r.costosFixos).toBeCloseTo(1100 + 100, 6)
  })

  it('suma tots els autocars, que abans era on petava', () => {
    // L'Excel partia el text "406+406" pel primer '+' i amb tres autocars
    // deixava el preu en blanc.
    const r = calculaPreu({ ...base, autocars: [406, 406, 406] }, params)
    expect(r.costosFixos).toBeCloseTo(406 * 3 * 1.1, 6)
  })

  it('el cost dels acompanyants es reparteix com qualsevol altre cost fix', () => {
    const r = calculaPreu({ ...base, costAcompanyants: 80 }, params)
    expect(r.costosFixos).toBeCloseTo(630, 6)
  })

  it('l’AMPA rebaixa el preu per alumne', () => {
    const r = calculaPreu({ ...base, ampaImport: 4 }, params)
    expect(r.base).toBeCloseTo(6.875 - 4, 6)
  })

  it('si l’AMPA cobreix l’activitat, l’activitat val zero i no es resta res més', () => {
    const r = calculaPreu(
      { ...base, preuActivitat: 10, preuActivitatTipus: 'per_alumne', ampaImport: 4, ampaCobreixActivitat: true },
      params,
    )
    expect(r.costAlumne).toBeCloseTo(6.875, 6)  // l'activitat no hi suma
    expect(r.base).toBeCloseTo(6.875, 6)        // i l'aportació no es resta
  })

  it('el preu no és mai negatiu', () => {
    const r = calculaPreu({ ...base, ampaImport: 1000 }, params)
    expect(r.preu).toBe(0)
  })

  it('sense ningú qui pagui, no divideix per zero', () => {
    const r = calculaPreu({ ...base, alumnes: 0 }, params)
    expect(r.esperats).toBe(0)
    expect(Number.isFinite(r.preu)).toBe(true)
    expect(r.preu).toBe(0)
  })

  it('el marge s’aplica també quan no hi ha autocar', () => {
    // A l'Excel no s'aplicava si s'anava en metro. Amb un marge percentual
    // això deixa de caler: ja escala sol.
    const r = calculaPreu({ ...base, autocars: [], preuActivitat: 10, preuActivitatTipus: 'per_alumne' }, params)
    expect(r.base).toBeCloseTo(10, 6)
    // Literal i no `arrodoneixAmunt(10 * 1.12, 0.5)`: calcular l'esperat amb
    // la mateixa funció que es prova la faria passar encara que l'arrodoniment
    // es convertís en la identitat.
    expect(r.preu).toBe(11.5)
  })
})

describe('contra les excursions reals del curs 2022-23', () => {
  // Avís per a qui llegeixi això buscant "proves que el preu funciona amb
  // dades reals": el preu de cada autocar al fixture (`excursions-excel.json`)
  // és el que hi havia a la columna 'Autocar' de l'Excel, i és **amb IVA**
  // (les 35 files amb autocar hi divideixen exactament per 1,1) — mentre que
  // `CostosExcursio.autocars` es documenta "sense IVA". Es passa `ivaPct: 0`
  // més avall precisament per neutralitzar aquesta diferència i poder
  // comparar amb el que l'Excel deia. Això fa que la comparació sigui
  // honesta, però vol dir que aquesta prova NO comprova que qui escriu el
  // preu a `BlocEconomic` hi posi de debò l'import sense IVA: només que el
  // càlcul reprodueix l'Excel si se li dona el número que ell esperava.
  it('reprodueix el cost per alumne que va calcular l’Excel, al cèntim', () => {
    // Es compara amb `r.base` (cost per alumne ja net d'AMPA) i no amb
    // `r.costAlumne`: ara que l'AMPA es resta per a les excursions on
    // l'Excel encara no ho havia fet (vegeu el comentari sobre
    // `ampaJaInclosaAlPreu` més avall), el número que ha de coincidir amb
    // l'Excel és el que ja té l'AMPA descomptada.
    const desviades: string[] = []
    for (const e of excursionsReals) {
      const r = calculaPreu(
        {
          alumnes: e.alumnes, autocars: e.autocars,
          preuActivitat: e.preuActivitat,
          // El JSON només sap que és un string; el fixture el genera sempre
          // com 'total' o 'per_alumne' (vegeu extreu-excursions-excel.mjs).
          preuActivitatTipus: e.preuActivitatTipus as CostosExcursio['preuActivitatTipus'],
          // Quirk del full de càlcul original, no del sistema nou: quan
          // l'activitat es cobrava per alumne, l'Excel ja restava l'AMPA
          // abans que el número arribés aquí (columna "Preu-Ampa" del full
          // 'Preu Activitat'), així que tornar a restar-la la restaria dues
          // vegades. Quan l'activitat era un import total del grup, l'Excel
          // no la restava enlloc, i aquí sí que cal fer-ho per reproduir el
          // preu final. Al sistema nou l'AMPA sempre es resta explícitament;
          // aquest condicional només existeix per poder comparar-nos amb
          // com ho feia l'Excel.
          ampaImport: e.ampaJaInclosaAlPreu ? 0 : e.ampaExcel,
          ampaCobreixActivitat: false, costAcompanyants: 0,
        },
        { previsio: e.previsio, margePct: 0, ivaPct: 0, arrodoniment: 0 },
      )
      if (Math.abs(r.base - e.preuExcel) > 0.01) {
        desviades.push(`${e.lloc} (${e.curs}): surt ${r.base.toFixed(2)}, l'Excel deia ${e.preuExcel.toFixed(2)}`)
      }
    }
    expect(desviades).toEqual([])
  })

  it('i n’hi ha prou com perquè la prova signifiqui alguna cosa', () => {
    // Si el fixture es buidés, la prova anterior passaria sense comprovar res.
    expect(excursionsReals.length).toBeGreaterThanOrEqual(40)
  })
})
