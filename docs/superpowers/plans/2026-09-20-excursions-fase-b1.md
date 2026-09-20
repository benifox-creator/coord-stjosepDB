# Excursions Fase B1 — els diners

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que l'aplicació calculi el preu per alumne d'una excursió i el congeli, amb els costos desats en taules que el professorat no pot llegir.

**Architecture:** Dues taules noves amb RLS pròpia (`excursio_finances`, `excursio_autocars`) perquè el servidor senzillament no enviï els diners a qui no els ha de veure — les polítiques de PostgreSQL són per fila, no per columna. El càlcul viu en una funció pura de TypeScript provada contra les 43 excursions reals de l'Excel; confirmar el preu és una transició d'estat imposada per disparador, com la resta del mòdul.

**Tech Stack:** PostgreSQL 17 (Supabase) · React 19 + TypeScript estricte · Zustand · Vitest + PGlite · xlsx (ja al projecte, només per extreure el fixture)

**Spec:** `docs/superpowers/specs/2026-09-18-excursions-design.md` (apartats 3, 4, 6 i 9)

## Global Constraints

- **Fase B1 no toca la circular ni la petició de pressupostos.** Això és la Fase B2. Aquí els costos s'escriuen a mà.
- **Cap dada d'alumnat.** Les excursions es gestionen per grup i per nombre d'alumnes (spec §13).
- El professorat amb **només** `pot_gestionar_excursions` **no ha de poder llegir** `excursio_finances` ni `excursio_autocars`, ni per l'API (spec §3).
- TypeScript estricte: `verbatimModuleSyntax` (cal `import type` per als tipus) i `noUnusedLocals`.
- Els textos de la interfície van **en català**.
- Els valors de `config` es desen sempre com a **llista de cadenes**, també els números: `['12']`, no `12` (patró de `material-infantil.marge-seguretat-pct`).
- Les migracions **no es toquen un cop aplicades a producció**; cada canvi és una migració nova. `supabase/schema.sql` **no es toca mai**: s'executa abans que les migracions.
- Tota taula nova necessita **GRANT explícit** a més de l'RLS: `revoke all from anon` + `grant select, insert, update, delete to authenticated`. L'RLS filtra files; el GRANT dona accés a la taula. Calen les dues coses.
- Tota taula nova s'afegeix al disparador d'auditoria (`app_private.audit_change()`) i al fre d'esborrats (`app_private.fre_esborrats`).
- Paràmetres per defecte (spec §6): previsió **0,80** a EI i EP i **0,75** a la resta · marge **12 %** per etapa · IVA transport **10 %** · arrodoniment **0,50 €** cap amunt.

---

## Estructura de fitxers

| Fitxer | Responsabilitat |
|---|---|
| `supabase/migrations/202609210001_excursions_finances.sql` | Les dues taules, RLS, GRANTs, auditoria, fre d'esborrats |
| `supabase/migrations/202609210002_confirmar_preu.sql` | Columnes de preu a `excursions` i la transició `confirmar_preu` |
| `tests/fixtures/excursions-excel.json` | Les 43 excursions reals extretes de l'Excel (fixture de proves) |
| `scripts/extreu-excursions-excel.mjs` | L'script que la va generar, perquè es pugui repetir |
| `src/modules/excursions/preu.ts` | **El càlcul, funció pura.** Cap crida a xarxa, cap React |
| `src/modules/excursions/preu.test.ts` | Proves del càlcul, incloses les 43 reals |
| `src/modules/excursions/parametres.ts` | Llegeix els paràmetres de `config` i els converteix a números |
| `src/modules/excursions/finances.types.ts` | Tipus de costos, separats de `types.ts` perquè no tothom els carrega |
| `src/modules/excursions/useFinances.ts` | Store dels costos d'una excursió |
| `src/modules/excursions/BlocEconomic.tsx` | El bloc de costos i preu dins la fitxa |
| `src/modules/excursions/ExcursioDetall.tsx` | Hi encaixa `BlocEconomic` (modificació) |
| `src/modules/configuracio/ConfiguracioPage.tsx` | Els paràmetres nous (modificació) |
| `src/store/configStore.ts` | Només les claus noves i els seus valors per defecte (modificació) |

`preu.ts` es manté **sense cap dependència** a propòsit: és l'única peça on un error costa diners de debò, i així es pot provar amb dades reals sense muntar res. Per això llegir la configuració viu en un fitxer a part (`parametres.ts`) i no dins `preu.ts`, i el `configStore` no importa res del mòdul: la dependència va del mòdul cap al store, com a la resta de l'aplicació.

**Les tres dates de la circular** (`data_circular`, `data_limit_pagament`, `data_limit_resguard`) **no entren aquí**, encara que el spec §6 digui que es desen en confirmar el preu. Són de la circular i van amb la Fase B2, que és qui les farà servir; desar-les ara seria deixar tres columnes que ningú llegeix durant setmanes. Qui faci la B2 ha de saber que **no hi són**.

---

### Task 1: El fixture de les 43 excursions reals

Sense aquestes dades, les proves del càlcul no valen res: qualsevol implementació passaria uns quants casos inventats. L'Excel del centre és l'única font de veritat de què havia de sortir.

**Files:**
- Create: `scripts/extreu-excursions-excel.mjs`
- Create: `tests/fixtures/excursions-excel.json`

**Interfaces:**
- Produces: `tests/fixtures/excursions-excel.json`, una llista d'objectes
  `{ lloc: string, curs: string, alumnes: number, acompanyants: number, autocars: number[], preuActivitat: number, previsio: number, ampaPerAlumne: number, preuExcel: number }`.
  `autocars` és el preu de cada autocar sense IVA; `preuExcel` és el preu per alumne que va calcular l'Excel abans d'arrodonir (columna "Preu Final").

- [ ] **Step 1: Escriure l'script d'extracció**

El full és `Final`. Les columnes es van verificar el 2026-09-20: 2=Lloc, 4=Curs, 5=`"alumnes+acompanyants"` (text), 6=places per autocar (text `"55+55"`), 9=preu total dels autocars, 10=preu activitat, 11=preu final calculat, 19=previsió, 20=aportació AMPA per alumne.

**Atenció a la columna 9:** és el **total** dels autocars, no el preu de cadascun. El desglossament per autocar és al full `Presupost autocar`. Per al fixture n'hi ha prou amb el total, perquè el càlcul els suma; es desa com una llista d'un sol element.

```js
// scripts/extreu-excursions-excel.mjs
// Extreu les excursions reals del curs 2022-23 de l'Excel del centre cap al
// fixture de proves. L'Excel no és al repositori (conté dades del centre);
// es passa per paràmetre.
//
// Ús: node scripts/extreu-excursions-excel.mjs "<ruta a Excursió Curs.xlsm>"
import * as XLSX from 'xlsx'
import { writeFileSync } from 'node:fs'

const origen = process.argv[2]
if (!origen) { console.error('Cal la ruta de l\'Excel'); process.exit(1) }

const wb = XLSX.readFile(origen)
const files = XLSX.utils.sheet_to_json(wb.Sheets['Final'], { header: 1, raw: true })

// "75+5" vol dir 75 alumnes i 5 acompanyants. De vegades només hi ha el primer.
function parteix(text) {
  const trossos = String(text ?? '').split('+').map(t => Number(t.trim()))
  return { alumnes: trossos[0] || 0, acompanyants: trossos[1] || 0 }
}

const excursions = []
for (const f of files) {
  if (typeof f[0] !== 'number' || !f[2]) continue   // files de títol i buides
  const { alumnes, acompanyants } = parteix(f[5])
  const preuExcel = Number(f[11])
  // Files amb dades mal registrades: sense alumnes o sense preu calculat no
  // es pot comprovar res. La spec ja comptava que n'hi hauria.
  if (!alumnes || !Number.isFinite(preuExcel) || preuExcel <= 0) continue
  excursions.push({
    lloc: String(f[2]),
    curs: String(f[4] ?? ''),
    alumnes,
    acompanyants,
    autocars: Number(f[9]) > 0 ? [Number(f[9])] : [],
    preuActivitat: Number(f[10]) || 0,
    previsio: Number(f[19]) || 0.75,
    ampaPerAlumne: Number(f[20]) || 0,
    preuExcel,
  })
}

writeFileSync('tests/fixtures/excursions-excel.json', JSON.stringify(excursions, null, 2) + '\n')
console.log(`${excursions.length} excursions desades`)
```

