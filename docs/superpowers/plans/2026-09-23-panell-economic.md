# Panell econòmic de les sortides — pla d'implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una pantalla dins d'Excursions que ensenyi què han costat les sortides d'un curs, què n'ha entrat i si el coixí cobreix, amb el repartiment per etapa.

**Architecture:** Tot el càlcul va a un mòdul pur sense dependències (`balanc.ts`), provable amb sortides reals sense base de dades ni React — el mateix patró que `preu.ts`. Un store de Zustand llegeix per curs les quatre taules que calen, i dos components de presentació dibuixen el resultat. **Cap migració, cap vista SQL, cap permís nou.**

**Tech Stack:** React 19 + TypeScript estricte (`verbatimModuleSyntax`, `noUnusedLocals`), Zustand, Tailwind, React Router 7 (HashRouter), Supabase via `src/services/db.ts`, Vitest amb `environment: 'node'`.

**Spec:** `docs/superpowers/specs/2026-09-23-panell-economic-design.md`

## Global Constraints

- **Tot en català**: noms de funcions i variables, comentaris, missatges i textos de pantalla.
- **Apòstrof tipogràfic `’` dins cometes dobles.** Mai un apòstrof recte tancant una cadena de cometes simples — ja ha trencat la compilació una vegada en aquest mòdul.
- **TypeScript estricte**: els imports de tipus van amb `import type`. `noUnusedLocals` està actiu.
- **No hi ha proves de components**: Vitest corre amb `environment: 'node'`, sense DOM. Tota lògica que s'hagi de provar viu en un mòdul pur, no dins un `.tsx`.
- **Cap migració ni canvi a la base de dades.** `supabase/schema.sql` no es toca. Aquesta peça només llegeix.
- **No es toca `preu.ts`**, que està verificat contra 44 sortides reals. Aquí només se'n llegeix el resultat.
- **La xifra es diu «coixí»**, mai «benefici» ni «guany». En verd quan cobreix, en vermell quan no, i **sense celebrar-ne un de gran**: ni fletxes amunt ni percentatges de creixement.
- **Els paràmetres són els congelats** (`previsio_usada`, `iva_pct_usat`), no els de la configuració d'avui.
- **Cap funció llegeix el rellotge.** La data d'avui entra sempre com a argument (`avui: string`, ISO `YYYY-MM-DD`), perquè les proves puguin situar-se on vulguin.
- Format de diners: `n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR' })`, com ja fan `BlocEconomic.tsx:24` i `ExcursioDetall.tsx:54`.

## Decisions preses en escriure el pla

Dues coses que l'spec no resol i que canvien els números. Queden decidides aquí:

1. **Els esborranys no compten enlloc**, com les cancel·lades. Un esborrany és privat del seu autor i pot no enviar-se mai; comptar-ne el cost com a compromès inflaria «per venir» per sempre amb sortides que ningú no ha proposat. Des de `Proposada` amunt, sí.
2. **Una sortida feta sense preu confirmat tampoc no entra al coixí**, pel mateix motiu que una sense pagaments: té cost real i cap ingrés possible, i comptar-la diria que s'hi ha perdut tot. Surt al mateix avís, amb el seu motiu. Per això el camp no es diu `sensePagaments` sinó `foraDelCoixi: 'sense-pagaments' | 'sense-preu' | null`.

## Estructura de fitxers

| Fitxer | Responsabilitat |
|---|---|
| `src/modules/excursions/balanc.ts` **(nou)** | El càlcul sencer. Zero dependències. |
| `src/modules/excursions/balanc.test.ts` **(nou)** | Les proves del càlcul, inclosa la que el lliga a `preu.ts`. |
| `src/modules/excursions/useBalanc.ts` **(nou)** | Llegeix les quatre taules d'un curs i les converteix en `DadesSortida[]`. |
| `src/modules/excursions/useBalanc.test.ts` **(nou)** | Proves del store amb `src/services/db` simulat. |
| `src/modules/excursions/GraficEtapes.tsx` **(nou)** | El gràfic de barres amb l'interruptor de les tres mesures. |
| `src/modules/excursions/PanellEconomic.tsx` **(nou)** | La pantalla: capçalera, quatre xifres, gràfic, dues taules i l'avís. |
| `src/app/routes/EconomiaWrapper.tsx` **(nou)** | Connecta store, permisos i pantalla. |
| `src/App.tsx` **(modificar)** | La ruta `/excursions/economia`. |
| `src/modules/excursions/ExcursionsPage.tsx` **(modificar)** | L'enllaç cap al panell, només per a qui veu els costos. |

---

### Task 1: El càlcul d'una sortida

**Files:**
- Create: `src/modules/excursions/balanc.ts`
- Test: `src/modules/excursions/balanc.test.ts`

**Interfaces:**
- Consumes: res. El mòdul no importa res del projecte, a propòsit.
- Produces: `DadesSortida`, `BalancSortida`, `Previsio`, `MotiuFora`, `balancSortida(d: DadesSortida): BalancSortida`, `previsioSortida(d: DadesSortida): Previsio`.

- [ ] **Step 1: Escriu les proves que fallen**

Crea `src/modules/excursions/balanc.test.ts`:

```ts
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
```

- [ ] **Step 2: Executa-les i comprova que fallen**

Run: `npx vitest run src/modules/excursions/balanc.test.ts`
Expected: FAIL — «Failed to resolve import "./balanc"».

- [ ] **Step 3: Escriu `balanc.ts`**

