# Petició de pressupostos als autocars — pla d'implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exportar un Excel del curs sense preus perquè l'empresa d'autocars l'ompli, i tornar-lo a importar amb previsualització fila a fila.

**Architecture:** Dos mòduls purs —construir el full i interpretar el que torna— provables sense DOM ni base de dades, dues finestres que els fan servir, i una acció de l'store que escriu. **Cap migració**: `excursio_autocars` ja és una fila per vehicle i `excursio_finances` ja distingeix activitat per alumne de total.

**Tech Stack:** React 19 + TypeScript estricte (`verbatimModuleSyntax`, `noUnusedLocals`), Vite, Tailwind, Zustand, Supabase via `src/services/db.ts`, `xlsx` (SheetJS) carregat mandrosament, Vitest amb `environment: 'node'`.

**Spec:** `docs/superpowers/specs/2026-09-24-pressupostos-autocar-design.md`

## Global Constraints

- **Tot en català**: noms, comentaris, textos de pantalla i capçaleres del full.
- **Apòstrof tipogràfic `’` dins cometes dobles.** Mai un apòstrof recte tancant una cadena de cometes simples — ja ha trencat la compilació dues vegades en aquest projecte.
- **TypeScript estricte**: tipus amb `import type`. `noUnusedLocals` actiu.
- **No hi ha proves de components**: Vitest corre amb `environment: 'node'`, sense DOM. Tota lògica provable viu en un mòdul pur, mai dins un `.tsx`.
- **Cap migració ni cap canvi a la base de dades.** `supabase/schema.sql` no es toca.
- **El fitxer que surt del centre no porta cap nom**, ni d'alumne ni de docent.
- **El que es desa sempre és el preu net.** `calculaPreu` ja hi aplica l'IVA; desar-hi el brut faria tots els preus un 10 % alts.
- **Exportar és de Gestió** (`excursions_gestio()`), **importar és de Costos** (`excursions_costos()`).
- `xlsx` s'importa sempre mandrosament: `const XLSX = await import('xlsx')`.
- Mai `text-gray-400` per a text que s'hagi de llegir; text secundari, `text-gray-500`.

## Estructura de fitxers

| Fitxer | Responsabilitat |
|---|---|
| `src/modules/excursions/circular/dades.ts` **(modificar)** | Exportar-hi `diaSetmana`, al costat de `dataLlarga`, perquè els noms catalans dels dies tinguin **una sola definició**. |
| `src/modules/excursions/pressupostExport.utils.ts` **(nou)** | Qui està pendent de pressupost, les capçaleres i les files del full, i escriure'l. |
| `src/modules/excursions/pressupostExport.utils.test.ts` **(nou)** | |
| `src/modules/excursions/pressupostImport.utils.ts` **(nou)** | Interpretar el full que torna i decidir què és vàlid. |
| `src/modules/excursions/pressupostImport.utils.test.ts` **(nou)** | |
| `src/modules/excursions/useFinances.ts` **(modificar)** | Una acció que escriu els pressupostos importats. |
| `src/modules/excursions/useFinances.test.ts` **(modificar)** | |
| `src/modules/excursions/DemanarPressupostModal.tsx` **(nou)** | Triar sortides i què es demana, i baixar el full. |
| `src/modules/excursions/ImportarPressupostModal.tsx` **(nou)** | Fitxer, casella d'IVA, previsualització i confirmació. |
| `src/modules/excursions/ExcursionsPage.tsx` **(modificar)** | El filtre «pendents de pressupost» i els dos botons. |
| `src/app/routes/ExcursionsWrapper.tsx` **(modificar)** | Cablejat i permisos. |
| `src/store/configStore.ts` **(modificar)** | La clau `excursions.empreses-autocar`. |

---

### Task 1: El full que surt

**Files:**
- Modify: `src/modules/excursions/circular/dades.ts`
- Create: `src/modules/excursions/pressupostExport.utils.ts`
- Test: `src/modules/excursions/pressupostExport.utils.test.ts`

**Interfaces:**
- Consumes: `Excursio`, `ExcursioGrup` de `./types`.
- Produces: `diaSetmana(iso: string): string` (des de `./circular/dades`); i de `pressupostExport.utils`: `QueEsDemana`, `pendentsDePressupost(excursions: Excursio[], ambAutocars: ReadonlySet<string>): Excursio[]`, `passatgers(e: Excursio): number`, `capcaleresPressupost(demana: QueEsDemana): string[]`, `filesPressupost(excursions: Excursio[], demana: QueEsDemana): (string | number)[][]`, `generaExcelPressupost(excursions: Excursio[], demana: QueEsDemana, empresa: string, curs: string): Promise<void>`.

> **Compte amb `ambAutocars`:** aquí és un `ReadonlySet<string>` d'identificadors —només cal saber si en té o no—, mentre que a la Task 2 és un `ReadonlyMap<string, { quants, total }>`, perquè l'avís de substitució ha de dir quants en perd i quant sumaven. Mateix nom, dues formes, i el cablejat de la Task 5 construeix totes dues de la mateixa lectura.

**Context que et cal i que no pots endevinar:**

- `src/modules/excursions/circular/dades.ts` ja té una constant `DIES` amb els noms catalans dels dies i una funció `dataLlarga` que la fa servir. **No en facis una segona**: exporta-hi una funció nova que reaprofiti aquella constant.
- Les dates es comparen i es formaten **en UTC** (`new Date(\`${iso}T00:00:00Z\`)` i els mètodes `getUTC*`). `dataLlarga` ja ho fa així, i barrejar-ho amb l'hora local desplaça el dia segons el fus.
- `Excursio` té: `Codi`, `Data: string | null`, `Lloc`, `Poblacio`, `Etapa`, `HoraSortida`, `HoraTornada`, `Transport: 'autocar' | 'altres'`, `Estat`, `Grups: ExcursioGrup[]`, `Acompanyants: string[]`, `AcompanyantsExterns: number`.
- `ExcursioGrup` té `Grup: string` i `AlumnesPrevistos: number`.
- **`Excursio` no porta els autocars.** Viuen a `excursio_finances`/`excursio_autocars` i es llegeixen a part. Per això `pendentsDePressupost` rep un segon argument amb els identificadors de les sortides que ja tenen algun autocar amb preu (vegeu la firma de sota).

- [ ] **Step 1: Escriu les proves que fallen**