- [ ] **Step 2: Executar-lo**

```bash
mkdir -p tests/fixtures scripts
node scripts/extreu-excursions-excel.mjs "/Users/andresmorenoarroyo/Desktop/ClaudeProjectos/Coordinacion Digital/Excursió Curs.xlsm"
```

Esperat: diu quantes n'ha desat. **Si no en surten entre 40 i 48, atura't**: vol dir que les columnes no són les que es van verificar i la resta del pla es basa en dades equivocades.

- [ ] **Step 3: Mirar el fixture amb els propis ulls**

```bash
head -20 tests/fixtures/excursions-excel.json
```

Comprova que la primera excursió té un lloc reconeixible, alumnes > 0 i `preuExcel` entre 5 i 60. Un fixture generat malament que ningú mira és pitjor que no tenir-ne.

- [ ] **Step 4: Commit**

```bash
git add scripts/extreu-excursions-excel.mjs tests/fixtures/excursions-excel.json
git commit -m "test(excursions): les excursions reals de l'Excel com a fixture del càlcul"
```

---

### Task 2: El càlcul del preu

**Files:**
- Create: `src/modules/excursions/preu.ts`
- Create: `src/modules/excursions/preu.test.ts`

**Interfaces:**
- Consumes: `tests/fixtures/excursions-excel.json` de la Task 1.
- Produces:
  ```ts
  export interface ParametresPreu { previsio: number; margePct: number; ivaPct: number; arrodoniment: number }
  export interface CostosExcursio {
    alumnes: number; autocars: number[]
    preuActivitat: number; preuActivitatTipus: 'per_alumne' | 'total'
    ampaImport: number; ampaCobreixActivitat: boolean; costAcompanyants: number
  }
  export interface ResultatPreu { esperats: number; costosFixos: number; costAlumne: number; base: number; preu: number }
  export function calculaPreu(c: CostosExcursio, p: ParametresPreu): ResultatPreu
  export function arrodoneixAmunt(valor: number, pas: number): number
  ```

- [ ] **Step 1: Escriure les proves del cas senzill i les vores**

```ts
import { describe, it, expect } from 'vitest'
import { calculaPreu, arrodoneixAmunt, type CostosExcursio, type ParametresPreu } from './preu'

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
    expect(r.preu).toBe(arrodoneixAmunt(10 * 1.12, 0.5))
  })
})
```

- [ ] **Step 2: Executar-les i veure-les fallar**

Run: `npx vitest run src/modules/excursions/preu.test.ts`
Esperat: FAIL, «Failed to resolve import "./preu"».

- [ ] **Step 3: Escriure el càlcul**

```ts
// src/modules/excursions/preu.ts
//
// El càlcul del preu d'una excursió, aïllat de tota la resta a propòsit: és
// l'única peça del mòdul on un error costa diners de debò, i així es pot
// provar amb les excursions reals sense muntar ni base de dades ni React.
//
// Ordre (spec §6):
//   esperats     = alumnes × previsió
//   costos fixos = Σ autocars × (1 + IVA) + activitat (si és total) + acompanyants
//   cost alumne  = costos fixos ÷ esperats + activitat (si és per alumne)
//   base         = cost alumne − aportació AMPA
//   preu         = arrodonir amunt(base × (1 + marge))

export interface ParametresPreu {
  previsio: number
  margePct: number
  ivaPct: number
  arrodoniment: number
}

export interface CostosExcursio {
  alumnes: number
  autocars: number[]          // el preu de cadascun, sense IVA
  preuActivitat: number
  preuActivitatTipus: 'per_alumne' | 'total'
  ampaImport: number          // per alumne
  ampaCobreixActivitat: boolean
  costAcompanyants: number    // el que costa que hi vagin, no quants són
}

export interface ResultatPreu {
  esperats: number
  costosFixos: number
  costAlumne: number
  base: number
  preu: number
}

/**
 * Arrodoneix cap amunt al pas donat. Es treballa en cèntims perquè en coma
 * flotant 28.35 / 0.05 dona 566.9999… i el preu pujaria un graó sencer sense
 * cap motiu.
 */
export function arrodoneixAmunt(valor: number, pas: number): number {
  if (pas <= 0) return valor
  const passos = Math.ceil(Math.round((valor / pas) * 1e6) / 1e6)
  return Math.round(passos * pas * 100) / 100
}

export function calculaPreu(c: CostosExcursio, p: ParametresPreu): ResultatPreu {
  // **No s'arrodoneix.** Comprovat contra les excursions reals: amb 89 alumnes
  // i una previsió de 0,75 l'Excel reparteix entre 66,75 i no entre 67, i
  // arrodonir-ho aquí desquadra el preu. Els esperats s'arrodoneixen només en
  // ensenyar-los per pantalla, que és on «66,75 alumnes» no vol dir res.
  const esperats = c.alumnes * p.previsio

  // Si l'AMPA cobreix l'activitat, l'activitat val zero i tampoc no es resta
  // l'aportació: ja s'ha gastat aquí.
  const activitat = c.ampaCobreixActivitat ? 0 : c.preuActivitat
  const activitatTotal = c.preuActivitatTipus === 'total' ? activitat : 0
  const activitatPerAlumne = c.preuActivitatTipus === 'per_alumne' ? activitat : 0

  const transport = c.autocars.reduce((s, preu) => s + preu, 0) * (1 + p.ivaPct / 100)
  const costosFixos = transport + activitatTotal + c.costAcompanyants

  const costAlumne = esperats > 0 ? costosFixos / esperats + activitatPerAlumne : 0

  const ampa = c.ampaCobreixActivitat ? 0 : c.ampaImport
  const base = Math.max(0, costAlumne - ampa)

  return { esperats, costosFixos, costAlumne, base, preu: arrodoneixAmunt(base * (1 + p.margePct / 100), p.arrodoniment) }
}
```

- [ ] **Step 4: Executar-les i veure-les passar**

Run: `npx vitest run src/modules/excursions/preu.test.ts`
Esperat: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/excursions/preu.ts src/modules/excursions/preu.test.ts
git commit -m "feat(excursions): el càlcul del preu, aïllat i provat"
```

---

### Task 3: Provar el càlcul contra les 43 excursions reals

La prova que importa. Les anteriors diuen que el codi fa el que jo crec; aquesta diu que fa el que el centre ha estat cobrant.

**Files:**
- Modify: `src/modules/excursions/preu.test.ts`

**Interfaces:**
- Consumes: `calculaPreu` de la Task 2 i `tests/fixtures/excursions-excel.json` de la Task 1.

- [ ] **Step 1: Escriure la prova**

Es compara `costAlumne` (el cost per alumne abans del marge i de l'arrodoniment) amb el que va calcular l'Excel, perquè el marge del 12 % és una decisió nova: l'Excel no en tenia cap d'explícit. El que s'ha de conservar és **el cost**, no el preu de venda.

```ts
import excursionsReals from '../../../tests/fixtures/excursions-excel.json'