```ts
// src/modules/excursions/balanc.ts
//
// Què ha costat una sortida i què n'ha entrat. Aïllat de tota la resta pel
// mateix motiu que `preu.ts`: és on un error costa diners de debò, i així es
// pot provar amb sortides reals sense muntar ni base de dades ni React.
//
// El càlcul ha de dir el mateix que `calculaPreu` mirat des de l'altre
// costat. Si divergeixen, una de les dues peces menteix — hi ha una prova que
// ho comprova (`balanc.test.ts`, «el coixí d’una sortida plena és el marge»).

/** Per què una sortida feta no pot entrar al coixí del curs. */
export type MotiuFora = 'sense-pagaments' | 'sense-preu'

export interface DadesSortida {
  id: string
  lloc: string
  etapa: string
  /** ISO `YYYY-MM-DD`, o `null` si encara no té dia. */
  data: string | null
  estat: string
  /** Σ `alumnes_pagats` dels grups. Els qui han pagat són els qui hi van. */
  assistents: number
  /** Σ `alumnes_previstos` dels grups. */
  previstos: number
  /** El preu congelat en confirmar-lo. `null` mentre no s'ha confirmat. */
  preuAlumne: number | null
  /** El preu de cada autocar, **sense** IVA. */
  autocars: number[]
  preuActivitat: number
  preuActivitatTipus: 'per_alumne' | 'total'
  /** Aportació de l'AMPA **per alumne**. */
  ampaImport: number
  ampaCobreixActivitat: boolean
  costAcompanyants: number
  /** L'IVA congelat amb el preu (`iva_pct_usat`), no el de la configuració d'avui. */
  ivaPct: number
  /** La previsió d'assistència congelada (`previsio_usada`). */
  previsio: number
}

export interface BalancSortida {
  id: string
  lloc: string
  etapa: string
  data: string | null
  assistents: number
  previstos: number
  haCostat: number
  haEntrat: number
  coixi: number
  /** `null` si compta al coixí del curs; el motiu si no. */
  foraDelCoixi: MotiuFora | null
}

export interface Previsio {
  id: string
  lloc: string
  etapa: string
  data: string | null
  costara: number
  /** `null` mentre no hi hagi preu: no s'inventa una xifra. */
  hauriaDEntrar: number | null
  /** El que ja s'ha apuntat com a cobrat. */
  cobrat: number
}

/**
 * El cost d'una sortida amb `n` assistents. Quan l'AMPA paga l'activitat
 * sencera, l'activitat no passa pel compte del centre i val zero — exactament
 * el que fa `calculaPreu`.
 */
function costAmb(d: DadesSortida, n: number): number {
  const activitat = d.ampaCobreixActivitat ? 0 : d.preuActivitat
  const perAlumne = d.preuActivitatTipus === 'per_alumne' ? activitat * n : activitat
  const transport = d.autocars.reduce((s, preu) => s + preu, 0) * (1 + d.ivaPct / 100)
  return transport + perAlumne + d.costAcompanyants
}

/**
 * El que entra amb `n` assistents: el que paguen les famílies més el que hi
 * posa l'AMPA. Si l'AMPA cobreix l'activitat no hi posa res per alumne: ja
 * s'ha gastat allà.
 */
function ingresAmb(d: DadesSortida, n: number, preu: number): number {
  const ampa = d.ampaCobreixActivitat ? 0 : d.ampaImport
  return n * preu + n * ampa
}

export function balancSortida(d: DadesSortida): BalancSortida {
  const haCostat = costAmb(d, d.assistents)
  const haEntrat = d.preuAlumne === null ? 0 : ingresAmb(d, d.assistents, d.preuAlumne)
  // L'ordre importa: sense preu no hi ha ingrés possible, i és el motiu més
  // informatiu dels dos quan es donen tots dos alhora.
  const foraDelCoixi: MotiuFora | null =
    d.preuAlumne === null ? 'sense-preu' : d.assistents === 0 ? 'sense-pagaments' : null
  return {
    id: d.id, lloc: d.lloc, etapa: d.etapa, data: d.data,
    assistents: d.assistents, previstos: d.previstos,
    haCostat, haEntrat, coixi: haEntrat - haCostat, foraDelCoixi,
  }
}

export function previsioSortida(d: DadesSortida): Previsio {
  // **No s'arrodoneix**, com a `preu.ts`: amb 26 alumnes i una previsió de
  // 0,75 s'espera 19,5 i no 20, i arrodonir-ho aquí desquadraria la xifra
  // respecte del preu que es va calcular amb aquella mateixa fracció.
  const esperats = d.previstos * d.previsio
  return {
    id: d.id, lloc: d.lloc, etapa: d.etapa, data: d.data,
    costara: costAmb(d, esperats),
    hauriaDEntrar: d.preuAlumne === null ? null : ingresAmb(d, esperats, d.preuAlumne),
    cobrat: d.preuAlumne === null ? 0 : d.assistents * d.preuAlumne,
  }
}
```

- [ ] **Step 4: Executa-les i comprova que passen**

Run: `npx vitest run src/modules/excursions/balanc.test.ts`
Expected: PASS, 15 proves.

- [ ] **Step 5: La prova que lliga les dues peces**

Afegeix al final de `balanc.test.ts`:

```ts
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
```

- [ ] **Step 6: Executa i comprova**

Run: `npx vitest run src/modules/excursions/balanc.test.ts`
Expected: PASS, 16 proves.

- [ ] **Step 7: Comprova amb una mutació que la prova del lligam prova alguna cosa**

Canvia temporalment `costAmb` perquè no sumi `d.costAcompanyants` i torna a executar. La prova del lligam ha de **fallar**. Desfés el canvi. Escriu a l'informe què ha passat exactament.

- [ ] **Step 8: Commit**

```bash
git add src/modules/excursions/balanc.ts src/modules/excursions/balanc.test.ts
git commit -m "feat(economia): què ha costat una sortida i què n'ha entrat"
```

---

### Task 2: El resum del curs i el repartiment per etapa

**Files:**
- Modify: `src/modules/excursions/balanc.ts` (afegir al final)
- Test: `src/modules/excursions/balanc.test.ts` (afegir al final)

**Interfaces:**
- Consumes: `DadesSortida`, `BalancSortida`, `Previsio`, `balancSortida`, `previsioSortida` de la Task 1.
- Produces: `ResumCurs`, `TotalsCurs`, `MesuraEtapa`, `FilaEtapa`, `resumCurs(sortides: DadesSortida[], avui: string): ResumCurs`, `perEtapa(fetes: BalancSortida[], mesura: MesuraEtapa): FilaEtapa[]`.