Crea `src/modules/excursions/pressupostExport.utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  pendentsDePressupost, passatgers, capcaleresPressupost, filesPressupost,
} from './pressupostExport.utils'
import { diaSetmana } from './circular/dades'
import type { Excursio } from './types'

function excursio(canvis: Partial<Excursio> = {}): Excursio {
  return {
    id: 'e1', Codi: 'EXC-0001', CursEscolar: '2026-2027', Estat: 'Aprovada', Etapa: 'EP',
    Lloc: 'Can Montcau', Poblacio: 'La Roca', Activitat: 'Visita', Data: '2026-11-18',
    HoraSortida: '09:00', HoraTornada: '13:00', Transport: 'autocar', TransportDetall: '',
    AcompanyantsExterns: 0, Observacions: '', Responsable: 'a@stjosep.org',
    MotiuRebuig: null, MotiuCancellacio: null, ProposadaPer: null, AprovadaPer: null,
    ReservadaPer: null, Creat_per: 'a@stjosep.org', PreuAlumne: null, PreuConfirmatPer: null,
    DataCircular: null, DataLimitPagament: null, DataLimitResguard: null,
    CircularEnviadaPer: null, AmpaCollabora: false,
    Grups: [{ id: 'g1', Grup: 'EP-5è A', AlumnesPrevistos: 25, AlumnesFinals: null, AlumnesPagats: 0 }],
    Acompanyants: ['a@stjosep.org'],
    ...canvis,
  }
}

describe('el dia de la setmana', () => {
  it('surt en català', () => {
    expect(diaSetmana('2026-11-18')).toBe('Dimecres')
  })

  it('una data que no és una data no peta', () => {
    expect(diaSetmana('')).toBe('')
  })
})

describe('qui està pendent de pressupost', () => {
  it('una aprovada amb autocar i sense preus hi és', () => {
    expect(pendentsDePressupost([excursio()], new Set()).map((e) => e.id)).toEqual(['e1'])
  })

  it('una que ja té un autocar amb preu, no', () => {
    expect(pendentsDePressupost([excursio()], new Set(['e1']))).toEqual([])
  })

  it('una cancel·lada, no', () => {
    expect(pendentsDePressupost([excursio({ Estat: 'Cancel·lada' })], new Set())).toEqual([])
  })

  it('un esborrany i una proposta, tampoc: encara no estan aprovades', () => {
    const caps = [excursio({ Estat: 'Esborrany' }), excursio({ Estat: 'Proposada' })]
    expect(pendentsDePressupost(caps, new Set())).toEqual([])
  })

  it('una reservada o amb la circular enviada, sí: el preu pot arribar tard', () => {
    const totes = [excursio({ id: 'r', Estat: 'Reservada' }), excursio({ id: 'c', Estat: 'Circular enviada' })]
    expect(pendentsDePressupost(totes, new Set()).map((e) => e.id)).toEqual(['r', 'c'])
  })

  it('una que no va amb autocar, no: no hi ha res a demanar', () => {
    expect(pendentsDePressupost([excursio({ Transport: 'altres' })], new Set())).toEqual([])
  })

  it('una sense data, tampoc: l’empresa no pot posar-hi preu sense saber quin dia és', () => {
    expect(pendentsDePressupost([excursio({ Data: null })], new Set())).toEqual([])
  })
})

describe('els passatgers', () => {
  it('són els alumnes previstos més els acompanyants', () => {
    // Els acompanyants ocupen seient i l'empresa cobra per vehicle: comptar
    // només els alumnes faria demanar un autocar més petit del que cal.
    const e = excursio({
      Grups: [
        { id: 'g1', Grup: 'EP-5è A', AlumnesPrevistos: 25, AlumnesFinals: null, AlumnesPagats: 0 },
        { id: 'g2', Grup: 'EP-5è B', AlumnesPrevistos: 24, AlumnesFinals: null, AlumnesPagats: 0 },
      ],
      Acompanyants: ['a@stjosep.org', 'b@stjosep.org'],
      AcompanyantsExterns: 1,
    })
    expect(passatgers(e)).toBe(52)
  })
})

describe('les capçaleres', () => {
  const base = ['Codi', 'Data', 'Dia', 'Destinació', 'Població', 'Grups', 'Passatgers', 'Sortida', 'Tornada']

  it('per a l’autocar', () => {
    expect(capcaleresPressupost('autocar')).toEqual([...base, 'Places', 'Preu autocar'])
  })

  it('per a l’activitat', () => {
    // Dues columnes i no una: el full antic del centre no marcava si la xifra
    // era per alumne o un total de grup, i 16 de 44 eren totals.
    expect(capcaleresPressupost('activitat')).toEqual([...base, 'Preu per alumne', 'Preu total del grup'])
  })

  it('per a totes dues', () => {
    expect(capcaleresPressupost('ambdues'))
      .toEqual([...base, 'Places', 'Preu autocar', 'Preu per alumne', 'Preu total del grup'])
  })
})

describe('les files', () => {
  it('porten el que l’empresa necessita per posar-hi preu', () => {
    expect(filesPressupost([excursio()], 'autocar')[0])
      .toEqual(['EXC-0001', '2026-11-18', 'Dimecres', 'Can Montcau', 'La Roca', 'EP-5è A', 26, '09:00', '13:00', '', ''])
  })

  it('les columnes de preu surten buides, tantes com es demanin', () => {
    expect(filesPressupost([excursio()], 'ambdues')[0].slice(-4)).toEqual(['', '', '', ''])
  })

  it('els grups se separen amb comes', () => {
    const e = excursio({
      Grups: [
        { id: 'g1', Grup: 'EP-5è A', AlumnesPrevistos: 25, AlumnesFinals: null, AlumnesPagats: 0 },
        { id: 'g2', Grup: 'EP-5è B', AlumnesPrevistos: 24, AlumnesFinals: null, AlumnesPagats: 0 },
      ],
    })
    expect(filesPressupost([e], 'autocar')[0][5]).toBe('EP-5è A, EP-5è B')
  })

  it('no hi surt cap nom de persona', () => {
    // El fitxer se'n va del centre. Que no hi entri cap nom és el que manté
    // intacte l'expedient de protecció de dades.
    const text = JSON.stringify(filesPressupost([excursio()], 'ambdues'))
    expect(text).not.toContain('@stjosep.org')
    expect(text).not.toContain('Responsable')
  })
})
```

- [ ] **Step 2: Executa-les i comprova que fallen**

Run: `npx vitest run src/modules/excursions/pressupostExport.utils.test.ts`
Expected: FAIL — el mòdul `./pressupostExport.utils` no existeix.

- [ ] **Step 3: Exporta `diaSetmana`**

A `src/modules/excursions/circular/dades.ts`, just després de `dataLlarga`:

```ts
/** «Dimecres». Fa servir els mateixos noms que `dataLlarga`, que és l'únic lloc on estan escrits. */
export function diaSetmana(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  return DIES[new Date(`${iso}T00:00:00Z`).getUTCDay()]
}
```

- [ ] **Step 4: Escriu `pressupostExport.utils.ts`**