describe('contra les excursions reals del curs 2022-23', () => {
  it('reprodueix el cost per alumne que va calcular l’Excel, al cèntim', () => {
    const desviades: string[] = []
    for (const e of excursionsReals) {
      const r = calculaPreu(
        {
          alumnes: e.alumnes, autocars: e.autocars,
          preuActivitat: e.preuActivitat, preuActivitatTipus: 'per_alumne',
          // L'Excel no repercutia ni l'AMPA ni el cost dels acompanyants al
          // cost per alumne: per comparar-hi, aquí van a zero.
          ampaImport: 0, ampaCobreixActivitat: false, costAcompanyants: 0,
        },
        { previsio: e.previsio, margePct: 0, ivaPct: 0, arrodoniment: 0 },
      )
      if (Math.abs(r.costAlumne - e.preuExcel) > 0.01) {
        desviades.push(`${e.lloc} (${e.curs}): surt ${r.costAlumne.toFixed(2)}, l'Excel deia ${e.preuExcel.toFixed(2)}`)
      }
    }
    expect(desviades).toEqual([])
  })

  it('i n’hi ha prou com perquè la prova signifiqui alguna cosa', () => {
    // Si el fixture es buidés, la prova anterior passaria sense comprovar res.
    expect(excursionsReals.length).toBeGreaterThanOrEqual(40)
  })
})
```

- [ ] **Step 2: Executar-la**

Run: `npx vitest run src/modules/excursions/preu.test.ts`

**Si falla, no toquis la prova per fer-la passar.** Llegeix quines excursions es desvien i per què. Els preus de l'Excel ja porten l'IVA inclòs a la columna 9 (per això la prova passa `ivaPct: 0`); si les desviacions són totes d'un 10 %, el problema és aquest. Si només se'n desvien dues o tres, mira si són files amb dades mal registrades i **fes-ho constar al missatge del commit** en lloc d'amagar-ho: el spec ja diu que n'hi havia 4.

- [ ] **Step 3: Commit**

```bash
git add src/modules/excursions/preu.test.ts
git commit -m "test(excursions): el càlcul coincideix amb l'Excel en les excursions reals"
```

---

### Task 4: Les taules de costos, amb accés restringit

**Files:**
- Create: `supabase/migrations/202609210001_excursions_finances.sql`
- Modify: `tests/database.test.ts`

**Interfaces:**
- Produces: taules `public.excursio_finances` (PK `excursio_id`) i `public.excursio_autocars` (`id`, `excursio_id`, `places`, `preu`).

- [ ] **Step 1: Escriure les proves d'accés**

Al final de `tests/database.test.ts`. Mira com hi estan escrits els `describe` existents i segueix el mateix estil (`asUser(...)`, `db.query`). Cal un usuari amb **només** la casella de logística, que és el cas que ha de fallar.

```ts
describe('els diners de les excursions', () => {
  async function excursioAmbCostos() {
    await asUser('admin@stjosep.org')
    const id = (await db.query<{id:string}>(`
      insert into public.excursions(etapa,lloc,activitat,data,hora_sortida,hora_tornada,transport)
      values('EP','Prova','Prova','2026-10-20','09:00','13:00','autocar') returning id`)).rows[0].id
    await db.query(`insert into public.excursio_finances(excursio_id,preu_activitat) values($1,12)`,[id])
    await db.query(`insert into public.excursio_autocars(excursio_id,places,preu) values($1,55,406)`,[id])
    return id
  }

  it('un docent normal no en veu res', async () => {
    await excursioAmbCostos()
    await asUser('teacher@stjosep.org')
    // L'RLS no dona error: simplement no retorna files. Això és el que volem.
    expect((await db.query('select * from public.excursio_finances')).rows).toHaveLength(0)
    expect((await db.query('select * from public.excursio_autocars')).rows).toHaveLength(0)
  })

  it('ni un docent a qui s’ha activat la gestió: ajuda a organitzar, no veu diners', async () => {
    await excursioAmbCostos()
    await db.exec('reset role')
    await db.query(`update public.usuaris set pot_gestionar_excursions=true where email='teacher@stjosep.org'`)
    await asUser('teacher@stjosep.org')
    expect((await db.query('select * from public.excursio_finances')).rows).toHaveLength(0)
    expect((await db.query('select * from public.excursio_autocars')).rows).toHaveLength(0)
  })

  it('però Secretaria sí, que és qui els negocia', async () => {
    await excursioAmbCostos()
    await db.exec('reset role')
    await db.query(`update public.usuaris set pot_gestionar_costos_excursions=true where email='other@stjosep.org'`)
    await asUser('other@stjosep.org')
    expect((await db.query('select * from public.excursio_finances')).rows).toHaveLength(1)
    expect((await db.query('select * from public.excursio_autocars')).rows).toHaveLength(1)
  })

  it('i la direcció també', async () => {
    await excursioAmbCostos()
    await asUser('admin@stjosep.org')
    expect((await db.query('select * from public.excursio_finances')).rows).toHaveLength(1)
  })

  it('un docent amb gestió tampoc no en pot escriure', async () => {
    const id = await excursioAmbCostos()
    await db.exec('reset role')
    await db.query(`update public.usuaris set pot_gestionar_excursions=true where email='teacher@stjosep.org'`)
    await asUser('teacher@stjosep.org')
    // El savepoint va **abans** de la sentència que ha de fallar: a PostgreSQL
    // un error avorta la transacció sencera, i sense això la resta de la prova
    // petaria amb «current transaction is aborted» en comptes de comprovar res.
    await db.exec('savepoint intent')
    await db.query(`insert into public.excursio_autocars(excursio_id,places,preu) values($1,55,1)`,[id])
      .catch(() => { /* tant se val si l'RLS peta o si simplement no escriu: el que importa és que no hi entri */ })
    await db.exec('rollback to savepoint intent')
    await db.exec('reset role')
    expect((await db.query('select * from public.excursio_autocars')).rows).toHaveLength(1)
  })

  it('cada autocar és una fila, i per això tres autocars ja no trenquen res', async () => {
    const id = await excursioAmbCostos()
    await asUser('admin@stjosep.org')
    await db.query(`insert into public.excursio_autocars(excursio_id,places,preu) values($1,55,406),($1,55,406)`,[id])
    expect((await db.query('select * from public.excursio_autocars where excursio_id=$1',[id])).rows).toHaveLength(3)
  })

  it('esborrar l’excursió s’emporta els seus costos', async () => {
    const id = await excursioAmbCostos()
    await asUser('admin@stjosep.org')
    await db.query('delete from public.excursions where id=$1',[id])
    await db.exec('reset role')
    expect((await db.query('select * from public.excursio_finances')).rows).toHaveLength(0)
    expect((await db.query('select * from public.excursio_autocars')).rows).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Executar-les i veure-les fallar**

Run: `npx vitest run tests/database.test.ts -t "els diners"`
Esperat: FAIL amb «relation "public.excursio_finances" does not exist».

- [ ] **Step 3: Escriure la migració**

```sql
begin;

-- Taules separades i no columnes amagades a `excursions`: les polítiques de
-- PostgreSQL són per fila, no per columna, i tothom entra amb el mateix tipus
-- de sessió. Amagar els costos només a la pantalla els deixaria a l'abast de
-- qualsevol que demanés les dades directament a l'API. Així el servidor
-- senzillament no els envia.
create table if not exists public.excursio_finances (
  excursio_id uuid primary key references public.excursions(id) on delete cascade,
  preu_activitat numeric(10,2) not null default 0,
  preu_activitat_tipus text not null default 'per_alumne'
    check (preu_activitat_tipus in ('per_alumne','total')),
  ampa_import numeric(10,2) not null default 0,
  ampa_cobreix_activitat boolean not null default false,
  cost_acompanyants numeric(10,2) not null default 0,
  -- Els paràmetres amb què es va calcular, desats en confirmar el preu perquè
  -- el càlcul sigui reproduïble encara que després es canviï la configuració.
  previsio_usada numeric(4,3),
  marge_pct_usat numeric(5,2),
  iva_pct_usat numeric(5,2)
);

-- Una fila per autocar. S'acaba el text "406+406", que l'Excel partia pel
-- primer '+' i deixava el preu en blanc quan n'hi havia tres.
create table if not exists public.excursio_autocars (
  id uuid primary key default gen_random_uuid(),
  excursio_id uuid not null references public.excursions(id) on delete cascade,
  places integer not null default 0 check (places >= 0),
  preu numeric(10,2) not null default 0 check (preu >= 0)   -- sense IVA
);
create index if not exists excursio_autocars_excursio on public.excursio_autocars(excursio_id);

alter table public.excursio_finances enable row level security;
alter table public.excursio_autocars enable row level security;

-- Una sola política per taula, per a totes les operacions: qui veu els diners
-- és exactament qui els pot tocar. Dues polítiques separades només serien dues
-- coses a mantenir sincronitzades.
create policy excursio_finances_costos on public.excursio_finances for all to authenticated
using (app_private.module_visible('excursions') and app_private.excursions_costos())
with check (app_private.module_visible('excursions') and app_private.excursions_costos());

create policy excursio_autocars_costos on public.excursio_autocars for all to authenticated
using (app_private.module_visible('excursions') and app_private.excursions_costos())
with check (app_private.module_visible('excursions') and app_private.excursions_costos());

-- L'RLS filtra files; el GRANT dona accés a la taula. Calen les dues coses.
do $$ declare t text; begin
  foreach t in array array['excursio_finances','excursio_autocars'] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function app_private.audit_change()', t);
    -- Reben cascades quan s'esborra una excursió: com les altres filles,
    -- tenen marge però no il·limitat.
    execute format(
      'create trigger fre_esborrats after delete on public.%I
       referencing old table as esborrades
       for each statement execute function app_private.fre_esborrats(%L)', t, '50');
  end loop;
end $$;

commit;
```

- [ ] **Step 4: Executar-les i veure-les passar**

Run: `npx vitest run tests/database.test.ts`
Esperat: PASS, totes.

- [ ] **Step 5: Comprovar que les proves proven alguna cosa**

```bash
mv supabase/migrations/202609210001_excursions_finances.sql /tmp/ && npx vitest run tests/database.test.ts 2>&1 | grep -E "×|Tests "; mv /tmp/202609210001_excursions_finances.sql supabase/migrations/
```

Esperat: fallen les proves noves i **cap altra**. Si en fallen d'altres, la migració ha trencat alguna cosa.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202609210001_excursions_finances.sql tests/database.test.ts
git commit -m "feat(excursions): taules de costos que el professorat no pot llegir"
```

---

### Task 5: Els paràmetres a Configuració

**Files:**
- Modify: `src/store/configStore.ts`
- Create: `src/modules/excursions/parametres.ts`
- Create: `src/modules/excursions/parametres.test.ts`
- Modify: `src/modules/configuracio/ConfiguracioPage.tsx`

**Interfaces:**
- Consumes: `ParametresPreu` de `./preu` (Task 2).
- Produces: claus `excursions.previsio.<ETAPA>`, `excursions.marge-pct.<ETAPA>`, `excursions.iva-pct`, `excursions.arrodoniment` a `CONFIG_DEFAULTS`, i
  `export function parametresPreu(config: Record<string,string[]>, etapa: string): ParametresPreu`.

Les etapes són les de `ETAPES_SUBSTITUCIO`: `'EI' | 'EP' | 'ESO 1r-2n' | 'ESO 3r-4t' | 'BATX' | 'GM'`.

- [ ] **Step 1: Escriure la prova dels valors per defecte i de la lectura**

A `src/modules/excursions/parametres.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { CONFIG_DEFAULTS } from '../../store/configStore'
import { parametresPreu } from './parametres'

describe('paràmetres del preu de les excursions', () => {
  it('EI i EP esperen que en vinguin més', () => {
    expect(CONFIG_DEFAULTS['excursions.previsio.EI']).toEqual(['0.8'])
    expect(CONFIG_DEFAULTS['excursions.previsio.EP']).toEqual(['0.8'])
    expect(CONFIG_DEFAULTS['excursions.previsio.BATX']).toEqual(['0.75'])
  })

  it('el marge és del 12 % a totes les etapes', () => {
    for (const etapa of ['EI','EP','ESO 1r-2n','ESO 3r-4t','BATX','GM']) {
      expect(CONFIG_DEFAULTS[`excursions.marge-pct.${etapa}`], etapa).toEqual(['12'])
    }
  })

  it('els llegeix com a números', () => {
    expect(parametresPreu({}, 'EP')).toEqual({ previsio: 0.8, margePct: 12, ivaPct: 10, arrodoniment: 0.5 })
  })

  it('un valor desat guanya el valor per defecte', () => {
    expect(parametresPreu({ 'excursions.marge-pct.EP': ['8'] }, 'EP').margePct).toBe(8)
  })

  it('un valor escrit malament no deixa el preu en NaN', () => {
    // Si algú desa "dotze" al camp del marge, val més cobrar el 12 % de sempre
    // que ensenyar un preu que no és un número.
    expect(parametresPreu({ 'excursions.marge-pct.EP': ['dotze'] }, 'EP').margePct).toBe(12)
  })

  it('una etapa que no existeix no peta', () => {
    expect(Number.isFinite(parametresPreu({}, 'INVENTADA').previsio)).toBe(true)
  })
})
```

- [ ] **Step 2: Executar-la i veure-la fallar**

Run: `npx vitest run src/modules/excursions/parametres.test.ts`
Esperat: FAIL, «Failed to resolve import "./parametres"».

- [ ] **Step 3a: Afegir les claus a `configStore.ts`**

A `CONFIG_DEFAULTS`, al costat de les altres claus d'excursions:

```ts
  // Previsió d'assistència: quants dels matriculats s'espera que hi vagin.
  // A EI i EP en van més; és el que diuen les dades del centre.
  'excursions.previsio.EI': ['0.8'],
  'excursions.previsio.EP': ['0.8'],
  'excursions.previsio.ESO 1r-2n': ['0.75'],
  'excursions.previsio.ESO 3r-4t': ['0.75'],
  'excursions.previsio.BATX': ['0.75'],
  'excursions.previsio.GM': ['0.75'],
  // El marge cobreix que no vinguin tants com s'esperava. El 12 % surt de
  // simular 31 excursions reals: amb això les famílies paguen pràcticament
  // el mateix que fins ara i només una queda per sota de cost.
  'excursions.marge-pct.EI': ['12'],
  'excursions.marge-pct.EP': ['12'],
  'excursions.marge-pct.ESO 1r-2n': ['12'],
  'excursions.marge-pct.ESO 3r-4t': ['12'],
  'excursions.marge-pct.BATX': ['12'],
  'excursions.marge-pct.GM': ['12'],
  'excursions.iva-pct': ['10'],
  'excursions.arrodoniment': ['0.5'],
```

- [ ] **Step 3b: Escriure `parametres.ts`**

```ts
// src/modules/excursions/parametres.ts
//
// Pont entre la configuració i el càlcul. Viu aquí i no dins `preu.ts` perquè
// el càlcul no ha de dependre de res, i no dins `configStore` perquè el store
// no ha de saber què és un preu d'excursió.
import { CONFIG_DEFAULTS } from '../../store/configStore'
import type { ParametresPreu } from './preu'

/**
 * Llegeix un número de la configuració. Si el valor desat no s'entén —algú hi
 * va escriure "dotze"— val més el valor per defecte que un preu en NaN, que és
 * el que acabaria veient una família.
 */
function num(config: Record<string, string[]>, clau: string, defecte: number): number {
  const desat = Number(config[clau]?.[0])
  if (Number.isFinite(desat)) return desat
  const perDefecte = Number(CONFIG_DEFAULTS[clau]?.[0])
  return Number.isFinite(perDefecte) ? perDefecte : defecte
}

/**
 * Els quatre paràmetres del càlcul per a una etapa. Els darrers arguments de
 * `num` cobreixen una etapa que no sigui a `CONFIG_DEFAULTS`: val més calcular
 * amb els valors de la resta del centre que deixar la pantalla en blanc.
 */
export function parametresPreu(config: Record<string, string[]>, etapa: string): ParametresPreu {
  return {
    previsio: num(config, `excursions.previsio.${etapa}`, 0.75),
    margePct: num(config, `excursions.marge-pct.${etapa}`, 12),
    ivaPct: num(config, 'excursions.iva-pct', 10),
    arrodoniment: num(config, 'excursions.arrodoniment', 0.5),
  }
}
```

- [ ] **Step 4: Executar-la i veure-la passar**

Run: `npx vitest run src/modules/excursions/parametres.test.ts`
Esperat: PASS.

- [ ] **Step 5: Posar els camps a la pantalla de Configuració**

A `ConfiguracioPage.tsx`, on ja hi ha la secció d'Excursions (mira com estan fets els camps de `material-infantil.marge-seguretat-pct`, que també és un número desat com a llista d'un element, i segueix el mateix patró). Cal una secció amb:

- Un camp de previsió i un de marge **per etapa** (sis i sis), recorrent `ETAPES_SUBSTITUCIO`.
- Un camp d'IVA del transport i un d'arrodoniment.

**Només l'ha de veure qui té accés als costos.** Fes servir `potVeureCostos(rol, usuari)` de `src/modules/excursions/permisos.ts`: a Secretaria li serveix, i a un docent amb la casella de logística no li ha de sortir.

- [ ] **Step 6: Comprovar-ho al navegador**

```bash
npm run dev
```

Entra a Configuració → Excursions, canvia el marge d'EP a 8, recarrega i mira que s'hagi desat.

- [ ] **Step 7: Commit**

```bash
git add src/store/configStore.ts src/modules/excursions/parametres.ts src/modules/excursions/parametres.test.ts src/modules/configuracio/ConfiguracioPage.tsx
git commit -m "feat(excursions): els paràmetres del preu, configurables per etapa"
```

---

### Task 6: Congelar el preu

Confirmar el preu és una transició d'estat, no un camp que s'escriu: un cop la circular diu un import, aquell import ja no pot canviar sol perquè algú hagi tocat el marge a Configuració.

**Files:**
- Create: `supabase/migrations/202609210002_confirmar_preu.sql`
- Modify: `tests/database.test.ts`

**Interfaces:**
- Produces: columnes `preu_alumne numeric(10,2)`, `preu_confirmat_per text`, `preu_confirmat_el timestamptz` a `public.excursions`, i la funció `public.confirmar_preu(p_id uuid, p_preu numeric)`.

- [ ] **Step 1: Escriure les proves**

```ts
describe('congelar el preu', () => {
  async function aprovada() {
    await asUser('admin@stjosep.org')
    const id = (await db.query<{id:string}>(`
      insert into public.excursions(etapa,lloc,activitat,data,hora_sortida,hora_tornada,transport)
      values('EP','Prova','Prova','2026-10-20','09:00','13:00','autocar') returning id`)).rows[0].id
    await db.query(`insert into public.excursio_grups(excursio_id,grup,alumnes_previstos) values($1,'EP-1 A',25)`,[id])
    await db.query(`update public.excursions set estat='Proposada' where id=$1`,[id])
    await db.query(`update public.excursions set estat='Aprovada' where id=$1`,[id])
    return id
  }

  it('desa el preu i qui el va confirmar', async () => {
    const id = await aprovada()
    await db.query('select public.confirmar_preu($1,$2)',[id, 12.5])
    const e = (await db.query<{preu_alumne:string,preu_confirmat_per:string}>(
      'select preu_alumne,preu_confirmat_per from public.excursions where id=$1',[id])).rows[0]
    expect(Number(e.preu_alumne)).toBe(12.5)
    expect(e.preu_confirmat_per).toBe('admin@stjosep.org')
  })

  it('un docent amb gestió no el pot confirmar: no veu els números que l’han donat', async () => {
    const id = await aprovada()
    await db.exec('reset role')
    await db.query(`update public.usuaris set pot_gestionar_excursions=true where email='teacher@stjosep.org'`)
    await asUser('teacher@stjosep.org')
    await expect(db.query('select public.confirmar_preu($1,$2)',[id, 12.5])).rejects.toThrow('No autoritzat')
  })

  it('no es confirma el preu d’una excursió que encara no s’ha aprovat', async () => {
    await asUser('admin@stjosep.org')
    const id = (await db.query<{id:string}>(`
      insert into public.excursions(etapa,lloc,activitat,data,hora_sortida,hora_tornada,transport)
      values('EP','Prova','Prova','2026-10-20','09:00','13:00','autocar') returning id`)).rows[0].id
    await expect(db.query('select public.confirmar_preu($1,$2)',[id, 12.5])).rejects.toThrow()
  })

  it('un preu negatiu no s’accepta', async () => {
    const id = await aprovada()
    await expect(db.query('select public.confirmar_preu($1,$2)',[id, -3])).rejects.toThrow()
  })

  it('es pot refer mentre no s’hagi enviat la circular', async () => {
    const id = await aprovada()
    await db.query('select public.confirmar_preu($1,$2)',[id, 12.5])
    await db.query('select public.confirmar_preu($1,$2)',[id, 14])
    expect(Number((await db.query<{preu_alumne:string}>('select preu_alumne from public.excursions where id=$1',[id])).rows[0].preu_alumne)).toBe(14)
  })
})
```

- [ ] **Step 2: Executar-les i veure-les fallar**

Run: `npx vitest run tests/database.test.ts -t "congelar el preu"`
Esperat: FAIL, la funció no existeix.

- [ ] **Step 3: Escriure la migració**

```sql
begin;

-- El preu congelat viu a `excursions` i no a `excursio_finances` perquè
-- **és públic**: surt a la circular i les famílies l'han de veure. El que no
-- és públic és com s'ha arribat a aquest número.
alter table public.excursions add column if not exists preu_alumne numeric(10,2);
alter table public.excursions add column if not exists preu_confirmat_per text;
alter table public.excursions add column if not exists preu_confirmat_el timestamptz;
alter table public.excursions drop constraint if exists excursions_preu_alumne_check;
alter table public.excursions add constraint excursions_preu_alumne_check
  check (preu_alumne is null or preu_alumne >= 0);

-- Confirmar el preu és una acció del servidor i no una escriptura qualsevol:
-- qui el confirma ha de ser qui veu els costos, i l'excursió ha d'estar
-- aprovada. Un cop enviada la circular ja no es toca, perquè les famílies
-- tenen a casa un paper que diu un import.
create or replace function public.confirmar_preu(p_id uuid, p_preu numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare qui text := app_private.email(); actual text;
begin
  if not app_private.excursions_costos() then raise exception 'No autoritzat'; end if;
  if p_preu is null or p_preu < 0 then raise exception 'El preu no pot ser negatiu'; end if;

  select estat into actual from public.excursions where id = p_id;
  if actual is null then raise exception 'L''excursió no existeix'; end if;
  if actual not in ('Aprovada','Reservada') then
    raise exception 'Només es confirma el preu d''una excursió aprovada (ara és %)', actual;
  end if;

  update public.excursions
     set preu_alumne = p_preu, preu_confirmat_per = qui, preu_confirmat_el = now()
   where id = p_id;
end;
$$;

revoke all on function public.confirmar_preu(uuid, numeric) from public, anon, authenticated;
grant execute on function public.confirmar_preu(uuid, numeric) to authenticated;

commit;
```

- [ ] **Step 4: Executar-les i veure-les passar**

Run: `npx vitest run tests/database.test.ts`
Esperat: PASS, totes.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609210002_confirmar_preu.sql tests/database.test.ts
git commit -m "feat(excursions): confirmar el preu el congela, i només qui veu costos ho pot fer"
```

---

### Task 7: El preu a la fitxa i l'store dels costos

**Files:**
- Create: `src/modules/excursions/finances.types.ts`
- Create: `src/modules/excursions/useFinances.ts`
- Modify: `src/modules/excursions/types.ts`
- Modify: `src/modules/excursions/excursions.utils.ts`
- Modify: `src/modules/excursions/excursions.utils.test.ts`

**Interfaces:**
- Consumes: `confirmar_preu` (Task 6).
- Produces:
  ```ts
  // finances.types.ts
  export interface Autocar { id: string; Places: number; Preu: number }
  export interface Finances {
    PreuActivitat: number
    PreuActivitatTipus: 'per_alumne' | 'total'
    AmpaImport: number
    AmpaCobreixActivitat: boolean
    CostAcompanyants: number
    Autocars: Autocar[]
  }
  // useFinances.ts
  useFinances: { finances: Finances | null; loading: boolean; error: string | null
                 carrega(excursioId: string): Promise<void>
                 desa(excursioId: string, f: Finances): Promise<void>
                 confirma(excursioId: string, preu: number): Promise<void> }
  ```
  I a `Excursio`: `PreuAlumne: number | null`, `PreuConfirmatPer: string | null`.

- [ ] **Step 1: Escriure la prova de la conversió del preu**

A `src/modules/excursions/excursions.utils.test.ts`, dins el `describe` de `rowToExcursio` que ja hi ha:

```ts
it('converteix el preu a número, que PostgreSQL el torna com a text', () => {
  // `numeric` arriba com a cadena. Sense convertir-lo, 12.50 + 12.50 faria
  // "12.5012.50" i el total de la pantalla seria absurd.
  const e = rowToExcursio({ ...filaBuida, preu_alumne: '12.50', preu_confirmat_per: 'a@stjosep.org' })
  expect(e.PreuAlumne).toBe(12.5)
  expect(e.PreuConfirmatPer).toBe('a@stjosep.org')
})

it('una excursió sense preu confirmat el deixa buit, no a zero', () => {
  // Zero vol dir "gratuïta"; buit vol dir "encara no s'ha decidit".
  // Confondre-ho faria que la fitxa digués que una excursió no costa res.
  const e = rowToExcursio({ ...filaBuida, preu_alumne: null, preu_confirmat_per: null })
  expect(e.PreuAlumne).toBeNull()
})
```

`filaBuida` és l'objecte de fila que ja fan servir les proves d'aquest fitxer; si no hi és amb aquest nom, fes servir el que hi hagi.

- [ ] **Step 2: Executar-la i veure-la fallar**

Run: `npx vitest run src/modules/excursions/excursions.utils.test.ts`
Esperat: FAIL, `PreuAlumne` és `undefined`.

- [ ] **Step 3: Afegir els camps**

A `types.ts`, dins `interface Excursio`, després de `Creat_per`:

```ts
  PreuAlumne: number | null
  PreuConfirmatPer: string | null
```

A `excursions.utils.ts`, dins `ExcursioRow`:

```ts
  preu_alumne: string | number | null
  preu_confirmat_per: string | null
```

I dins `rowToExcursio`, al costat dels altres camps:

```ts
  PreuAlumne: r.preu_alumne == null ? null : Number(r.preu_alumne),
  PreuConfirmatPer: r.preu_confirmat_per ?? null,
```

- [ ] **Step 4: Executar-la i veure-la passar**

Run: `npx vitest run src/modules/excursions/excursions.utils.test.ts`
Esperat: PASS.

- [ ] **Step 5: Escriure els tipus i l'store dels costos**

```ts
// src/modules/excursions/finances.types.ts
export interface Autocar {
  id: string
  Places: number
  Preu: number      // sense IVA
}

export interface Finances {
  PreuActivitat: number
  PreuActivitatTipus: 'per_alumne' | 'total'
  AmpaImport: number
  AmpaCobreixActivitat: boolean
  CostAcompanyants: number
  Autocars: Autocar[]
}

export const FINANCES_BUIDES: Finances = {
  PreuActivitat: 0, PreuActivitatTipus: 'per_alumne',
  AmpaImport: 0, AmpaCobreixActivitat: false, CostAcompanyants: 0, Autocars: [],
}
```

```ts
// src/modules/excursions/useFinances.ts
import { create } from 'zustand'
import { getAll, insertRow, updateRowById, deleteRowById, callRpc, supabase } from '../../services/db'
import type { Finances, Autocar } from './finances.types'
import { FINANCES_BUIDES } from './finances.types'

interface FinancesRow {
  excursio_id: string
  preu_activitat: string | number
  preu_activitat_tipus: 'per_alumne' | 'total'
  ampa_import: string | number
  ampa_cobreix_activitat: boolean
  cost_acompanyants: string | number
}
interface AutocarRow { id: string; excursio_id: string; places: number; preu: string | number }

interface FinancesState {
  finances: Finances | null
  loading: boolean
  error: string | null
  carrega: (excursioId: string) => Promise<void>
  desa: (excursioId: string, f: Finances) => Promise<void>
  confirma: (excursioId: string, preu: number) => Promise<void>
}

export const useFinances = create<FinancesState>((set, get) => ({
  finances: null,
  loading: false,
  error: null,

  async carrega(excursioId) {
    set({ loading: true, error: null })
    try {
      const [files, autocars] = await Promise.all([
        getAll<FinancesRow>('excursio_finances', 'excursio_id', { excursio_id: excursioId }, 'excursio_id'),
        getAll<AutocarRow>('excursio_autocars', 'id', { excursio_id: excursioId }),
      ])
      // Zero files no és cap error: o bé encara no s'hi ha entrat res, o bé
      // qui mira no té accés als diners i l'RLS no li'n dona cap. En tots dos
      // casos la pantalla ha d'ensenyar el formulari buit, no un error vermell.
      const f = files[0]
      set({ finances: {
        ...FINANCES_BUIDES,
        ...(f ? {
          PreuActivitat: Number(f.preu_activitat),
          PreuActivitatTipus: f.preu_activitat_tipus,
          AmpaImport: Number(f.ampa_import),
          AmpaCobreixActivitat: f.ampa_cobreix_activitat,
          CostAcompanyants: Number(f.cost_acompanyants),
        } : {}),
        Autocars: autocars.map((a): Autocar => ({ id: a.id, Places: a.places, Preu: Number(a.preu) })),
      } })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error carregant els costos' })
    } finally {
      set({ loading: false })
    }
  },

  async desa(excursioId, f) {
    // `upsert` i no els ajudants de sempre: `updateRowById` filtra per una
    // columna `id` fixa, i `excursio_finances` té `excursio_id` com a clau
    // primària i cap columna `id`. Amb la clau primària, un sol `upsert` ja
    // fa inserir-o-actualitzar.
    const { error } = await supabase.from('excursio_finances').upsert({
      excursio_id: excursioId,
      preu_activitat: f.PreuActivitat,
      preu_activitat_tipus: f.PreuActivitatTipus,
      ampa_import: f.AmpaImport,
      ampa_cobreix_activitat: f.AmpaCobreixActivitat,
      cost_acompanyants: f.CostAcompanyants,
    })
    if (error) throw new Error(`Error desant els costos: ${error.message}`)

    // Els autocars es posen al dia per diferència i no esborrant-ho tot: si una
    // escriptura falla, el que ja hi havia no s'ha perdut pel camí. És el mateix
    // criteri que `sincronitzaFilles` a `useExcursions`.
    const actuals = await getAll<AutocarRow>('excursio_autocars', 'id', { excursio_id: excursioId })
    for (const a of actuals) {
      const volgut = f.Autocars.find((v) => v.id === a.id)
      if (!volgut) await deleteRowById('excursio_autocars', a.id)
      else if (volgut.Places !== a.places || volgut.Preu !== Number(a.preu)) {
        await updateRowById('excursio_autocars', a.id, { places: volgut.Places, preu: volgut.Preu })
      }
    }
    for (const v of f.Autocars) {
      if (!actuals.some((a) => a.id === v.id)) {
        await insertRow('excursio_autocars', { excursio_id: excursioId, places: v.Places, preu: v.Preu })
      }
    }
    await get().carrega(excursioId)
  },

  async confirma(excursioId, preu) {
    await callRpc('confirmar_preu', { p_id: excursioId, p_preu: preu })
  },
}))
```

Les firmes reals de `src/services/db.ts`, ja comprovades: `getAll(table, orderBy, filters, primaryKey)` accepta quatre arguments, però `updateRowById(table, id, data)` i `deleteRowById(table, id)` filtren per una columna `id` fixa. Per això els costos es desen amb `upsert` i els autocars —que sí que tenen `id`— amb els ajudants. **No toquis `updateRowById`**: el fa servir mig projecte.

- [ ] **Step 6: Comprovar que compila i que res no s'ha trencat**

```bash
npx tsc --noEmit && npm test
```

Esperat: tot net.

- [ ] **Step 7: Commit**

```bash
git add src/modules/excursions/finances.types.ts src/modules/excursions/useFinances.ts src/modules/excursions/types.ts src/modules/excursions/excursions.utils.ts src/modules/excursions/excursions.utils.test.ts
git commit -m "feat(excursions): el preu congelat a la fitxa i l'store dels costos"
```

---

### Task 8: El bloc econòmic, només per a qui el pot veure

**Files:**
- Create: `src/modules/excursions/BlocEconomic.tsx`
- Modify: `src/modules/excursions/ExcursioDetall.tsx`
- Modify: `src/modules/excursions/permisos.test.ts`

**Interfaces:**
- Consumes: `calculaPreu`, `CostosExcursio` (Task 2); `parametresPreu` (Task 5); `Finances`, `useFinances` (Task 7); `potVeureCostos` de `permisos.ts`.

- [ ] **Step 1: Fixar amb una prova qui veu què**

A `src/modules/excursions/permisos.test.ts`:

```ts
it('un docent amb la gestió activada organitza, però no veu diners', () => {
  // És la distinció per la qual hi ha dos permisos i no un. Si algun dia
  // algú els unifica, aquesta prova ho ha d'aturar.
  const docent = { PotGestionarExcursions: true, PotGestionarCostosExcursions: false } as Usuari
  expect(potGestionar('professorat', docent)).toBe(true)
  expect(potVeureCostos('professorat', docent)).toBe(false)
})

it('Secretaria veu els diners encara que no sigui un càrrec', () => {
  const secretaria = { PotGestionarExcursions: false, PotGestionarCostosExcursions: true } as Usuari
  expect(potVeureCostos('professorat', secretaria)).toBe(true)
})
```

Run: `npx vitest run src/modules/excursions/permisos.test.ts`
Esperat: PASS ja d'entrada — `potVeureCostos` existeix des de la Fase A. Si falla, no continuïs: vol dir que el permís no fa el que diu i tota la tasca es basa en ell.

- [ ] **Step 2: Escriure `BlocEconomic.tsx`**

```tsx
import { useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Finances, Autocar } from './finances.types'
import type { ParametresPreu } from './preu'
import { calculaPreu } from './preu'

interface Props {
  finances: Finances
  parametres: ParametresPreu
  alumnes: number
  acompanyants: number
  preuConfirmat: number | null
  confirmatPer: string | null
  potConfirmar: boolean
  onCanvia: (f: Finances) => void
  onDesa: () => Promise<void>
  onConfirma: (preu: number) => Promise<void>
}

const eur = (n: number) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR' })

export function BlocEconomic({
  finances: f, parametres, alumnes, acompanyants,
  preuConfirmat, confirmatPer, potConfirmar, onCanvia, onDesa, onConfirma,
}: Props) {
  const resultat = useMemo(() => calculaPreu({
    alumnes, autocars: f.Autocars.map((a) => a.Preu),
    preuActivitat: f.PreuActivitat, preuActivitatTipus: f.PreuActivitatTipus,
    ampaImport: f.AmpaImport, ampaCobreixActivitat: f.AmpaCobreixActivitat,
    costAcompanyants: f.CostAcompanyants,
  }, parametres), [f, parametres, alumnes])

  function autocar(id: string, canvis: Partial<Autocar>) {
    onCanvia({ ...f, Autocars: f.Autocars.map((a) => (a.id === id ? { ...a, ...canvis } : a)) })
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-text-main">Costos i preu</h3>

      <div className="space-y-2">
        <p className="text-xs text-gray-400">Autocars — un per vehicle, preu sense IVA</p>
        {f.Autocars.map((a) => (
          <div key={a.id} className="flex items-center gap-2">
            <input type="number" min={0} value={a.Places} aria-label="Places"
              onChange={(e) => autocar(a.id, { Places: Number(e.target.value) })}
              className="w-24 px-2 py-1 text-sm border border-gray-200 rounded-lg" />
            <input type="number" min={0} step="0.01" value={a.Preu} aria-label="Preu de l’autocar"
              onChange={(e) => autocar(a.id, { Preu: Number(e.target.value) })}
              className="w-32 px-2 py-1 text-sm border border-gray-200 rounded-lg" />
            <button onClick={() => onCanvia({ ...f, Autocars: f.Autocars.filter((x) => x.id !== a.id) })}
              aria-label="Treu l’autocar" className="p-1 text-gray-300 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          onClick={() => onCanvia({ ...f, Autocars: [...f.Autocars, { id: `nou-${Date.now()}`, Places: 55, Preu: 0 }] })}
          className="flex items-center gap-1 text-xs text-primary">
          <Plus size={12} /> Afegeix un autocar
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-gray-500">Activitat</label>
        <input type="number" min={0} step="0.01" value={f.PreuActivitat} aria-label="Preu de l’activitat"
          onChange={(e) => onCanvia({ ...f, PreuActivitat: Number(e.target.value) })}
          className="w-32 px-2 py-1 text-sm border border-gray-200 rounded-lg" />
        <select value={f.PreuActivitatTipus} aria-label="Com es compta l’activitat"
          onChange={(e) => onCanvia({ ...f, PreuActivitatTipus: e.target.value as Finances['PreuActivitatTipus'] })}
          className="px-2 py-1 text-sm border border-gray-200 rounded-lg">
          <option value="per_alumne">per alumne</option>
          <option value="total">en total</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-gray-500">AMPA</label>
        <input type="number" min={0} step="0.01" value={f.AmpaImport} aria-label="Aportació de l’AMPA per alumne"
          onChange={(e) => onCanvia({ ...f, AmpaImport: Number(e.target.value) })}
          className="w-32 px-2 py-1 text-sm border border-gray-200 rounded-lg" />
        <label className="flex items-center gap-1 text-xs text-gray-500">
          <input type="checkbox" checked={f.AmpaCobreixActivitat}
            onChange={(e) => onCanvia({ ...f, AmpaCobreixActivitat: e.target.checked })} />
          cobreix l’activitat sencera
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-gray-500">Cost dels acompanyants</label>
        <input type="number" min={0} step="0.01" value={f.CostAcompanyants} aria-label="Cost dels acompanyants"
          onChange={(e) => onCanvia({ ...f, CostAcompanyants: Number(e.target.value) })}
          className="w-32 px-2 py-1 text-sm border border-gray-200 rounded-lg" />
      </div>

      {/* El desglossament i no només el resultat: qui ha de confirmar un preu
          ha de poder veure d'on surt. Un número sol no es pot revisar. */}
      <dl className="text-xs text-gray-500 space-y-1 border-t border-gray-100 pt-3">
        <div className="flex justify-between"><dt>Alumnes que s’espera que paguin</dt>
          <dd>{resultat.esperats} de {alumnes} ({Math.round(parametres.previsio * 100)} %)</dd></div>
        {/* Els acompanyants no paguen i no entren al càlcul, però qui confirma
            el preu ha de saber quants n'hi ha: el seu cost sí que es reparteix. */}
        <div className="flex justify-between"><dt>Acompanyants</dt><dd>{acompanyants}</dd></div>
        <div className="flex justify-between"><dt>Costos fixos (IVA inclòs)</dt><dd>{eur(resultat.costosFixos)}</dd></div>
        <div className="flex justify-between"><dt>Cost per alumne</dt><dd>{eur(resultat.costAlumne)}</dd></div>
        <div className="flex justify-between"><dt>Un cop restada l’AMPA</dt><dd>{eur(resultat.base)}</dd></div>
        <div className="flex justify-between font-medium text-text-main">
          <dt>Preu amb el marge del {parametres.margePct} %</dt><dd>{eur(resultat.preu)}</dd></div>
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onDesa} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg">Desa els costos</button>
        {potConfirmar && (
          <button onClick={() => onConfirma(resultat.preu)}
            className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg">
            {preuConfirmat === null ? 'Confirma el preu' : 'Torna a confirmar'}
          </button>
        )}
      </div>

      {preuConfirmat !== null && (
        <p className="text-xs text-gray-400">
          Preu confirmat: <span className="font-medium text-text-main">{eur(preuConfirmat)}</span>
          {confirmatPer && ` · ${confirmatPer}`}
          {resultat.preu !== preuConfirmat && ' · el càlcul d’ara en dona un altre; tornar a confirmar el canviarà'}
        </p>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Encaixar-lo a `ExcursioDetall.tsx`**

Dins el component, després del bloc de dades:

```tsx
{potVeureCostos(rol, usuari) && finances && (
  <BlocEconomic
    finances={finances}
    parametres={parametresPreu(config, e.Etapa)}
    alumnes={e.Grups.reduce((s, g) => s + g.AlumnesPrevistos, 0)}
    acompanyants={e.Acompanyants.length + e.AcompanyantsExterns}
    preuConfirmat={e.PreuAlumne}
    confirmatPer={e.PreuConfirmatPer}
    potConfirmar={e.Estat === 'Aprovada' || e.Estat === 'Reservada'}
    onCanvia={setFinances}
    onDesa={() => desa(e.id, finances)}
    onConfirma={(preu) => confirma(e.id, preu)}
  />
)}
```

El preu confirmat, en canvi, **es pot ensenyar a tothom** com una dada més de la fitxa: surt a la circular i amagar-lo no tindria sentit. Afegeix-lo amb el component `Dada` que ja hi ha:

```tsx
{e.PreuAlumne !== null && <Dada etiqueta="Preu per alumne" valor={eur(e.PreuAlumne)} />}
```

`rol`, `usuari` i `config` surten dels stores que la pantalla ja fa servir; mira com els obté `ExcursionsPage.tsx` i segueix el mateix camí en lloc d'inventar-ne un de nou.

- [ ] **Step 4: Passar totes les comprovacions**

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
```

Esperat: tot net.

- [ ] **Step 5: Provar-ho al navegador amb dos comptes**

```bash
npm run dev
```

Primer amb el teu compte: crea una excursió, aprova-la, posa-hi un autocar de 500 € i 100 alumnes a EP, i comprova que el desglossament diu 80 esperats, 550 € de costos fixos i 8,00 € de preu. Fes els números a mà un cop; si no quadren, atura't.

Després, a Usuaris, activa **només** `pot_gestionar_excursions` a un compte de prova, entra-hi i obre la mateixa excursió: **no ha de sortir el bloc econòmic**, però sí el preu confirmat. Aquesta és la comprovació que importa de tota la tasca — i la que no es pot fer amb proves automàtiques, perquè el que es comprova és que el servidor no ha enviat les dades.

- [ ] **Step 6: Commit**

```bash
git add src/modules/excursions/BlocEconomic.tsx src/modules/excursions/ExcursioDetall.tsx src/modules/excursions/permisos.test.ts
git commit -m "feat(excursions): el bloc de costos, amb el càlcul a la vista"
```

---

## Desplegament

Un cop fusionat, aplicar a producció **en aquest ordre**:

1. `202609210001_excursions_finances.sql`
2. `202609210002_confirmar_preu.sql`

I comprovar-ho amb una consulta real, no només amb el «success» de l'eina:

```sql
select tablename, rowsecurity from pg_tables where schemaname='public' and tablename like 'excursio_%';
select polname, pg_get_expr(polqual, polrelid) from pg_policy
 where polrelid in ('public.excursio_finances'::regclass,'public.excursio_autocars'::regclass);
```

Esperat: `rowsecurity` a cert a les dues taules, i les polítiques amb `excursions_costos()`.

## Què queda per a la Fase B2

Petició de pressupost als autocars (exportar l'Excel sense preus, tornar-lo a importar amb preus), la circular en `.docx` amb els textos configurables, les tres dates proposades i ajustables, i la transició `enviar_circular`, que exigirà que el preu estigui confirmat.