- [ ] **Step 1: Escriu les proves que fallen**

Afegeix a `balanc.test.ts`:

```ts
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
    // Però segueix sent una sortida feta: la taula l'ha d'ensenyar. Surt
    // primer perquè és la més recent — quedar fora del coixí no la mou de
    // lloc a la llista.
    expect(r.fetes.map((f) => f.id)).toEqual(['b', 'a'])
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
```

- [ ] **Step 2: Executa-les i comprova que fallen**

Run: `npx vitest run src/modules/excursions/balanc.test.ts`
Expected: FAIL — «resumCurs is not a function» (o «has no exported member»).

- [ ] **Step 3: Implementa-ho**

Afegeix al final de `src/modules/excursions/balanc.ts`:

```ts
export interface TotalsCurs {
  haEntrat: number
  haCostat: number
  coixi: number
  /** El que falta per cobrar de les que encara no han passat. Mai negatiu. */
  pendent: number
}

export interface ResumCurs {
  /** Les que ja han passat, de la més recent a la més antiga. */
  fetes: BalancSortida[]
  /** Les que vénen, de la més pròxima a la més llunyana; les sense data, al final. */
  perVenir: Previsio[]
  /** Les fetes que no compten al coixí, per a l'avís. */
  foraDelCoixi: BalancSortida[]
  totals: TotalsCurs
}

/**
 * Una sortida cancel·lada no ha costat res ni ha ingressat res, i un esborrany
 * és privat del seu autor i pot no enviar-se mai: cap de les dues no té un
 * cost compromès que valgui la pena ensenyar.
 */
function compta(d: DadesSortida): boolean {
  return d.estat !== 'Cancel·lada' && d.estat !== 'Esborrany'
}

/**
 * El tall és la **data**, no l'estat: una sortida del novembre que segueix en
 * estat `Aprovada` ja ha passat, i l'estat només diu que ningú no l'ha tocada
 * des de llavors. Una sortida sense data encara no pot haver passat.
 */
function jaHaPassat(d: DadesSortida, avui: string): boolean {
  return d.data !== null && d.data <= avui
}

export function resumCurs(sortides: DadesSortida[], avui: string): ResumCurs {
  const bones = sortides.filter(compta)

  const fetes = bones.filter((d) => jaHaPassat(d, avui)).map(balancSortida)
    .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))

  const perVenir = bones.filter((d) => !jaHaPassat(d, avui)).map(previsioSortida)
    // Les sense data van al final: `null` es compara com a cadena buida, que
    // ordenaria primer, i una sortida sense dia no és la més imminent.
    .sort((a, b) => (a.data ?? '9999-99-99').localeCompare(b.data ?? '9999-99-99'))

  const compten = fetes.filter((f) => f.foraDelCoixi === null)
  const haEntrat = compten.reduce((s, f) => s + f.haEntrat, 0)
  const haCostat = compten.reduce((s, f) => s + f.haCostat, 0)

  // Un pendent negatiu es llegiria com que sobren diners quan el que passa és
  // que n'han pagat més dels esperats. Zero és la resposta honesta.
  const pendent = perVenir.reduce(
    (s, p) => s + Math.max(0, (p.hauriaDEntrar ?? 0) - p.cobrat), 0)

  return {
    fetes, perVenir,
    foraDelCoixi: fetes.filter((f) => f.foraDelCoixi !== null),
    totals: { haEntrat, haCostat, coixi: haEntrat - haCostat, pendent },
  }
}

export type MesuraEtapa = 'total' | 'per_alumne' | 'coixi'

export interface FilaEtapa {
  etapa: string
  valor: number
}

/**
 * El repartiment per etapa de les sortides **fetes que compten**. Les tres
 * mesures diuen coses diferents a posta: el total ensenya on van els diners
 * (i la més gran sempre serà la que té més alumnes), el cost per alumne és
 * l'única xifra comparable entre etapes, i el coixí és l'única que assenyala
 * un problema.
 */
export function perEtapa(fetes: BalancSortida[], mesura: MesuraEtapa): FilaEtapa[] {
  const per = new Map<string, BalancSortida[]>()
  for (const f of fetes) {
    if (f.foraDelCoixi !== null) continue
    const llista = per.get(f.etapa)
    if (llista) llista.push(f)
    else per.set(f.etapa, [f])
  }

  const files: FilaEtapa[] = []
  for (const [etapa, sortides] of per) {
    const cost = sortides.reduce((s, f) => s + f.haCostat, 0)
    if (mesura === 'total') { files.push({ etapa, valor: cost }); continue }
    if (mesura === 'coixi') {
      files.push({ etapa, valor: sortides.reduce((s, f) => s + f.coixi, 0) })
      continue
    }
    const assistents = sortides.reduce((s, f) => s + f.assistents, 0)
    // Cap assistent vol dir cap sortida amb pagaments: l'etapa no hi surt,
    // que és millor que una barra amb «Infinity €».
    if (assistents > 0) files.push({ etapa, valor: cost / assistents })
  }
  return files.sort((a, b) => a.etapa.localeCompare(b.etapa))
}
```

- [ ] **Step 4: Executa i comprova que passen**

Run: `npx vitest run src/modules/excursions/balanc.test.ts`
Expected: PASS, 34 proves.

- [ ] **Step 5: Comprova amb una mutació**

Canvia `compten` perquè no filtri res (`const compten = fetes`) i torna a executar: ha de fallar **la prova de la feta sense pagaments**. Desfés-ho. Escriu a l'informe què ha fallat.

- [ ] **Step 6: Commit**

```bash
git add src/modules/excursions/balanc.ts src/modules/excursions/balanc.test.ts
git commit -m "feat(economia): el resum del curs i el repartiment per etapa"
```

---

### Task 3: Llegir les dades d'un curs

**Files:**
- Create: `src/modules/excursions/useBalanc.ts`
- Test: `src/modules/excursions/useBalanc.test.ts`

**Interfaces:**
- Consumes: `DadesSortida` de la Task 1; `getAll` de `src/services/db`.
- Produces: `useBalanc` (store de Zustand) amb `{ sortides: DadesSortida[], loading: boolean, error: string | null, carrega: (curs: string) => Promise<void> }`.