```ts
// src/modules/excursions/pressupostExport.utils.ts
//
// El full que se'n va a l'empresa d'autocars perquè hi posi preus. Construir
// les files està separat d'escriure l'Excel a propòsit: el contingut —que és
// el que se'n va del centre— es pot provar sense generar cap fitxer.
import { diaSetmana } from './circular/dades'
import type { Excursio } from './types'

/** Què se li demana a l'empresa. D'això depenen les columnes buides del full. */
export type QueEsDemana = 'autocar' | 'activitat' | 'ambdues'

const BASE = ['Codi', 'Data', 'Dia', 'Destinació', 'Població', 'Grups', 'Passatgers', 'Sortida', 'Tornada']
const AUTOCAR = ['Places', 'Preu autocar']
// Dues columnes i no una: el full antic del centre no marcava si la xifra era
// per alumne o un total de grup —16 de 44 eren totals— i s'havia de deduir
// creuant dos fulls. Amb dues columnes no hi ha res a deduir.
const ACTIVITAT = ['Preu per alumne', 'Preu total del grup']

/**
 * Les que encara no tenen preu d'autocar i el poden tenir.
 *
 * `ambAutocars` són els identificadors de les sortides que ja en tenen algun
 * amb preu: `Excursio` no els porta —viuen a `excursio_autocars`, que té
 * l'accés restringit— i per això entren com a argument.
 */
export function pendentsDePressupost(excursions: Excursio[], ambAutocars: ReadonlySet<string>): Excursio[] {
  return excursions.filter((e) =>
    // Un esborrany o una proposta encara es poden rebutjar: demanar-ne preu
    // seria fer treballar l'empresa per a una sortida que potser no es fa.
    e.Estat !== 'Esborrany' && e.Estat !== 'Proposada' && e.Estat !== 'Cancel·lada' &&
    e.Transport === 'autocar' &&
    // Sense dia no s'hi pot posar preu: el cost d'un autocar depèn del dia.
    e.Data !== null &&
    !ambAutocars.has(e.id))
}

/** Els qui pugen a l'autocar: els acompanyants també hi ocupen seient. */
export function passatgers(e: Excursio): number {
  const alumnes = e.Grups.reduce((s, g) => s + g.AlumnesPrevistos, 0)
  return alumnes + e.Acompanyants.length + e.AcompanyantsExterns
}

export function capcaleresPressupost(demana: QueEsDemana): string[] {
  return [
    ...BASE,
    ...(demana === 'autocar' || demana === 'ambdues' ? AUTOCAR : []),
    ...(demana === 'activitat' || demana === 'ambdues' ? ACTIVITAT : []),
  ]
}

export function filesPressupost(excursions: Excursio[], demana: QueEsDemana): (string | number)[][] {
  const buides = capcaleresPressupost(demana).length - BASE.length
  return excursions.map((e) => [
    e.Codi,
    e.Data ?? '',
    diaSetmana(e.Data ?? ''),
    e.Lloc,
    e.Poblacio,
    e.Grups.map((g) => g.Grup).join(', '),
    passatgers(e),
    e.HoraSortida,
    e.HoraTornada,
    ...Array<string>(buides).fill(''),
  ])
}

/** El nom del fitxer, sense caràcters que cap sistema de fitxers vulgui. */
function nomFitxer(empresa: string, curs: string): string {
  const net = empresa.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `pressupost-${net || 'autocars'}-${curs}.xlsx`
}

export async function generaExcelPressupost(
  excursions: Excursio[], demana: QueEsDemana, empresa: string, curs: string,
): Promise<void> {
  const XLSX = await import('xlsx')
  const capcaleres = capcaleresPressupost(demana)
  const worksheet = XLSX.utils.aoa_to_sheet([capcaleres, ...filesPressupost(excursions, demana)])
  worksheet['!cols'] = capcaleres.map((c) => ({ wch: Math.max(12, c.length + 2) }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pressupost')
  XLSX.writeFile(workbook, nomFitxer(empresa, curs))
}
```

- [ ] **Step 5: Executa i comprova que passen**

Run: `npx vitest run src/modules/excursions/pressupostExport.utils.test.ts`
Expected: PASS, 17 proves.

- [ ] **Step 6: Comprova amb una mutació que la prova dels noms prova alguna cosa**

Afegeix `e.Responsable` al final de la fila que construeix `filesPressupost` i torna a executar: la prova «no hi surt cap nom de persona» ha de **fallar**. Treu-lo. Digues a l'informe què va passar.

- [ ] **Step 7: Commit**

```bash
git add src/modules/excursions/circular/dades.ts src/modules/excursions/pressupostExport.utils.ts src/modules/excursions/pressupostExport.utils.test.ts
git commit -m "feat(pressupostos): el full que se'n va a l'empresa"
```

---

### Task 2: Llegir el full que torna

**Files:**
- Create: `src/modules/excursions/pressupostImport.utils.ts`
- Test: `src/modules/excursions/pressupostImport.utils.test.ts`

**Interfaces:**
- Consumes: `Excursio` de `./types`.
- Produces: `PreusImportats`, `FilaPressupost`, `interpretaPressupost(matriu: unknown[][], excursions: Excursio[], ambAutocars: Map<string, { quants: number; total: number }>, portaIva: boolean, ivaPct: number): FilaPressupost[]`, `parsejaExcelPressupost(file: File, excursions: Excursio[], ambAutocars: Map<string, { quants: number; total: number }>, portaIva: boolean, ivaPct: number): Promise<FilaPressupost[]>`.

**Context que et cal i que no pots endevinar:**

- **Una sortida pot ocupar diverses files**, una per autocar, repetint el codi. El resultat, en canvi, és **un `FilaPressupost` per codi**, no per fila del full: la previsualització ensenya «EXC-0004: 2 autocars».
- Les capçaleres les escriu una persona en un full de càlcul. `src/modules/usuaris/excelImport.utils.ts` té una funció `clau()` que iguala apòstrofs i ignora accents per comparar-les; **copia'n el criteri** (aquest mòdul no ha d'importar res d'`usuaris`).
- `portaIva` diu si els preus del fitxer porten IVA. Si el porten, es divideixen per `(1 + ivaPct/100)` **i s'arrodoneixen al cèntim**, perquè les columnes són `numeric(10,2)`: desar-hi més decimals els perdria en silenci.
- El que es desa és **sempre el net**. `calculaPreu` ja hi aplica l'IVA.

- [ ] **Step 1: Escriu les proves que fallen**

Crea `src/modules/excursions/pressupostImport.utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { interpretaPressupost, type FilaPressupost } from './pressupostImport.utils'
import type { Excursio } from './types'

function excursio(canvis: Partial<Excursio> = {}): Excursio {
  return {
    id: 'e1', Codi: 'EXC-0001', CursEscolar: '2026-2027', Estat: 'Aprovada', Etapa: 'EP',
    Lloc: 'Can Montcau', Poblacio: 'La Roca', Activitat: 'Visita', Data: '2026-11-18',
    HoraSortida: '09:00', HoraTornada: '13:00', Transport: 'autocar', TransportDetall: '',
    AcompanyantsExterns: 0, Observacions: '', Responsable: 'a@stjosep.org',
    MotiuRebuig: null, MotiuCancellacio: null, ProposadaPer: null, AprovadaPer: null,
    ReservadaPer: null, Creat_per: 'a@stjosep.org', PreuAlumne: null, PreuConfirmatPer: null,
    DataCircular: null, DataLimitPagament: null, DataLimitResguard: null,
    CircularEnviadaPer: null, AmpaCollabora: false,
    Grups: [{ id: 'g1', Grup: 'EP-5è A', AlumnesPrevistos: 25, AlumnesFinals: null, AlumnesPagats: 0 }],
    Acompanyants: [],
    ...canvis,
  }
}

const CAPÇALERES = ['Codi', 'Data', 'Dia', 'Destinació', 'Població', 'Grups', 'Passatgers',
  'Sortida', 'Tornada', 'Places', 'Preu autocar', 'Preu per alumne', 'Preu total del grup']

/** Una fila del full amb només les columnes que importen a les proves. */
function fila(codi: string, places: unknown = '', preu: unknown = '', perAlumne: unknown = '', total: unknown = '') {
  return [codi, '2026-11-18', 'Dimecres', 'Can Montcau', 'La Roca', 'EP-5è A', 26, '09:00', '13:00',
    places, preu, perAlumne, total]
}

const SENSE_AUTOCARS = new Map<string, { quants: number; total: number }>()

function interpreta(files: unknown[][], opcions: {
  excursions?: Excursio[]
  ambAutocars?: Map<string, { quants: number; total: number }>
  portaIva?: boolean
  ivaPct?: number
} = {}): FilaPressupost[] {
  return interpretaPressupost(
    [CAPÇALERES, ...files],
    opcions.excursions ?? [excursio()],
    opcions.ambAutocars ?? SENSE_AUTOCARS,
    opcions.portaIva ?? false,
    opcions.ivaPct ?? 10,
  )
}

describe('interpretar el full que torna', () => {
  it('una fila amb preu dona un autocar', () => {
    const r = interpreta([fila('EXC-0001', 55, 610)])
    expect(r).toHaveLength(1)
    expect(r[0].valid).toBe(true)
    expect(r[0].data?.autocars).toEqual([{ places: 55, preu: 610 }])
  })

  it('el mateix codi repetit dona dos autocars a la mateixa sortida', () => {
    // És el cas que motiva tot el disseny: 89 passatgers no hi caben en un.
    const r = interpreta([fila('EXC-0001', 55, 610), fila('EXC-0001', 40, 480)])
    expect(r).toHaveLength(1)
    expect(r[0].data?.autocars).toEqual([{ places: 55, preu: 610 }, { places: 40, preu: 480 }])
  })

  it('una fila sense preu se salta en silenci', () => {
    // L'empresa no ha pressupostat aquella sortida. És una resposta legítima.
    expect(interpreta([fila('EXC-0001')])).toEqual([])
  })

  it('les capçaleres es reconeixen sense accents i amb apòstrof recte', () => {
    const capçaleres = ['codi', 'data', 'dia', 'Destinacio', 'Poblacio', 'Grups', 'Passatgers',
      'Sortida', 'Tornada', 'places', 'PREU AUTOCAR', 'Preu per alumne', 'Preu total del grup']
    const r = interpretaPressupost([capçaleres, fila('EXC-0001', 55, 610)], [excursio()], SENSE_AUTOCARS, false, 10)
    expect(r[0].data?.autocars).toEqual([{ places: 55, preu: 610 }])
  })

  it('un full sense la columna del codi no es pot llegir', () => {
    expect(() => interpretaPressupost([['Data', 'Preu autocar'], ['2026-11-18', 610]], [excursio()], SENSE_AUTOCARS, false, 10))
      .toThrow('Codi')
  })

  it('un full buit no dona res i no peta', () => {
    expect(interpretaPressupost([], [excursio()], SENSE_AUTOCARS, false, 10)).toEqual([])
  })
})

describe('el que atura una fila', () => {
  it('un codi que no existeix', () => {
    const r = interpreta([fila('EXC-9999', 55, 610)])
    expect(r[0].valid).toBe(false)
    expect(r[0].error).toContain('no existeix')
  })

  it('una sortida cancel·lada', () => {
    const r = interpreta([fila('EXC-0001', 55, 610)], { excursions: [excursio({ Estat: 'Cancel·lada' })] })
    expect(r[0].valid).toBe(false)
    expect(r[0].error).toContain('cancel')
  })

  it('un preu que no és un número', () => {
    const r = interpreta([fila('EXC-0001', 55, 'a consultar')])
    expect(r[0].valid).toBe(false)
    expect(r[0].error).toContain('número')
  })

  it('un preu negatiu', () => {
    const r = interpreta([fila('EXC-0001', 55, -610)])
    expect(r[0].valid).toBe(false)
  })

  it('una fila d’autocar amb preu i sense places', () => {
    // Sense places no se sap si hi caben tots, i la fitxa n'ensenya el nombre.
    const r = interpreta([fila('EXC-0001', '', 610)])
    expect(r[0].valid).toBe(false)
    expect(r[0].error).toContain('places')
  })

  it('les dues columnes d’activitat plenes a la vegada', () => {
    // Si l'empresa ha escrit dos números, no sabem quin val. No se'n tria cap.
    const r = interpreta([fila('EXC-0001', '', '', 8, 200)])
    expect(r[0].valid).toBe(false)
    expect(r[0].error).toContain('dues')
  })

  it('dos preus d’activitat diferents per a la mateixa sortida', () => {
    const r = interpreta([fila('EXC-0001', 55, 610, 8), fila('EXC-0001', 40, 480, 9)])
    expect(r[0].valid).toBe(false)
    expect(r[0].error).toContain('activitat')
  })

  it('el mateix preu d’activitat repetit a les dues files no és error', () => {
    // L'empresa ha omplert la columna a totes dues línies amb el mateix número.
    const r = interpreta([fila('EXC-0001', 55, 610, 8), fila('EXC-0001', 40, 480, 8)])
    expect(r[0].valid).toBe(true)
    expect(r[0].data?.preuActivitat).toBe(8)
  })
})

describe('l’activitat', () => {
  it('per alumne', () => {
    const r = interpreta([fila('EXC-0001', '', '', 8)])
    expect(r[0].data?.preuActivitat).toBe(8)
    expect(r[0].data?.preuActivitatTipus).toBe('per_alumne')
  })

  it('total del grup', () => {
    const r = interpreta([fila('EXC-0001', '', '', '', 200)])
    expect(r[0].data?.preuActivitat).toBe(200)
    expect(r[0].data?.preuActivitatTipus).toBe('total')
  })

  it('sense cap de les dues, no se’n diu res', () => {
    const r = interpreta([fila('EXC-0001', 55, 610)])
    expect(r[0].data?.preuActivitat).toBeUndefined()
    expect(r[0].data?.preuActivitatTipus).toBeUndefined()
  })
})

describe('l’IVA', () => {
  it('sense marcar, es desa el que hi ha escrit', () => {
    expect(interpreta([fila('EXC-0001', 55, 610)])[0].data?.autocars[0].preu).toBe(610)
  })

  it('marcat, es desa el net', () => {
    // 610 amb un 10 % inclòs són 554,55 nets. El que es desa sempre és el net:
    // `calculaPreu` ja hi torna a aplicar l'IVA, i desar-hi el brut faria tots
    // els preus un 10 % alts sense que res ho detectés.
    expect(interpreta([fila('EXC-0001', 55, 610)], { portaIva: true })[0].data?.autocars[0].preu)
      .toBe(554.55)
  })

  it('també a l’activitat', () => {
    expect(interpreta([fila('EXC-0001', '', '', 12.1)], { portaIva: true })[0].data?.preuActivitat).toBe(11)
  })

  it('s’arrodoneix al cèntim, que és el que la columna admet', () => {
    const r = interpreta([fila('EXC-0001', 55, 100)], { portaIva: true, ivaPct: 21 })
    // 100 / 1,21 = 82,6446…
    expect(r[0].data?.autocars[0].preu).toBe(82.64)
  })
})

describe('el que avisa sense aturar', () => {
  it('una sortida que ja tenia autocars diu quants en perd', () => {
    const ambAutocars = new Map([['e1', { quants: 2, total: 1100 }]])
    const r = interpreta([fila('EXC-0001', 55, 610), fila('EXC-0001', 40, 480)], { ambAutocars })
    expect(r[0].valid).toBe(true)
    expect(r[0].substitueix).toEqual({ quants: 2, total: 1100 })
  })

  it('i si no en tenia, no diu res', () => {
    expect(interpreta([fila('EXC-0001', 55, 610)])[0].substitueix).toBeUndefined()
  })
})
```