**Context que et cal i que no pots endevinar:**

- `getAll<T>(table, orderBy, filters, primaryKey)` és a `src/services/db.ts`. `excursio_finances` té la clau primària a `excursio_id`, no a `id`: la crida ha de ser `getAll<FinancesRow>('excursio_finances', 'excursio_id', {}, 'excursio_id')`. Mira `useFinances.ts:41` com ho fa.
- **PostgREST torna els `numeric` com a cadena.** `useFinances.ts` declara els camps com a `string | number` i els passa per `Number()`. Fes igual o els imports se sumaran com a text.
- Els noms de taula: `excursions`, `excursio_grups`, `excursio_finances`, `excursio_autocars`. La constant `TAULA_EXCURSIONS` és a `excursions.utils.ts`.
- **`alumnes_pagats` pot arribar `null`** encara que la columna sigui `NOT NULL` (memòria cau de PostgREST d'abans de la migració). `useExcursions.ts:12` ho documenta. Fes `?? 0`.
- **Zero files de finances no és cap error**: o no s'hi ha entrat res, o qui mira no té accés i l'RLS no en torna cap. `useFinances.ts:45` ho diu. Una sortida sense fila de finances té costos a zero.
- Copia el patró de `generacio` de `useExcursions.ts:30` perquè dues càrregues seguides no es pisin.

- [ ] **Step 1: Escriu les proves que fallen**

Crea `src/modules/excursions/useBalanc.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as db from '../../services/db'
import { useBalanc } from './useBalanc'

vi.mock('../../services/db', () => ({ getAll: vi.fn() }))

const files: Record<string, unknown[]> = {}

beforeEach(() => {
  useBalanc.setState({ sortides: [], loading: false, error: null })
  // Imprescindible: `vitest.config.ts` no té `clearMocks`, així que sense
  // això l'historial de crides s'acumula entre proves i `mock.calls[0]`
  // seria la crida d'una altra prova. Mateix patró que `useExcursions.test.ts`.
  vi.clearAllMocks()
  files.excursions = [{
    id: 'e1', lloc: 'Can Montcau', etapa: 'EP', data: '2026-11-18',
    estat: 'Reservada', preu_alumne: '30.00', curs_escolar: '2026-2027',
  }]
  files.excursio_grups = [
    { id: 'g1', excursio_id: 'e1', alumnes_previstos: 26, alumnes_pagats: 20 },
  ]
  files.excursio_finances = [{
    excursio_id: 'e1', preu_activitat: '8.00', preu_activitat_tipus: 'per_alumne',
    ampa_import: '4.00', ampa_cobreix_activitat: false, cost_acompanyants: '45.00',
    previsio_usada: '0.750', iva_pct_usat: '10.00',
  }]
  files.excursio_autocars = [{ id: 'a1', excursio_id: 'e1', preu: '500.00' }]
  vi.mocked(db.getAll).mockImplementation((taula: string) =>
    Promise.resolve((files[taula] ?? []) as never[]))
})

describe('carregar les dades econòmiques d’un curs', () => {
  it('converteix els números que arriben com a text', async () => {
    await useBalanc.getState().carrega('2026-2027')
    const s = useBalanc.getState().sortides[0]
    expect(s.preuAlumne).toBe(30)
    expect(s.autocars).toEqual([500])
    expect(s.costAcompanyants).toBe(45)
    expect(s.ivaPct).toBe(10)
    expect(s.previsio).toBe(0.75)
  })

  it('suma els grups de cada sortida', async () => {
    files.excursio_grups = [
      { id: 'g1', excursio_id: 'e1', alumnes_previstos: 26, alumnes_pagats: 20 },
      { id: 'g2', excursio_id: 'e1', alumnes_previstos: 24, alumnes_pagats: 18 },
      { id: 'g3', excursio_id: 'altra', alumnes_previstos: 99, alumnes_pagats: 99 },
    ]
    await useBalanc.getState().carrega('2026-2027')
    const s = useBalanc.getState().sortides[0]
    expect(s.previstos).toBe(50)
    expect(s.assistents).toBe(38)
  })

  it('un `alumnes_pagats` nul compta com a zero', async () => {
    files.excursio_grups = [
      { id: 'g1', excursio_id: 'e1', alumnes_previstos: 26, alumnes_pagats: null },
    ]
    await useBalanc.getState().carrega('2026-2027')
    expect(useBalanc.getState().sortides[0].assistents).toBe(0)
  })

  it('una sortida sense fila de finances no és un error: té els costos a zero', async () => {
    // Passa quan encara no s'hi ha entrat res, i també quan qui mira no té
    // accés als diners i l'RLS no li'n torna cap fila.
    files.excursio_finances = []
    files.excursio_autocars = []
    await useBalanc.getState().carrega('2026-2027')
    const s = useBalanc.getState().sortides[0]
    expect(s.preuActivitat).toBe(0)
    expect(s.costAcompanyants).toBe(0)
    expect(s.autocars).toEqual([])
    expect(useBalanc.getState().error).toBeNull()
  })

  it('sense paràmetres congelats fa servir els de sempre', async () => {
    // `previsio_usada` i `iva_pct_usat` només s'omplen en confirmar el preu.
    files.excursio_finances = [{
      excursio_id: 'e1', preu_activitat: '0', preu_activitat_tipus: 'per_alumne',
      ampa_import: '0', ampa_cobreix_activitat: false, cost_acompanyants: '0',
      previsio_usada: null, iva_pct_usat: null,
    }]
    await useBalanc.getState().carrega('2026-2027')
    const s = useBalanc.getState().sortides[0]
    expect(s.previsio).toBe(0.75)
    expect(s.ivaPct).toBe(10)
  })

  it('un preu no confirmat arriba com a null i no com a zero', async () => {
    files.excursions = [{ ...(files.excursions[0] as object), preu_alumne: null }]
    await useBalanc.getState().carrega('2026-2027')
    expect(useBalanc.getState().sortides[0].preuAlumne).toBeNull()
  })

  it('demana només el curs que li han dit', async () => {
    await useBalanc.getState().carrega('2025-2026')
    expect(vi.mocked(db.getAll).mock.calls[0][2]).toEqual({ curs_escolar: '2025-2026' })
  })

  it('un error de lectura es queda al store i no peta', async () => {
    vi.mocked(db.getAll).mockRejectedValue(new Error('Error llegint excursions: nope'))
    await useBalanc.getState().carrega('2026-2027')
    expect(useBalanc.getState().error).toContain('nope')
    expect(useBalanc.getState().loading).toBe(false)
  })
})
```

- [ ] **Step 2: Executa-les i comprova que fallen**

Run: `npx vitest run src/modules/excursions/useBalanc.test.ts`
Expected: FAIL — «Failed to resolve import "./useBalanc"».

- [ ] **Step 3: Implementa-ho**

Crea `src/modules/excursions/useBalanc.ts`:

```ts
import { create } from 'zustand'
import { getAll } from '../../services/db'
import { TAULA_EXCURSIONS } from './excursions.utils'
import type { DadesSortida } from './balanc'

// PostgREST torna els `numeric` com a cadena. Declarar-ho i passar-ho per
// `Number()` evita que els imports se sumin com a text. Mateix criteri que
// `useFinances.ts`.
interface ExcursioRow {
  id: string; lloc: string; etapa: string; data: string | null
  estat: string; preu_alumne: string | number | null
}
interface GrupRow {
  excursio_id: string; alumnes_previstos: number; alumnes_pagats: number | null
}
interface FinancesRow {
  excursio_id: string
  preu_activitat: string | number
  preu_activitat_tipus: 'per_alumne' | 'total'
  ampa_import: string | number
  ampa_cobreix_activitat: boolean
  cost_acompanyants: string | number
  previsio_usada: string | number | null
  iva_pct_usat: string | number | null
}
interface AutocarRow { excursio_id: string; preu: string | number }

const n = (v: string | number | null | undefined, defecte = 0): number => {
  // `Number(null)` és `0`, no `NaN`: cal descartar `null`/`undefined` abans
  // de convertir, o un valor encara no congelat («previsio_usada» abans de
  // confirmar el preu) es llegiria com a zero en comptes del valor de sempre.
  if (v === null || v === undefined) return defecte
  const x = Number(v)
  return Number.isFinite(x) ? x : defecte
}

interface BalancState {
  sortides: DadesSortida[]
  loading: boolean
  error: string | null
  carrega: (curs: string) => Promise<void>
}

// Si se'n demanen dos seguits, només val el darrer: si no, la resposta lenta
// d'un curs anterior podria pisar la del curs que s'està mirant. Mateix
// criteri que `useExcursions.load`.
let generacio = 0

export const useBalanc = create<BalancState>((set) => ({
  sortides: [],
  loading: false,
  error: null,

  async carrega(curs) {
    const meva = ++generacio
    set({ loading: true, error: null })
    try {
      const [excursions, grups, finances, autocars] = await Promise.all([
        getAll<ExcursioRow>(TAULA_EXCURSIONS, 'data', { curs_escolar: curs }),
        getAll<GrupRow>('excursio_grups', 'grup'),
        getAll<FinancesRow>('excursio_finances', 'excursio_id', {}, 'excursio_id'),
        getAll<AutocarRow>('excursio_autocars', 'id'),
      ])
      if (meva !== generacio) return

      set({ sortides: excursions.map((e) => {
        const meus = grups.filter((g) => g.excursio_id === e.id)
        // Zero files de finances no és cap error: o no s'hi ha entrat res, o
        // qui mira no té accés als diners i l'RLS no li'n torna cap. En tots
        // dos casos la sortida té els costos a zero.
        const f = finances.find((x) => x.excursio_id === e.id)
        return {
          id: e.id, lloc: e.lloc, etapa: e.etapa, data: e.data, estat: e.estat,
          previstos: meus.reduce((s, g) => s + g.alumnes_previstos, 0),
          // Mai `null`: «ningú no ha pagat» és zero, no un desconegut.
          assistents: meus.reduce((s, g) => s + (g.alumnes_pagats ?? 0), 0),
          // `null` i zero no són el mateix: sense preu confirmat no hi ha cap
          // ingrés possible, i el balanç ho ha de poder distingir.
          preuAlumne: e.preu_alumne === null ? null : n(e.preu_alumne),
          autocars: autocars.filter((a) => a.excursio_id === e.id).map((a) => n(a.preu)),
          preuActivitat: n(f?.preu_activitat),
          preuActivitatTipus: f?.preu_activitat_tipus ?? 'per_alumne',
          ampaImport: n(f?.ampa_import),
          ampaCobreixActivitat: f?.ampa_cobreix_activitat ?? false,
          costAcompanyants: n(f?.cost_acompanyants),
          // Els congelats en confirmar el preu. Mentre no s'ha confirmat són
          // nuls, i llavors val més el valor de sempre del centre que un NaN.
          previsio: n(f?.previsio_usada, 0.75),
          ivaPct: n(f?.iva_pct_usat, 10),
        }
      }) })
    } catch (err) {
      if (meva === generacio) {
        set({ error: err instanceof Error ? err.message : 'Error carregant les dades econòmiques' })
      }
    } finally {
      if (meva === generacio) set({ loading: false })
    }
  },
}))
```

- [ ] **Step 4: Executa i comprova que passen**

Run: `npx vitest run src/modules/excursions/useBalanc.test.ts`
Expected: PASS, 8 proves.

- [ ] **Step 5: Totes les portes**

Run: `npm run lint && npm run typecheck && npm test`
<!-- El tsconfig.json de l'arrel només té "references"; sense `-b` no compila cap fitxer. -->
Expected: tot verd. **Apunta el nombre de fitxers de prova, no només el de proves.**

- [ ] **Step 6: Commit**

```bash
git add src/modules/excursions/useBalanc.ts src/modules/excursions/useBalanc.test.ts
git commit -m "feat(economia): llegir les dades econòmiques d'un curs sencer"
```

---

### Task 4: La pantalla

**Files:**
- Create: `src/modules/excursions/GraficEtapes.tsx`
- Create: `src/modules/excursions/PanellEconomic.tsx`

**Interfaces:**
- Consumes: `ResumCurs`, `BalancSortida`, `MesuraEtapa`, `perEtapa` de les Tasks 1-2.
- Produces: `<GraficEtapes fetes={...} />` i `<PanellEconomic resum={...} curs={...} cursos={...} loading={...} error={...} onCurs={...} />`.

**Restriccions d'aquesta tasca:**

- **Cap lògica de càlcul dins els `.tsx`.** No hi ha proves de components (Vitest corre sense DOM), així que tot el que es pugui provar ja viu a `balanc.ts`. Si et cal una decisió nova, va allà amb la seva prova, no aquí.
- Tailwind, i els colors que ja fa servir el mòdul: verd `text-emerald-700`, vermell `text-red-700`, gris de text secundari `text-gray-500` (**mai `text-gray-400` per a text que s'hagi de llegir** — el contrast no hi arriba).
- Responsiu: les quatre xifres en fila a partir de `sm:`, apilades per sota.

- [ ] **Step 1: El gràfic**

Crea `src/modules/excursions/GraficEtapes.tsx`:

```tsx
import { useState } from 'react'
import { perEtapa, type BalancSortida, type MesuraEtapa } from './balanc'

const MESURES: { clau: MesuraEtapa; etiqueta: string; ajuda: string }[] = [
  { clau: 'total', etiqueta: 'Total gastat', ajuda: 'On van els diners. La més alta sol ser la que té més alumnes, no la més cara.' },
  { clau: 'per_alumne', etiqueta: 'Per alumne', ajuda: 'El que costa portar-hi un alumne. És l’única xifra comparable entre etapes.' },
  { clau: 'coixi', etiqueta: 'Coixí', ajuda: 'Quina etapa es queda curta.' },
]

const eur = (n: number) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR' })

export function GraficEtapes({ fetes }: { fetes: BalancSortida[] }) {
  const [mesura, setMesura] = useState<MesuraEtapa>('total')
  const files = perEtapa(fetes, mesura)

  // Amb una sola barra no es compara res, i amb cap no hi ha gràfic possible.
  if (files.length < 2) return null

  // L'escala es fa amb el valor absolut més gran perquè el coixí pot ser
  // negatiu i una barra negativa ha de poder créixer cap avall.
  const sostre = Math.max(...files.map((f) => Math.abs(f.valor))) || 1
  const ajuda = MESURES.find((m) => m.clau === mesura)?.ajuda ?? ''

  return (
    <section className="mb-6">
      <div className="inline-flex bg-gray-100 rounded-xl p-0.5 gap-0.5 mb-1" role="tablist">
        {MESURES.map((m) => (
          <button
            key={m.clau}
            role="tab"
            aria-selected={mesura === m.clau}
            onClick={() => setMesura(m.clau)}
            className={`text-xs px-3 py-1 rounded-lg ${
              mesura === m.clau ? 'bg-white text-text-main font-medium shadow-sm' : 'text-gray-500'
            }`}
          >
            {m.etiqueta}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mb-3">{ajuda}</p>

      <div className="flex items-end gap-4 h-28">
        {files.map((f) => (
          <div key={f.etapa} className="flex-1 flex flex-col justify-end items-center gap-1">
            <span className={`text-xs font-semibold ${
              mesura === 'coixi' ? (f.valor < 0 ? 'text-red-700' : 'text-emerald-700') : 'text-text-main'
            }`}>{eur(f.valor)}</span>
            <div
              className={`w-full rounded-t-md ${
                mesura === 'coixi' && f.valor < 0 ? 'bg-red-300' : 'bg-indigo-300'
              }`}
              style={{ height: `${Math.max(4, (Math.abs(f.valor) / sostre) * 80)}px` }}
            />
            <span className="text-[11px] text-gray-500">{f.etapa}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: La pantalla**

Crea `src/modules/excursions/PanellEconomic.tsx`:

```tsx
import { GraficEtapes } from './GraficEtapes'
import type { ResumCurs, MotiuFora } from './balanc'

const eur = (n: number) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR' })

const MOTIUS: Record<MotiuFora, string> = {
  'sense-pagaments': 'sense pagaments apuntats',
  'sense-preu': 'sense preu confirmat',
}

/** Una xifra gran amb el seu denominador a sota: una xifra sola no es pot jutjar. */
function Xifra({ etiqueta, valor, detall, to }: {
  etiqueta: string
  valor: string
  detall: string
  to?: 'verd' | 'roig'
}) {
  return (
    <div className="sm:flex-1 sm:min-w-[128px] border border-gray-200 rounded-xl px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">{etiqueta}</p>
      <p className={`text-xl font-semibold ${
        to === 'verd' ? 'text-emerald-700' : to === 'roig' ? 'text-red-700' : 'text-text-main'
      }`}>{valor}</p>
      <p className="text-[10px] text-gray-500 mt-0.5">{detall}</p>
    </div>
  )
}

export function PanellEconomic({ resum, curs, cursos, loading, error, onCurs }: {
  resum: ResumCurs
  curs: string
  cursos: string[]
  loading: boolean
  error: string | null
  onCurs: (curs: string) => void
}) {
  const { fetes, perVenir, foraDelCoixi, totals } = resum
  const compten = fetes.length - foraDelCoixi.length
  // Cap sortida tancada no és «zero euros»: un 0 € es llegiria com que s'ha
  // perdut tot, i el que passa és que encara no hi ha res a dir.
  const resTancat = compten === 0

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <h1 className="text-lg font-semibold text-text-main">Economia de les sortides</h1>
        <div className="flex items-center gap-2">
          <select
            value={curs}
            onChange={(ev) => onCurs(ev.target.value)}
            aria-label="Curs escolar"
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm"
          >
            {cursos.map((c) => <option key={c} value={c}>Curs {c}</option>)}
          </select>
          {/* Apagat i amb el motiu escrit, no amagat: amagar-lo faria pensar
              que la comparació no existeix. */}
          <span className="text-xs text-gray-500" title="Farà falta un segon curs amb sortides per poder comparar.">
            Comparar entre cursos: quan hi hagi un segon curs
          </span>
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-red-700 mb-4">{error}</p>}
      {loading && <p className="text-xs text-gray-500 mb-4">Carregant…</p>}

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5 mb-5">
        <Xifra
          etiqueta="Ha entrat"
          valor={resTancat ? '—' : eur(totals.haEntrat)}
          detall={resTancat ? 'cap sortida tancada encara' : `de ${compten} sortides fetes`}
        />
        <Xifra
          etiqueta="Ha costat"
          valor={resTancat ? '—' : eur(totals.haCostat)}
          detall="autocars, activitats i acompanyants"
        />
        <Xifra
          etiqueta="Coixí"
          valor={resTancat ? '—' : eur(totals.coixi)}
          detall={resTancat ? 'no hi ha res tancat' : totals.coixi < 0 ? 'no cobreix' : 'cobreix'}
          to={resTancat ? undefined : totals.coixi < 0 ? 'roig' : 'verd'}
        />
        <Xifra
          etiqueta="Pendent de cobrar"
          valor={eur(totals.pendent)}
          detall={`${perVenir.length} ${perVenir.length === 1 ? 'sortida' : 'sortides'} per venir`}
        />
      </div>

      <GraficEtapes fetes={fetes} />

      <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">
        Fetes — {fetes.length} {fetes.length === 1 ? 'sortida' : 'sortides'}
      </p>
      {fetes.length === 0
        ? <p className="text-sm text-gray-500 italic mb-5">Encara no ha passat cap sortida d’aquest curs.</p>
        : (
          <div className="overflow-x-auto mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-gray-500">
                  <th className="text-left font-medium py-1.5 px-2 border-b border-gray-200">Sortida</th>
                  <th className="text-left font-medium py-1.5 px-2 border-b border-gray-200">Etapa</th>
                  <th className="text-right font-medium py-1.5 px-2 border-b border-gray-200">Paguen</th>
                  <th className="text-right font-medium py-1.5 px-2 border-b border-gray-200">Ha costat</th>
                  <th className="text-right font-medium py-1.5 px-2 border-b border-gray-200">Ha entrat</th>
                  <th className="text-right font-medium py-1.5 px-2 border-b border-gray-200">Coixí</th>
                </tr>
              </thead>
              <tbody>
                {fetes.map((f) => (
                  <tr key={f.id} className="border-b border-gray-100">
                    <td className="py-1.5 px-2 text-text-main">{f.lloc}</td>
                    <td className="py-1.5 px-2 text-gray-500">{f.etapa}</td>
                    <td className="py-1.5 px-2 text-right text-gray-500">{f.assistents} / {f.previstos}</td>
                    <td className="py-1.5 px-2 text-right">{eur(f.haCostat)}</td>
                    <td className="py-1.5 px-2 text-right">{f.foraDelCoixi ? '—' : eur(f.haEntrat)}</td>
                    <td className={`py-1.5 px-2 text-right ${
                      f.foraDelCoixi ? 'text-gray-500' : f.coixi < 0 ? 'text-red-700' : 'text-emerald-700'
                    }`}>
                      {f.foraDelCoixi ? MOTIUS[f.foraDelCoixi] : eur(f.coixi)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">
        Per venir — {perVenir.length} {perVenir.length === 1 ? 'sortida' : 'sortides'}
      </p>
      {perVenir.length === 0
        ? <p className="text-sm text-gray-500 italic">No queda cap sortida aprovada per fer aquest curs.</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-gray-500">
                  <th className="text-left font-medium py-1.5 px-2 border-b border-gray-200">Sortida</th>
                  <th className="text-left font-medium py-1.5 px-2 border-b border-gray-200">Etapa</th>
                  <th className="text-right font-medium py-1.5 px-2 border-b border-gray-200">Data</th>
                  <th className="text-right font-medium py-1.5 px-2 border-b border-gray-200">Costarà</th>
                  <th className="text-right font-medium py-1.5 px-2 border-b border-gray-200">Hauria d’entrar</th>
                  <th className="text-right font-medium py-1.5 px-2 border-b border-gray-200">Cobrat</th>
                </tr>
              </thead>
              <tbody>
                {perVenir.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-1.5 px-2 text-text-main">{p.lloc}</td>
                    <td className="py-1.5 px-2 text-gray-500">{p.etapa}</td>
                    <td className="py-1.5 px-2 text-right text-gray-500">{p.data ?? 'sense data'}</td>
                    <td className="py-1.5 px-2 text-right">{eur(p.costara)}</td>
                    <td className="py-1.5 px-2 text-right">
                      {p.hauriaDEntrar === null ? 'falta confirmar el preu' : eur(p.hauriaDEntrar)}
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-500">
                      {p.cobrat === 0 ? '—' : eur(p.cobrat)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {foraDelCoixi.length > 0 && (
        <div className="mt-5 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <strong>
            {foraDelCoixi.length === 1
              ? '1 sortida feta no compta al coixí'
              : `${foraDelCoixi.length} sortides fetes no compten al coixí`}
          </strong>
          {' — '}
          {foraDelCoixi.map((f) => `${f.lloc} (${MOTIUS[f.foraDelCoixi as MotiuFora]})`).join(', ')}.
          {' '}Sense aquestes dades, la xifra diria que s’hi ha perdut tot el que ha costat.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Comprova que compila i que el linter hi està d'acord**

Run: `npm run typecheck && npm run lint`
Expected: tot verd. Si `text-text-main` no existeix al tema de Tailwind, mira quina classe fan servir `ExcursionsPage.tsx` i `ExcursioDetall.tsx` i usa la mateixa.

- [ ] **Step 4: Commit**

```bash
git add src/modules/excursions/GraficEtapes.tsx src/modules/excursions/PanellEconomic.tsx
git commit -m "feat(economia): la pantalla del panell"
```

---

### Task 5: La ruta, els permisos i l'enllaç

**Files:**
- Create: `src/app/routes/EconomiaWrapper.tsx`
- Modify: `src/App.tsx` (afegir la ruta al costat de la d'`/excursions`, ~línia 107)
- Modify: `src/modules/excursions/ExcursionsPage.tsx` (l'enllaç, a la capçalera on ja hi ha el botó d'actualitzar, ~línia 69)

**Interfaces:**
- Consumes: `useBalanc` (Task 3), `resumCurs` (Task 2), `PanellEconomic` (Task 4), `potVeureCostos` de `src/modules/excursions/permisos.ts`.
- Produces: la ruta `/excursions/economia`.

**Context que et cal:**

- Les rutes viuen a `src/App.tsx`, dins `<Routes>`, i les d'aquest mòdul van embolicades amb `<VisibilitatGuard visKey="excursions">`. Copia el patró de la línia de `/excursions`.
- **`VisibilitatGuard` sol no n'hi ha prou**: només mira que el mòdul sigui visible, no que qui mira pugui veure els diners. El wrapper ha de comprovar `potVeureCostos(rol, jo)` i, si no, no ensenyar el panell.
- Com s'obté qui ets: `useUsuarisStore((s) => s.rol)`, `useAuthStore((s) => s.user?.email)`, i el teu `Usuari` es troba a `usuaris` per email en minúscules. Copia les sis primeres línies del cos d'`ExcursionsWrapper.tsx`.
- `schoolYear()` és a `src/utils/schoolCalendar`.
- El router és **HashRouter**: els enllaços interns van amb `<Link to="/excursions/economia">` de `react-router-dom`, mai amb `href`.

- [ ] **Step 1: El wrapper**

Crea `src/app/routes/EconomiaWrapper.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { PanellEconomic } from '../../modules/excursions/PanellEconomic'
import { useBalanc } from '../../modules/excursions/useBalanc'
import { resumCurs } from '../../modules/excursions/balanc'
import { potVeureCostos } from '../../modules/excursions/permisos'
import { useUsuarisStore } from '../../store/usuarisStore'
import { useAuthStore } from '../../store/authStore'
import { schoolYear } from '../../utils/schoolCalendar'

export default function EconomiaWrapper() {
  const rol = useUsuarisStore((s) => s.rol)
  const usuaris = useUsuarisStore((s) => s.usuaris)
  const email = (useAuthStore((s) => s.user?.email) ?? '').toLowerCase()
  const jo = usuaris.find((u) => u.Email.toLowerCase() === email) ?? null
  const potVeure = potVeureCostos(rol, jo)

  const { sortides, loading, error, carrega } = useBalanc()
  const [curs, setCurs] = useState(schoolYear())

  useEffect(() => { if (potVeure) void carrega(curs) }, [carrega, curs, potVeure])

  // `avui` es calcula aquí, al límit de l'aplicació, i entra al càlcul com a
  // argument: cap funció de `balanc.ts` mira el rellotge, i així les proves
  // poden situar-se on vulguin.
  const resum = useMemo(() => resumCurs(sortides, new Date().toISOString().slice(0, 10)), [sortides])

  if (!potVeure) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">
          Aquesta pantalla ensenya els costos de les sortides i només la veu qui els gestiona.
        </p>
      </div>
    )
  }

  return (
    <PanellEconomic
      resum={resum}
      curs={curs}
      cursos={[curs]}
      loading={loading}
      error={error}
      onCurs={setCurs}
    />
  )
}
```

- [ ] **Step 2: La ruta**

A `src/App.tsx`, al costat de la línia de `/excursions`:

```tsx
<Route
  path="/excursions/economia"
  element={<VisibilitatGuard visKey="excursions"><EconomiaWrapper /></VisibilitatGuard>}
/>
```

L'import ha de seguir el patró de càrrega mandrosa dels altres wrappers d'aquest fitxer. Mira com s'importa `ExcursionsWrapper` i fes exactament igual.

- [ ] **Step 3: L'enllaç**

A `src/modules/excursions/ExcursionsPage.tsx`, a la capçalera on ja hi ha el botó d'actualitzar (~línia 69), afegeix-hi un enllaç **que només es dibuixi si `potVeureCostos`**. `ExcursionsPage` no rep avui aquest booleà: afegeix-li la propietat `potVeureCostos: boolean` i passa-la des d'`ExcursionsWrapper.tsx`, que ja calcula `potVeureCostos(rol, jo)` per a `ExcursioDetall`.

```tsx
{potVeureCostos && (
  <Link
    to="/excursions/economia"
    className="text-xs text-gray-500 hover:text-text-main px-2 py-1"
  >
    Economia
  </Link>
)}
```

- [ ] **Step 4: Totes les portes**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: tot verd. **Informa del nombre de fitxers de prova, no només del de proves.**

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/app/routes/EconomiaWrapper.tsx src/modules/excursions/ExcursionsPage.tsx
git commit -m "feat(economia): la ruta, els permisos i l'enllaç des d'Excursions"
```

---

## Comprovació manual abans de fusionar

No es pot provar amb Vitest i és el que de debò veurà Direcció:

1. `npm run dev`, entra com a coordinador i ves a Excursions → **Economia**.
2. Amb la sortida que hi ha a producció (una, sense pagaments apuntats i encara per venir): les tres primeres xifres han de sortir amb un guionet i el seu motiu, **no amb 0 €**; no hi ha d'haver gràfic; i la taula de fetes ha de dir que encara no ha passat cap sortida.
3. Apunta-hi pagaments i mira que «Pendent de cobrar» baixi.
4. Entra com un docent sense la casella de costos: l'enllaç **no** hi ha de ser, i anar a `#/excursions/economia` a mà ha de donar l'explicació, no el panell.

## Què no entra

Pressupostos per etapa; exportar a Excel; importar el curs 2022-23; penyores de cancel·lació; i la comparació entre dos cursos, que necessita un segon curs amb dades i avui no en tindria cap.