- [ ] **Step 2: Executa-les i comprova que fallen**

Run: `npx vitest run src/modules/excursions/pressupostImport.utils.test.ts`
Expected: FAIL — el mòdul `./pressupostImport.utils` no existeix.

- [ ] **Step 3: Escriu `pressupostImport.utils.ts`**

```ts
// src/modules/excursions/pressupostImport.utils.ts
//
// El full que torna l'empresa amb els preus. Interpretar-lo està separat de
// llegir el fitxer a propòsit: aquí és on es decideix què entra a la base de
// dades, i això s'ha de poder provar amb una matriu escrita a mà.
//
// Una sortida pot ocupar **diverses files**, una per autocar, repetint el
// codi. El resultat, en canvi, és un element per codi: la previsualització
// ensenya «EXC-0004: 2 autocars», no dues línies soltes.
import type { Excursio } from './types'

export interface PreusImportats {
  /** Un per vehicle, amb el preu **net**. */
  autocars: { places: number; preu: number }[]
  /** Net. Absent si l'empresa no n'ha posat. */
  preuActivitat?: number
  preuActivitatTipus?: 'per_alumne' | 'total'
}

export interface FilaPressupost {
  /** La primera fila del full on surt aquest codi, per poder-la buscar. */
  fila: number
  codi: string
  /** Per ensenyar-ho a la previsualització sense haver de tornar a buscar. */
  lloc: string
  excursioId?: string
  valid: boolean
  error?: string
  /** Els autocars que aquesta sortida perdrà. */
  substitueix?: { quants: number; total: number }
  data?: PreusImportats
}

function text(v: unknown): string {
  return String(v ?? '').trim()
}

// Compara capçaleres escrites a mà en un full de càlcul: iguala els apòstrofs
// (Excel converteix ' en ’ tot sol) i ignora els accents, perquè qui ompli el
// full no hagi d'encertar «Destinació» amb accent. Mateix criteri que
// `src/modules/usuaris/excelImport.utils.ts`, copiat i no importat perquè
// aquest mòdul no ha de dependre del d'usuaris.
function clau(s: string): string {
  return s.trim().toLowerCase().replace(/[’‘`´]/g, '\'').normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

/** `null` quan la cel·la és buida; `NaN` quan hi ha alguna cosa que no és un número. */
function numero(v: unknown): number | null {
  const s = text(v)
  if (s === '') return null
  // Les comes decimals hi arriben quan algú escriu el número com a text.
  return Number(s.replace(/\s/g, '').replace(',', '.'))
}

function net(brut: number, portaIva: boolean, ivaPct: number): number {
  const valor = portaIva ? brut / (1 + ivaPct / 100) : brut
  // Al cèntim: les columnes són `numeric(10,2)` i els decimals de més es
  // perdrien en silenci en desar.
  return Math.round(valor * 100) / 100
}

interface FilaCrua {
  fila: number
  places: number | null
  preuAutocar: number | null
  perAlumne: number | null
  total: number | null
}

export function interpretaPressupost(
  matriu: unknown[][],
  excursions: Excursio[],
  ambAutocars: ReadonlyMap<string, { quants: number; total: number }>,
  portaIva: boolean,
  ivaPct: number,
): FilaPressupost[] {
  if (matriu.length === 0) return []

  const capcaleres = (matriu[0] ?? []).map((c) => clau(text(c)))
  const columna = (nom: string) => capcaleres.indexOf(clau(nom))
  const idx = {
    codi: columna('Codi'),
    places: columna('Places'),
    preuAutocar: columna('Preu autocar'),
    perAlumne: columna('Preu per alumne'),
    total: columna('Preu total del grup'),
  }
  if (idx.codi === -1) {
    throw new Error('El full no té la columna «Codi». Fes servir el fitxer que va sortir de l’aplicació.')
  }

  // Les files es recullen agrupades pel codi abans de jutjar res: una sortida
  // amb dos autocars s'ha de decidir sencera, no línia a línia.
  const perCodi = new Map<string, FilaCrua[]>()
  const ordre: string[] = []
  for (let i = 1; i < matriu.length; i++) {
    const row = matriu[i] ?? []
    const get = (c: number) => (c === -1 ? null : numero(row[c]))
    const codi = text(row[idx.codi])
    if (!codi) continue
    const crua: FilaCrua = {
      fila: i + 1,
      places: get(idx.places),
      preuAutocar: get(idx.preuAutocar),
      perAlumne: get(idx.perAlumne),
      total: get(idx.total),
    }
    // Una fila sense cap preu se salta: l'empresa no ha pressupostat aquella
    // sortida, que és una resposta legítima i no un error.
    if (crua.preuAutocar === null && crua.perAlumne === null && crua.total === null) continue
    const llista = perCodi.get(codi)
    if (llista) llista.push(crua)
    else { perCodi.set(codi, [crua]); ordre.push(codi) }
  }

  const perCodiExcursio = new Map(excursions.map((e) => [e.Codi, e]))
  const resultats: FilaPressupost[] = []

  for (const codi of ordre) {
    const crues = perCodi.get(codi) ?? []
    const e = perCodiExcursio.get(codi)
    const base = { fila: crues[0].fila, codi, lloc: e?.Lloc ?? '' }

    if (!e) {
      resultats.push({ ...base, valid: false, error: 'Aquest codi no existeix al curs.' })
      continue
    }
    if (e.Estat === 'Cancel·lada') {
      resultats.push({ ...base, valid: false, error: 'Aquesta sortida està cancel·lada.' })
      continue
    }

    const dolent = crues.find((c) =>
      [c.places, c.preuAutocar, c.perAlumne, c.total].some((n) => n !== null && !Number.isFinite(n)))
    if (dolent) {
      resultats.push({ ...base, fila: dolent.fila, valid: false, error: 'Hi ha un valor que no és un número.' })
      continue
    }
    const negatiu = crues.find((c) =>
      [c.places, c.preuAutocar, c.perAlumne, c.total].some((n) => n !== null && n < 0))
    if (negatiu) {
      resultats.push({ ...base, fila: negatiu.fila, valid: false, error: 'Hi ha un valor negatiu.' })
      continue
    }
    const sensePlaces = crues.find((c) => c.preuAutocar !== null && (c.places === null || c.places <= 0))
    if (sensePlaces) {
      resultats.push({ ...base, fila: sensePlaces.fila, valid: false, error: 'Un autocar amb preu i sense places.' })
      continue
    }
    const dues = crues.find((c) => c.perAlumne !== null && c.total !== null)
    if (dues) {
      resultats.push({
        ...base, fila: dues.fila, valid: false,
        error: 'Les dues columnes d’activitat estan plenes: no se sap quina val.',
      })
      continue
    }

    const ambActivitat = crues.filter((c) => c.perAlumne !== null || c.total !== null)
    const valors = new Set(ambActivitat.map((c) => `${c.perAlumne ?? ''}|${c.total ?? ''}`))
    if (valors.size > 1) {
      resultats.push({ ...base, valid: false, error: 'Dos preus d’activitat diferents per a la mateixa sortida.' })
      continue
    }

    const dades: PreusImportats = {
      autocars: crues
        .filter((c) => c.preuAutocar !== null)
        .map((c) => ({ places: c.places as number, preu: net(c.preuAutocar as number, portaIva, ivaPct) })),
    }
    const activitat = ambActivitat[0]
    if (activitat) {
      const perAlumne = activitat.perAlumne !== null
      dades.preuActivitat = net((perAlumne ? activitat.perAlumne : activitat.total) as number, portaIva, ivaPct)
      dades.preuActivitatTipus = perAlumne ? 'per_alumne' : 'total'
    }

    const tenia = dades.autocars.length > 0 ? ambAutocars.get(e.id) : undefined
    resultats.push({ ...base, excursioId: e.id, valid: true, data: dades, ...(tenia ? { substitueix: tenia } : {}) })
  }

  return resultats
}

export async function parsejaExcelPressupost(
  file: File,
  excursions: Excursio[],
  ambAutocars: ReadonlyMap<string, { quants: number; total: number }>,
  portaIva: boolean,
  ivaPct: number,
): Promise<FilaPressupost[]> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const matriu = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, blankrows: false })
  return interpretaPressupost(matriu, excursions, ambAutocars, portaIva, ivaPct)
}
```

- [ ] **Step 4: Executa i comprova que passen**

Run: `npx vitest run src/modules/excursions/pressupostImport.utils.test.ts`
Expected: PASS, 23 proves.

- [ ] **Step 5: Comprova amb dues mutacions**

1. Fes que `net` no divideixi mai (`const valor = brut`): han de fallar les proves de l'IVA.
2. Treu la comprovació de `sensePlaces`: ha de fallar «una fila d’autocar amb preu i sense places».

Desfés-les totes dues i digues a l'informe què va passar exactament a cada una.

- [ ] **Step 6: Commit**

```bash
git add src/modules/excursions/pressupostImport.utils.ts src/modules/excursions/pressupostImport.utils.test.ts
git commit -m "feat(pressupostos): llegir el full que torna l'empresa"
```

---

### Task 3: Escriure els preus importats

**Files:**
- Modify: `src/modules/excursions/useFinances.ts`
- Test: `src/modules/excursions/useFinances.test.ts`

**Interfaces:**
- Consumes: `PreusImportats` de `./pressupostImport.utils`.
- Produces: `useFinances().importaPressupostos(items: { excursioId: string; dades: PreusImportats }[]): Promise<void>`.

**Context que et cal i que no pots endevinar:**

- `useFinances` ja té `carrega` i `desa`. **No les toquis**: `desa` fa servir un `upsert` a `excursio_finances` i posa al dia els autocars per diferència.
- `importaPressupostos` **no ha de tocar l'estat del store** (`finances`, `loading`, `error`): escriu diverses sortides seguides i la fitxa oberta, si n'hi ha, és d'una altra.
- `excursio_finances` té `excursio_id` com a **clau primària** i cap columna `id`, per això `desa` fa servir `supabase.from(...).upsert(...)` i no `updateRowById`. Fes igual.
- **Un `upsert` reemplaça la fila sencera.** `ampa_import`, `ampa_cobreix_activitat` i `cost_acompanyants` s'han de llegir abans i tornar-hi, o una importació els posaria a zero.
- **Primer s'insereixen els autocars nous i després s'esborren els vells.** Si una escriptura peta enmig, el pitjor que passa és que la sortida tingui autocars duplicats —visibles a la fitxa i esborrables— en comptes de quedar-se sense cap preu.
- Els ajudants són a `src/services/db.ts`: `getAll`, `insertRow`, `deleteRowById`, i `supabase` per a l'`upsert`.

- [ ] **Step 1: Escriu les proves que fallen**

Afegeix a `src/modules/excursions/useFinances.test.ts` (mira com el fitxer ja simula `../../services/db` i reaprofita'n el muntatge; si el `beforeEach` no fa `vi.clearAllMocks()`, afegeix-l'hi):

```ts
import { useFinances } from './useFinances'

describe('importar pressupostos', () => {
  it('insereix un autocar per fila i esborra els que hi havia', async () => {
    await useFinances.getState().importaPressupostos([
      { excursioId: 'e1', dades: { autocars: [{ places: 55, preu: 610 }, { places: 40, preu: 480 }] } },
    ])
    const inserits = vi.mocked(db.insertRow).mock.calls.filter((c) => c[0] === 'excursio_autocars')
    expect(inserits.map((c) => c[1])).toEqual([
      { excursio_id: 'e1', places: 55, preu: 610 },
      { excursio_id: 'e1', places: 40, preu: 480 },
    ])
  })

  it('els nous entren abans que s’esborrin els vells', async () => {
    // Si peta enmig, val més una sortida amb autocars duplicats —que es veuen
    // a la fitxa i s'esborren— que una que s'ha quedat sense cap preu.
    const ordre: string[] = []
    vi.mocked(db.insertRow).mockImplementation(async (taula: string) => { ordre.push(`insert ${taula}`); return {} as never })
    vi.mocked(db.deleteRowById).mockImplementation(async (taula: string) => { ordre.push(`delete ${taula}`) })
    await useFinances.getState().importaPressupostos([
      { excursioId: 'e1', dades: { autocars: [{ places: 55, preu: 610 }] } },
    ])
    expect(ordre.indexOf('insert excursio_autocars')).toBeLessThan(ordre.indexOf('delete excursio_autocars'))
  })

  it('el preu de l’activitat entra amb el seu tipus', async () => {
    await useFinances.getState().importaPressupostos([
      { excursioId: 'e1', dades: { autocars: [], preuActivitat: 8, preuActivitatTipus: 'per_alumne' } },
    ])
    expect(upsertsFets()[0]).toMatchObject({
      excursio_id: 'e1', preu_activitat: 8, preu_activitat_tipus: 'per_alumne',
    })
  })

  it('sense preu d’activitat, el que ja hi havia no es toca', async () => {
    financesExistents({ preu_activitat: '99', preu_activitat_tipus: 'total' })
    await useFinances.getState().importaPressupostos([
      { excursioId: 'e1', dades: { autocars: [{ places: 55, preu: 610 }] } },
    ])
    expect(upsertsFets()[0]).toMatchObject({ preu_activitat: 99, preu_activitat_tipus: 'total' })
  })

  it('no esborra l’AMPA ni el cost dels acompanyants', async () => {
    // L'`upsert` reemplaça la fila sencera: sense tornar-hi el que ja hi havia,
    // una importació de preus d'autocar buidaria l'aportació de l'AMPA.
    financesExistents({ ampa_import: '4', ampa_cobreix_activitat: true, cost_acompanyants: '45' })
    await useFinances.getState().importaPressupostos([
      { excursioId: 'e1', dades: { autocars: [{ places: 55, preu: 610 }] } },
    ])
    expect(upsertsFets()[0]).toMatchObject({
      ampa_import: 4, ampa_cobreix_activitat: true, cost_acompanyants: 45,
    })
  })

  it('no toca l’estat del store', async () => {
    // Escriu diverses sortides seguides, i la fitxa que hi hagi oberta és
    // d'una altra: canviar-li els costos de sota ensenyaria els d'una tercera.
    useFinances.setState({ finances: null, loading: false, error: null })
    await useFinances.getState().importaPressupostos([
      { excursioId: 'e1', dades: { autocars: [{ places: 55, preu: 610 }] } },
    ])
    expect(useFinances.getState()).toMatchObject({ finances: null, loading: false, error: null })
  })

  it('importar dues vegades el mateix fitxer deixa el mateix resultat', async () => {
    // La raó de substituir en comptes de sumar: sumar-los doblaria el cost en
    // silenci, que és la classe d'error que ningú no troba fins que el preu ja
    // és a casa de les famílies.
    autocarsExistents([{ id: 'a1', places: 55, preu: '610' }])
    await useFinances.getState().importaPressupostos([
      { excursioId: 'e1', dades: { autocars: [{ places: 55, preu: 610 }] } },
    ])
    const inserits = vi.mocked(db.insertRow).mock.calls.filter((c) => c[0] === 'excursio_autocars')
    const esborrats = vi.mocked(db.deleteRowById).mock.calls.filter((c) => c[0] === 'excursio_autocars')
    expect(inserits).toHaveLength(1)
    expect(esborrats.map((c) => c[1])).toEqual(['a1'])
  })

  it('escriu totes les sortides de la llista', async () => {
    await useFinances.getState().importaPressupostos([
      { excursioId: 'e1', dades: { autocars: [{ places: 55, preu: 610 }] } },
      { excursioId: 'e2', dades: { autocars: [{ places: 30, preu: 300 }] } },
    ])
    const inserits = vi.mocked(db.insertRow).mock.calls.filter((c) => c[0] === 'excursio_autocars')
    expect(inserits).toHaveLength(2)
  })
})
```

Per a `upsertsFets()`, `financesExistents(...)` i `autocarsExistents(...)`, mira com el fitxer simula avui `supabase.from(...).upsert(...)` i `getAll` i escriu-hi tres ajudants a joc amb el que ja hi ha: el primer torna els objectes enviats a l'`upsert`, i els altres dos fan que `getAll` respongui amb aquelles files per a `excursio_finances` i per a `excursio_autocars` respectivament. Si el fitxer encara no simula l'`upsert`, afegeix-hi la simulació seguint el patró de les proves de `desa`.

- [ ] **Step 2: Executa-les i comprova que fallen**

Run: `npx vitest run src/modules/excursions/useFinances.test.ts`
Expected: FAIL — `importaPressupostos is not a function`.

- [ ] **Step 3: Implementa-ho**

A `src/modules/excursions/useFinances.ts`, afegeix `importaPressupostos` a la interfície de l'estat i al cos de l'store:

```ts
  /**
   * Escriu els preus que han tornat de l'empresa. No toca l'estat del store:
   * escriu diverses sortides seguides i la fitxa que hi hagi oberta és d'una
   * altra, així que canviar-li els costos de sota ensenyaria els d'una tercera.
   */
  async importaPressupostos(items) {
    for (const { excursioId, dades } of items) {
      // La fila de finances es llegeix abans perquè l'`upsert` la reemplaça
      // sencera: sense tornar-hi el que ja hi havia, importar preus d'autocar
      // buidaria l'aportació de l'AMPA i el cost dels acompanyants.
      const [actual] = await getAll<FinancesRow>(
        'excursio_finances', 'excursio_id', { excursio_id: excursioId }, 'excursio_id')

      const { error } = await supabase.from('excursio_finances').upsert({
        excursio_id: excursioId,
        preu_activitat: dades.preuActivitat ?? Number(actual?.preu_activitat ?? 0),
        preu_activitat_tipus: dades.preuActivitatTipus ?? actual?.preu_activitat_tipus ?? 'per_alumne',
        ampa_import: Number(actual?.ampa_import ?? 0),
        ampa_cobreix_activitat: actual?.ampa_cobreix_activitat ?? false,
        cost_acompanyants: Number(actual?.cost_acompanyants ?? 0),
      })
      if (error) throw new Error(`Error desant els costos: ${error.message}`)

      if (dades.autocars.length > 0) {
        const vells = await getAll<AutocarRow>('excursio_autocars', 'id', { excursio_id: excursioId })
        // Primer els nous i després esborrar els vells: si peta enmig, val més
        // una sortida amb autocars duplicats —que es veuen a la fitxa i
        // s'esborren— que una que s'ha quedat sense cap preu.
        for (const a of dades.autocars) {
          await insertRow('excursio_autocars', { excursio_id: excursioId, places: a.places, preu: a.preu })
        }
        for (const v of vells) await deleteRowById('excursio_autocars', v.id)
      }
    }
  },
```

A la interfície `FinancesState`:

```ts
  importaPressupostos: (items: { excursioId: string; dades: PreusImportats }[]) => Promise<void>
```

I a dalt del fitxer: `import type { PreusImportats } from './pressupostImport.utils'`.

- [ ] **Step 4: Executa i comprova que passen**

Run: `npx vitest run src/modules/excursions/useFinances.test.ts`
Expected: PASS.

- [ ] **Step 5: Comprova amb una mutació**

Treu `ampa_import: Number(actual?.ampa_import ?? 0)` i posa-hi `ampa_import: 0`. Ha de fallar «no esborra l’AMPA ni el cost dels acompanyants». Desfés-ho.

- [ ] **Step 6: Totes les portes**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Informa del nombre de **fitxers** de prova, no només del de proves.

- [ ] **Step 7: Commit**

```bash
git add src/modules/excursions/useFinances.ts src/modules/excursions/useFinances.test.ts
git commit -m "feat(pressupostos): escriure els preus que han tornat"
```

---

### Task 4: Les dues finestres

**Files:**
- Create: `src/modules/excursions/DemanarPressupostModal.tsx`
- Create: `src/modules/excursions/ImportarPressupostModal.tsx`

**Interfaces:**
- Consumes: `pendentsDePressupost`, `passatgers`, `generaExcelPressupost`, `QueEsDemana` de `./pressupostExport.utils`; `parsejaExcelPressupost`, `FilaPressupost`, `PreusImportats` de `./pressupostImport.utils`.
- Produces:
  - `<DemanarPressupostModal excursions={Excursio[]} ambAutocars={ReadonlySet<string>} empreses={string[]} curs={string} onClose={() => void} />`
  - `<ImportarPressupostModal excursions={Excursio[]} ambAutocars={ReadonlyMap<string, { quants: number; total: number }>} ivaPct={number} onImportar={(items: { excursioId: string; dades: PreusImportats }[]) => Promise<void>} onClose={() => void} />`

**Restriccions d'aquesta tasca:**

- **Cap lògica nova dins els `.tsx`.** No hi ha proves de components (Vitest corre sense DOM): tot el que es pugui provar ja viu als dos mòduls de les Tasks 1 i 2. Si et sembla que en cal una de nova, **atura't i digues-m'ho**.
- **Copia l'estructura de `src/modules/usuaris/ImportarUsuarisModal.tsx`**: capçalera amb títol i botó de tancar, zona de fitxer, resum en tres blocs (vàlides / avisos / errors), taula de previsualització i botó de confirmar. No n'inventis una de nova.
- Tailwind, i els colors del mòdul: verd `text-emerald-700`, vermell `text-red-700`, ambre `text-amber-800` per als avisos, gris secundari `text-gray-500`.
- Els missatges d'error de pantalla porten `role="alert"`.

- [ ] **Step 1: La finestra de demanar**

Crea `src/modules/excursions/DemanarPressupostModal.tsx`. Ha de portar:

- Un selector d'**empresa** (`<select>` amb `empreses`; si la llista és buida, un camp de text lliure i una nota que es pot configurar la llista a Configuració).
- Tres opcions de **què es demana** (`autocar`, `activitat`, `ambdues`), amb `autocar` com a valor inicial.
- La llista de `pendentsDePressupost(excursions, ambAutocars)` amb una casella per sortida, **totes marcades d'entrada**, i per a cadascuna: codi, data, destinació i `passatgers(e)`.
- Si la llista és buida, un text que ho expliqui: cap sortida aprovada amb autocar i sense preu.
- Un botó **«Baixa el full»** que crida `generaExcelPressupost(seleccionades, demana, empresa, curs)` i tanca. Desactivat si no hi ha cap sortida seleccionada.
- Una nota al peu: el full no porta cap preu ni cap nom; s'envia a l'empresa com sempre.

- [ ] **Step 2: La finestra d'importar**

Crea `src/modules/excursions/ImportarPressupostModal.tsx`. Ha de portar:

- Una **casella «Els preus d'aquest fitxer porten IVA»**, apagada d'entrada, **per damunt del selector de fitxer**, amb una nota que digui que es desarà sempre el net. En canviar-la amb un fitxer ja llegit, **s'ha de tornar a interpretar** (guarda el `File` a l'estat i torna a cridar `parsejaExcelPressupost`), perquè si no la previsualització ensenyaria els números de l'altra opció.
- El selector de fitxer (`accept=".xlsx,.xls"`), com a `ImportarUsuarisModal`.
- La taula de previsualització, una línia per codi: codi, destinació, què entra («2 autocars · 1.090 €» / «activitat 8 € per alumne»), i quan `portaIva`, **les dues xifres, brut i net**. Les que porten `substitueix` en ambre amb «substitueix 2 autocars (1.100 €)». Les que tenen `error`, en vermell amb el número de fila i el missatge.
- Un botó **«Importa'ls»** amb el recompte, que crida `onImportar` amb les vàlides i tanca si tot va bé. Desactivat si no n'hi ha cap.
- Per formatar imports: `n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR' })`, com a la resta del mòdul.

- [ ] **Step 3: Comprova que compila i que el linter hi està d'acord**

Run: `npm run typecheck && npm run lint`

- [ ] **Step 4: Commit**

```bash
git add src/modules/excursions/DemanarPressupostModal.tsx src/modules/excursions/ImportarPressupostModal.tsx
git commit -m "feat(pressupostos): les finestres de demanar i d'importar"
```

---

### Task 5: Cablejat, permisos i configuració

**Files:**
- Modify: `src/store/configStore.ts`
- Modify: `src/modules/excursions/ExcursionsPage.tsx`
- Modify: `src/app/routes/ExcursionsWrapper.tsx`
- Modify: `src/modules/configuracio/ConfiguracioPage.tsx`

**Interfaces:**
- Consumes: tot el de les Tasks 1-4.
- Produces: els dos botons a la pantalla d'excursions i la clau `excursions.empreses-autocar`.

**Context que et cal i que no pots endevinar:**

- `CONFIG_DEFAULTS` és a `src/store/configStore.ts`; `reserves.espais` hi és a prop i és el model d'una llista editable. Afegeix-hi `'excursions.empreses-autocar': []`.
- La pantalla de Configuració llista les claus per seccions; mira com hi surt `reserves.espais` i afegeix-hi la nova al costat de les altres d'excursions, amb una etiqueta en català.
- **`ExcursionsWrapper` ja calcula** `potGestionar(rol, jo)` i `potVeureCostos(rol, jo)`. Reaprofita'ls, no en facis cap de nou.
- Els autocars **no es carreguen avui a la pantalla de llista**: `useExcursions` no els llegeix. Per a `ambAutocars` cal una lectura nova. Fes-la al wrapper amb `getAll<{ excursio_id: string; preu: string | number }>('excursio_autocars', 'id')`, dins un `useEffect` que **només s'executi si `potVeureCostos`** — la taula té l'accés restringit i a qui no en tingui l'RLS li tornarà zero files, que no és el mateix que «no en té cap». Agrupa-les en el `Set` i el `Map` que les dues finestres esperen, comptant només les que tenen `preu > 0`.
- El router és un **HashRouter**; els enllaços interns van amb `<Link>`.

- [ ] **Step 1: La clau de configuració**

A `src/store/configStore.ts`, dins `CONFIG_DEFAULTS`, al costat de les altres claus `excursions.*`:

```ts
  // Buida a posta: el centre n'hi posa les seves. Serveix per titular el full
  // que s'envia; no es desa a cap fila.
  'excursions.empreses-autocar': [],
```

I a `src/modules/configuracio/ConfiguracioPage.tsx`, la seva etiqueta a la secció d'excursions: **«Empreses d'autocar»**.

- [ ] **Step 2: El filtre i els botons**

A `src/modules/excursions/ExcursionsPage.tsx`:

- Afegeix-hi les propietats `potGestionar: boolean`, `pendentsDePressupostIds: ReadonlySet<string>`, `onDemanarPressupost: () => void` i `onImportarPressupost: () => void`.
- A la barra de filtres que ja hi ha, una casella **«Només pendents de pressupost»** que filtri per `pendentsDePressupostIds`.
- A la capçalera, al costat de l'enllaç d'Economia: un botó **«Demana pressupost»** visible només si `potGestionar`, i un **«Importa pressupost»** visible només si `potVeureCostos` (la propietat ja hi és des del panell econòmic).

- [ ] **Step 3: El cablejat**

A `src/app/routes/ExcursionsWrapper.tsx`: l'estat de les dues finestres, la lectura d'autocars descrita més amunt, i passar-ho tot. `onImportar` crida `useFinances.getState().importaPressupostos(items)` i després `load()` i torna a llegir els autocars, perquè el filtre de «pendents» quedi al dia.

- [ ] **Step 4: Totes les portes**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Informa del nombre de **fitxers** de prova, no només del de proves.

- [ ] **Step 5: Commit**

```bash
git add src/store/configStore.ts src/modules/configuracio/ConfiguracioPage.tsx src/modules/excursions/ExcursionsPage.tsx src/app/routes/ExcursionsWrapper.tsx
git commit -m "feat(pressupostos): el filtre, els botons i la llista d'empreses"
```

---

## Comprovació manual abans de fusionar

El circuit sencer no es pot provar amb Vitest, i és el que de debò farà Secretaria:

1. `npm run dev`, com a coordinador: **Demana pressupost**, tria autocar, baixa el full, i obre'l amb Excel o Numbers. Comprova que les capçaleres es llegeixen, que hi ha una fila per sortida i que **no hi surt cap nom**.
2. Omple dues files amb el mateix codi (dos autocars) i una activitat, desa'l, i **Importa pressupost**. Mira que la previsualització digui «2 autocars» en una sola línia.
3. Torna a importar el mateix fitxer: el resultat ha de ser **idèntic**, no el doble.
4. Marca la casella d'IVA amb el mateix fitxer i mira que els números baixin i que s'ensenyin les dues xifres.
5. Entra com un docent sense la casella de costos: ha de veure **Demana pressupost** si gestiona, i **no** ha de veure **Importa pressupost**.

## Què no entra

Enviar el fitxer per correu des de l'aplicació; una taula de proveïdors; guardar l'històric de pressupostos rebuts o comparar-los dins l'aplicació; autocars de dues empreses a la mateixa sortida; i qualsevol dada d'alumnat.
