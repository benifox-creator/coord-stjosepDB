# Barra de filtres comuna i camp «Destí» — pla d'implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objectiu:** que els 10 llistats (Inventari i 9 més) comparteixin la capçalera compacta d'Inventari, i que els préstecs tinguin un camp «Destí».

**Arquitectura:**
- Peces comunes a `src/components/filtres/`:
  - un mòdul pur `filtres.ts` (definicions de filtre i xips), amb proves;
  - un hook `useValorsFiltres`;
  - dos components: `BarraFiltres` (cerca + botó «Filtres» + panell + xips) i `PindolesFiltre` (comptadors en píndola).
- Cada pantalla declara els seus filtres i conserva la seva lògica de filtrar.
- «Destí» és una columna nova de `prestecs`, que desa `create_loan`.

**Stack:** React 19 + TypeScript estricte (`verbatimModuleSyntax`, `noUnusedLocals`), Tailwind, Vitest (entorn node, sense proves de components), PGlite per a les proves de BD (`tests/database.test.ts` aplica totes les migracions en ordre).

**Spec:** `docs/superpowers/specs/2026-10-06-barra-filtres-comuna-design.md`

## Global Constraints

- Textos de pantalla, comentaris i commits en català.
- Apòstrof tipogràfic `’` (U+2019) en els textos que veu l'usuari. Els comentaris poden fer servir `'`.
- Mai `text-gray-400` per a text que s'ha de llegir: `text-gray-500` o més fosc. Les icones poden ser `text-gray-400`.
- **No es toca la lògica de filtrar de cap pantalla**: la mateixa condició sobre el mateix camp. Sí que es pot reanomenar d'on surt el valor (`filtreEstat` → `valors.estat`).
- Ni filtres nous, ni cercadors nous, ni canvis a les taules (excepte el destí de Préstecs, a la tasca 6).
- Mai editar `supabase/schema.sql` ni cap migració ja aplicada. Els canvis de BD van en una migració nova.
- Cada commit acaba amb `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Si l'implementa un altre model, posa el nom d'aquell model.
- Abans de cada commit: `npm run typecheck && npm run lint && npm test` nets.

---

## Estructura de fitxers

| Fitxer | Responsabilitat |
|---|---|
| `src/components/filtres/filtres.ts` (nou) | Tipus de definició de filtre, `opcions()`, `dataCurta()`, `filtresActius()` |
| `src/components/filtres/filtres.test.ts` (nou) | Proves del mòdul pur |
| `src/components/filtres/useValorsFiltres.ts` (nou) | Estat dels valors: `canvia` i `esborra` |
| `src/components/filtres/BarraFiltres.tsx` (nou) | Cerca opcional, botó «Filtres», panell, xips |
| `src/components/filtres/PindolesFiltre.tsx` (nou) | Comptadors en píndola, que filtren o són informatius |
| `src/modules/inventari/*` | Passa a les peces comunes |
| 9 pàgines de llistat | Passen a les peces comunes |
| `supabase/migrations/202610080001_prestecs_desti.sql` (nou) | Columna `desti` + `create_loan` |
| `src/modules/prestecs/*` | Camp Destí |

---

### Tasca 1: Peces comunes

**Fitxers:**
- Crear: `src/components/filtres/filtres.ts`, `filtres.test.ts`, `useValorsFiltres.ts`, `BarraFiltres.tsx`, `PindolesFiltre.tsx`

**Interfícies:**
- Produeix: tot el que hi ha al codi de sota, amb aquests noms exactes. Les tasques 2–5 en depenen.

- [ ] **Pas 1: Escriure les proves** a `src/components/filtres/filtres.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { filtresActius, opcions, dataCurta } from './filtres'
import type { DefinicioFiltre } from './filtres'

const DEFS: DefinicioFiltre[] = [
  { clau: 'estat', label: 'Estat', tipus: 'select', totes: 'Tots', opcions: [{ valor: 'avariats', etiqueta: 'Avariats o en reparació' }, ...opcions(['Actiu', 'Robat'])] },
  { clau: 'data', label: 'Data', tipus: 'data' },
  { clau: 'categoria', label: 'Tipus', tipus: 'select', totes: 'Tots', opcions: opcions(['PC', 'Tauleta']) },
]

describe('opcions', () => {
  it('fa servir el mateix text com a valor i com a etiqueta', () => {
    expect(opcions(['A', 'B'])).toEqual([{ valor: 'A', etiqueta: 'A' }, { valor: 'B', etiqueta: 'B' }])
  })
})

describe('dataCurta', () => {
  it('passa una data ISO a dd/mm/aaaa', () => {
    expect(dataCurta('2026-10-08')).toBe('08/10/2026')
  })
  it('deixa tal qual el que no és una data ISO', () => {
    expect(dataCurta('demà')).toBe('demà')
  })
})

describe('filtresActius', () => {
  it('sense valors no hi ha cap xip', () => {
    expect(filtresActius(DEFS, { estat: '', data: '', categoria: '' })).toEqual([])
    expect(filtresActius(DEFS, {})).toEqual([])
  })

  it('un xip per filtre amb valor, en l’ordre de les definicions', () => {
    expect(filtresActius(DEFS, { categoria: 'PC', data: '2026-10-08', estat: 'Robat' })).toEqual([
      { clau: 'estat', etiqueta: 'Estat: Robat' },
      { clau: 'data', etiqueta: 'Data: 08/10/2026' },
      { clau: 'categoria', etiqueta: 'Tipus: PC' },
    ])
  })

  it('fa servir l’etiqueta de l’opció, no el valor', () => {
    expect(filtresActius(DEFS, { estat: 'avariats' })).toEqual([{ clau: 'estat', etiqueta: 'Estat: Avariats o en reparació' }])
  })

  it('un valor que ja no és entre les opcions es mostra tal qual', () => {
    expect(filtresActius(DEFS, { categoria: 'Projector' })).toEqual([{ clau: 'categoria', etiqueta: 'Tipus: Projector' }])
  })

  it('ignora valors sense definició (per exemple, la cerca)', () => {
    expect(filtresActius(DEFS, { cerca: 'acer' })).toEqual([])
  })
})
```

- [ ] **Pas 2:** `npx vitest run src/components/filtres/filtres.test.ts` → ha de FALLAR perquè el mòdul no existeix.

- [ ] **Pas 3: Escriure `src/components/filtres/filtres.ts`**

```ts
// Definicions dels filtres d'un llistat i els xips que en surten. Cada
// pantalla declara els seus filtres; BarraFiltres els pinta.

export interface OpcioFiltre {
  valor: string
  etiqueta: string
}

interface BaseFiltre {
  clau: string
  label: string
}

export interface FiltreSelect extends BaseFiltre {
  tipus: 'select'
  // Text de l'opció buida: «Tots», «Totes», «Tot el curs»…
  totes: string
  opcions: OpcioFiltre[]
}

export interface FiltreData extends BaseFiltre {
  tipus: 'data'
  min?: string
  max?: string
}

export type DefinicioFiltre = FiltreSelect | FiltreData

// '' = sense filtre.
export type ValorsFiltres = Record<string, string>

export interface FiltreActiu {
  clau: string
  etiqueta: string
}

export function opcions(valors: readonly string[]): OpcioFiltre[] {
  return valors.map((v) => ({ valor: v, etiqueta: v }))
}

export function dataCurta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

// Un xip per cada filtre amb valor, en l'ordre de les definicions. La cerca
// no en fa: ja es veu escrita al quadre.
export function filtresActius(defs: DefinicioFiltre[], valors: ValorsFiltres): FiltreActiu[] {
  return defs.flatMap((d) => {
    const v = valors[d.clau] ?? ''
    if (!v) return []
    const text = d.tipus === 'data' ? dataCurta(v) : (d.opcions.find((o) => o.valor === v)?.etiqueta ?? v)
    return [{ clau: d.clau, etiqueta: `${d.label}: ${text}` }]
  })
}
```

- [ ] **Pas 4:** `npx vitest run src/components/filtres/filtres.test.ts` → ha de PASSAR.

- [ ] **Pas 5: Escriure `src/components/filtres/useValorsFiltres.ts`**

```ts
import { useCallback, useState } from 'react'
import type { ValorsFiltres } from './filtres'

// Estat dels filtres d'un llistat. `esborra` torna als valors inicials.
export function useValorsFiltres<T extends ValorsFiltres>(inicials: T) {
  const [buits] = useState(inicials)
  const [valors, setValors] = useState<T>(inicials)
  const canvia = useCallback((clau: string, valor: string) => {
    setValors((v) => ({ ...v, [clau]: valor }))
  }, [])
  const esborra = useCallback(() => setValors(buits), [buits])
  return { valors, canvia, esborra }
}
```

- [ ] **Pas 6: Escriure `src/components/filtres/BarraFiltres.tsx`**

Està copiat de la capçalera actual d'Inventari (`src/modules/inventari/InventariPage.tsx`: files de cerca, panell i xips). `children` són controls extra de la pantalla, com una casella o un botó d'acció, i van entre la cerca i el botó «Filtres».

```tsx
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import type { DefinicioFiltre, ValorsFiltres } from './filtres'
import { filtresActius } from './filtres'

interface Props {
  definicions: DefinicioFiltre[]
  valors: ValorsFiltres
  onCanvia: (clau: string, valor: string) => void
  // Posa tots els filtres a '' sense tocar la cerca.
  onEsborra: () => void
  cerca?: string
  onCerca?: (text: string) => void
  placeholder?: string
  children?: ReactNode
}

function CampFiltre({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  )
}

export function BarraFiltres({ definicions, valors, onCanvia, onEsborra, cerca, onCerca, placeholder, children }: Props) {
  const [panellObert, setPanellObert] = useState(false)
  const panellRef = useRef<HTMLDivElement>(null)
  const actius = filtresActius(definicions, valors)
  const ambCerca = cerca !== undefined && onCerca !== undefined

  // El panell es tanca clicant fora o amb Esc, com qualsevol menú.
  useEffect(() => {
    if (!panellObert) return
    function clic(e: MouseEvent) {
      if (panellRef.current && !panellRef.current.contains(e.target as Node)) setPanellObert(false)
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setPanellObert(false)
    }
    document.addEventListener('mousedown', clic)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', clic)
      document.removeEventListener('keydown', tecla)
    }
  }, [panellObert])

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-3">
        {ambCerca && (
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={cerca}
              onChange={(e) => onCerca(e.target.value)}
              placeholder={placeholder}
              className="input pl-8 text-sm w-full"
            />
          </div>
        )}
        {children}
        <div ref={panellRef} className={`relative ${ambCerca ? '' : 'ml-auto'}`}>
          <button
            type="button"
            aria-expanded={panellObert}
            onClick={() => setPanellObert((o) => !o)}
            className={`flex items-center gap-1.5 h-full min-h-9 px-3 text-sm font-medium border rounded-lg transition-colors ${
              actius.length > 0 ? 'border-primary/40 text-primary bg-primary/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filtres
            {actius.length > 0 && (
              <span className="min-w-5 h-5 px-1 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                {actius.length}
              </span>
            )}
          </button>
          {panellObert && (
            <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-20 space-y-2.5">
              {definicions.map((d) => (
                <CampFiltre key={d.clau} label={d.label}>
                  {d.tipus === 'select' ? (
                    <select value={valors[d.clau] ?? ''} onChange={(e) => onCanvia(d.clau, e.target.value)} className="input text-sm w-full">
                      <option value="">{d.totes}</option>
                      {d.opcions.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
                    </select>
                  ) : (
                    <input
                      type="date"
                      value={valors[d.clau] ?? ''}
                      min={d.min || undefined}
                      max={d.max || undefined}
                      onChange={(e) => onCanvia(d.clau, e.target.value)}
                      className="input text-sm w-full"
                    />
                  )}
                </CampFiltre>
              ))}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={onEsborra}
                  disabled={actius.length === 0}
                  className="text-xs text-primary hover:underline disabled:opacity-40 disabled:no-underline"
                >
                  Esborra filtres
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Xips dels filtres actius */}
      {actius.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {actius.map(({ clau, etiqueta }) => (
            <span key={clau} className="flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-gray-100 text-xs text-gray-700">
              {etiqueta}
              <button
                type="button"
                onClick={() => onCanvia(clau, '')}
                aria-label={`Treu el filtre ${etiqueta}`}
                className="p-0.5 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {actius.length > 1 && (
            <button type="button" onClick={onEsborra} className="text-xs text-primary hover:underline ml-1">
              Esborra-ho tot
            </button>
          )}
        </div>
      )}
    </>
  )
}
```

- [ ] **Pas 7: Escriure `src/components/filtres/PindolesFiltre.tsx`**

```tsx
import type { ValorsFiltres } from './filtres'

export interface Pindola {
  label: string
  val: number
  color: string
  // Sense `filtre` la píndola només informa, i no té clic.
  filtre?: { clau: string; valor: string }
}

interface Props {
  pindoles: Pindola[]
  valors: ValorsFiltres
  onCanvia: (clau: string, valor: string) => void
}

export function PindolesFiltre({ pindoles, valors, onCanvia }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pindoles.map(({ label, val, color, filtre }) => {
        if (!filtre) {
          return (
            <span key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 text-xs text-gray-600">
              <span className="font-bold" style={{ color }}>{val}</span>
              {label}
            </span>
          )
        }
        const actiu = valors[filtre.clau] === filtre.valor
        return (
          <button
            key={label}
            type="button"
            aria-pressed={actiu}
            onClick={() => onCanvia(filtre.clau, actiu ? '' : filtre.valor)}
            title={actiu ? 'Treu aquest filtre' : `Mostra només: ${label}`}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-colors ${
              actiu ? 'border-transparent text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            style={actiu ? { backgroundColor: color } : undefined}
          >
            <span className="font-bold" style={actiu ? undefined : { color }}>{val}</span>
            {label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Pas 8:** `npm run typecheck && npm run lint && npm test` → tot net.

- [ ] **Pas 9: Commit**

```bash
git add src/components/filtres
git commit -m "feat: peces comunes de la barra de filtres

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tasca 2: Inventari passa a les peces comunes

**Fitxers:**
- Modificar: `src/modules/inventari/filtres.ts`, `src/modules/inventari/filtres.test.ts`, `src/modules/inventari/InventariPage.tsx`

**Interfícies:**
- Consumeix: `BarraFiltres`, `PindolesFiltre`, `DefinicioFiltre`, `opcions` (tasca 1).

- [ ] **Pas 1: `inventari/filtres.ts`**
  - Treure'n `filtresActius`, `ClauFiltre` i `FiltreActiu`.
  - Canviar `export interface FiltresInventari { … }` per `export type FiltresInventari = { … }`, amb els mateixos camps. Un `type` és assignable a `Record<string, string>` (`ValorsFiltres`); una `interface` no ho és.
  - `filtraInventari`, `FILTRES_BUITS` i `FiltreEstat` es queden igual.

- [ ] **Pas 2: `inventari/filtres.test.ts`**
  - Esborrar el bloc `describe('filtresActius', …)` i treure `filtresActius` de l'import.
  - Les proves de `filtraInventari` es queden.

- [ ] **Pas 3: `InventariPage.tsx`**
  - Treure `CampFiltre`, `panellObert`, `panellRef`, el `useEffect` del panell, `treu`, i els blocs JSX de cerca, panell, xips i píndoles. També els imports que quedin sense ús (`useEffect`, `useRef`, `Search`, `SlidersHorizontal`, `X`, `ESTATS_INVENTARI` si ja no surt).
  - En el seu lloc:

```tsx
const definicions: DefinicioFiltre[] = useMemo(() => [
  { clau: 'estat', label: 'Estat', tipus: 'select', totes: 'Tots', opcions: [{ valor: 'avariats', etiqueta: 'Avariats o en reparació' }, ...opcions(ESTATS_INVENTARI)] },
  { clau: 'categoria', label: 'Tipus', tipus: 'select', totes: 'Tots', opcions: opcions(categories) },
  { clau: 'ubicacio', label: 'Ubicació', tipus: 'select', totes: 'Totes', opcions: ubicacions.map((u) => ({ valor: u.Codi, etiqueta: ubicacioCompleta(u.Codi, ubicacions) })) },
  { clau: 'accio', label: 'Acció pendent', tipus: 'select', totes: 'Totes', opcions: [{ valor: 'qualsevol', etiqueta: 'Amb alguna acció pendent' }, ...opcions(accions)] },
], [categories, ubicacions, accions])

const pindoles: Pindola[] = useMemo(() => [
  { label: 'Actius', val: items.filter((i) => i.Estat === 'Actiu').length, color: '#15803d', filtre: { clau: 'estat', valor: 'Actiu' } },
  { label: 'Avariats o en reparació', val: items.filter((i) => esAvariat(i.Estat)).length, color: '#ca8a04', filtre: { clau: 'estat', valor: 'avariats' } },
  { label: 'En préstec', val: items.filter((i) => i.Estat === 'En préstec').length, color: '#0c71c3', filtre: { clau: 'estat', valor: 'En préstec' } },
  { label: 'De baixa', val: items.filter((i) => i.Estat === 'De baixa').length, color: '#861414', filtre: { clau: 'estat', valor: 'De baixa' } },
], [items])

function canvia(clau: string, valor: string) {
  setFiltres((f) => ({ ...f, [clau]: valor }))
}
function esborraFiltres() {
  setFiltres((f) => ({ ...FILTRES_BUITS, cerca: f.cerca }))
}
```

  - Línia 1 de la capçalera: substituir el `<div className="flex flex-wrap items-center gap-1.5">` de les píndoles per `<PindolesFiltre pindoles={pindoles} valors={filtres} onCanvia={canvia} />`.
  - Sota la línia 1, posar-hi la barra:

```tsx
<BarraFiltres
  definicions={definicions}
  valors={filtres}
  onCanvia={canvia}
  onEsborra={esborraFiltres}
  cerca={filtres.cerca}
  onCerca={(t) => canvia('cerca', t)}
  placeholder="Cercar per nom, marca, ubicació, núm. sèrie..."
/>
```

  - Si `categories` o `accions` del `useConfigStore` són arrays nous a cada render, el `useMemo` es recalcula sempre. És inofensiu i no cal arreglar-ho.
  - **Canvi visible acceptat:** el xip d'ubicació mostra l'etiqueta llarga («A4-EP-1A · Edifici A · Planta 1»…) en lloc del codi sol.

- [ ] **Pas 4:** `npm run typecheck && npm run lint && npm test` → net.

- [ ] **Pas 5: Commit** `refactor: Inventari fa servir la barra de filtres comuna` (amb el tràiler).

---

### Tasca 3: Incidències, Préstecs i Material i Stock

**Fitxers:**
- Modificar: `src/modules/incidencies/IncidenciesPage.tsx`, `src/modules/prestecs/PrestecsPage.tsx`, `src/modules/material/MaterialPage.tsx`

**Interfícies:**
- Consumeix: `BarraFiltres`, `PindolesFiltre`, `Pindola`, `useValorsFiltres`, `DefinicioFiltre`, `opcions` (tasca 1).

**Patró per a cada pantalla:**
- La cerca continua en el seu `useState` propi.
- Els desplegables passen a `const { valors, canvia, esborra } = useValorsFiltres({ … })`. A la funció de filtrar, `filtreX` passa a ser `valors.x`, amb la mateixa condició.
- La fila de cerca i desplegables passa a ser `<BarraFiltres … />`.
- Els comptadors (avui, targetes o píndoles a la línia del títol) passen a `<PindolesFiltre … />`, a la línia del títol, com a Inventari.
- Si la pantalla té un botó «Netejar» o «Treu els filtres» propi, s'esborra: els xips en fan la feina.
- Si la capçalera no té la forma d'Inventari (fons blanc, `border-b`, `px-6 py-4`), s'hi ajusta: títol + recompte + píndoles + accions a la línia 1, i `BarraFiltres` a sota.

**Incidències:**

```tsx
const { valors, canvia, esborra } = useValorsFiltres({ estat: '', prioritat: '', tipus: '' })
const definicions: DefinicioFiltre[] = [
  { clau: 'estat', label: 'Estat', tipus: 'select', totes: 'Tots', opcions: opcions(['Oberta', 'En curs', 'Tancada']) },
  { clau: 'prioritat', label: 'Prioritat', tipus: 'select', totes: 'Totes', opcions: opcions(PRIORITATS.slice(1) as string[]) },
  { clau: 'tipus', label: 'Tipus', tipus: 'select', totes: 'Tots', opcions: opcions(tipus) },
]
```

- Les píndoles Obertes, En curs i Tancades filtren `estat` amb els valors `'Oberta'`, `'En curs'` i `'Tancada'`, amb els mateixos colors d'avui. Si n'hi ha més de tres avui, la resta queden informatives.
- Placeholder: el d'avui.

**Préstecs:**
- `useValorsFiltres({ estat: '' })`, amb `{ clau: 'estat', label: 'Estat', tipus: 'select', totes: 'Tots', opcions: opcions(['Actiu', 'Retornat', 'Vençut']) }`.
- La condició es queda sobre `p._estatEfectiu`.
- Píndoles: Actius → `'Actiu'`, Vençuts → `'Vençut'`, Retornats → `'Retornat'`.

**Material i Stock:**
- `useValorsFiltres({ categoria: '' })`, amb `{ clau: 'categoria', label: 'Categoria', tipus: 'select', totes: 'Totes', opcions: opcions(categories) }`.
- Les quatre píndoles (Ítems, Unitats, En préstec, Stock baix) **no** porten `filtre`: són informatives.

- [ ] **Pas 1:** Incidències segons el patró. Typecheck.
- [ ] **Pas 2:** Préstecs segons el patró. Typecheck.
- [ ] **Pas 3:** Material i Stock segons el patró. Typecheck.
- [ ] **Pas 4:** `npm run typecheck && npm run lint && npm test` → net.
- [ ] **Pas 5: Commit** `refactor: Incidències, Préstecs i Material amb la barra de filtres comuna`.

---

### Tasca 4: Reserves, Base de Coneixement i Material Infantil (Catàleg)

**Fitxers:**
- Modificar: `src/modules/reserves/ReservesPage.tsx`, `src/modules/coneixement/ConeixementPage.tsx`, `src/modules/material-infantil/CatalegInfantilTab.tsx`

**Interfícies:** les mateixes que a la tasca 3.

**Patró:** el mateix que a la tasca 3, amb les mateixes regles per a la cerca, `valors`, píndoles, botons de netejar i capçalera.

**Reserves** (`ReservesPage.tsx`, el llistat, cap a la línia 309):
- `useValorsFiltres({ estat: '', data: '' })`, amb aquestes definicions:
  - `{ clau: 'estat', label: 'Estat', tipus: 'select', totes: 'Tots', opcions: opcions(ESTATS.slice(1) as string[]) }`;
  - `{ clau: 'data', label: 'Data', tipus: 'data' }`.
- El calendari que avui fa `onSeleccionarDia={setFiltreData}` passa a `onSeleccionarDia={(d) => canvia('data', d)}`.
- Píndoles:
  - Pendents → `{ clau: 'estat', valor: 'Pendent' }` i Confirmades → `{ clau: 'estat', valor: 'Confirmada' }`. Abans, comprova que aquests són exactament els valors d'`EstatReserva`; si no, fes servir els reals.
  - Avui és informativa.
- El botó que avui ho buida tot (cerca + data + estat) s'esborra. Si la cerca s'ha de poder buidar, ja es fa des del quadre.

**Base de Coneixement:**
- La cerca continua a `textCerca`.
- `useValorsFiltres({ tipus: '', categoria: '' })`. Les opcions de tipus són els mateixos parells `valor`/`etiqueta` que el `<select>` d'avui. Les de categoria, la mateixa llista d'avui.
  - Si avui el desplegable de categoria només surt en alguns casos (hi ha un condicional), la definició també s'hi afegeix només en aquests casos.
- Les tres píndoles (Total, Publicats, Esborranys) són informatives.
- `mostraAvisos` i els seus germans llegeixen `valors.tipus`.
- El botó que avui buida text, tipus i categoria s'esborra.

**Material Infantil · Catàleg:**
- `useValorsFiltres({ categoria: '' })`, amb `{ clau: 'categoria', label: 'Categoria', tipus: 'select', totes: 'Totes', opcions: opcions(categories) }`.
- La casella «només estoc baix» (`nomesEstocBaix`) va com a `children` de `BarraFiltres`, sense canvis de lògica.
- No té píndoles.

- [ ] **Pas 1:** Reserves. Typecheck.
- [ ] **Pas 2:** Base de Coneixement. Typecheck.
- [ ] **Pas 3:** Material Infantil. Typecheck.
- [ ] **Pas 4:** `npm run typecheck && npm run lint && npm test` → net.
- [ ] **Pas 5: Commit** `refactor: Reserves, Coneixement i Infantil amb la barra de filtres comuna`.

---

### Tasca 5: Manteniment, Excursions i Correus (sense cerca)

**Fitxers:**
- Modificar: `src/modules/manteniment/MantenimentPage.tsx`, `src/modules/excursions/ExcursionsPage.tsx`, `src/modules/notificacions/NotificacionsPage.tsx`

**Interfícies:** les mateixes que a la tasca 3.

**Patró:** el de la tasca 3, però `BarraFiltres` **sense** les props `cerca`, `onCerca` i `placeholder`, de manera que el botó «Filtres» s'alinea a la dreta.

**Manteniment:**
- L'estat inicial `'Tots'` passa a `''`, amb `useValorsFiltres({ estat: '', categoria: '' })`. Les condicions queden `if (valors.estat && m.Estat !== valors.estat)` i `if (valors.categoria && m.Categoria !== valors.categoria)`: és la mateixa lògica amb un altre sentinella.
- Definicions:
  - `{ clau: 'estat', label: 'Estat', tipus: 'select', totes: 'Tots', opcions: opcions(['Pendent', 'En gestió', 'Resolt', 'Cancel·lat']) }`;
  - `{ clau: 'categoria', label: 'Categoria', tipus: 'select', totes: 'Totes', opcions: CATEGORIES_MANTENIMENT.map((c) => ({ valor: c, etiqueta: `${CATEGORIA_ICONS[c]} ${c}` })) }`.
- S'esborren el selector segmentat d'estat i el `<select>` de categoria.
- `ESTATS_FILTRE` s'esborra si queda sense ús.
- Les quatre targetes de KPI passen a píndoles, a la línia del títol:
  - Pendents → `'Pendent'`, En gestió → `'En gestió'`, Resolts → `'Resolt'`;
  - Urgents és informativa.
  - Es mantenen els colors d'avui. Si les targetes tenen estat de càrrega (esquelet), la píndola mostra `…` mentre carrega.

**Excursions:**
- `useValorsFiltres({ etapa: '', estat: '', mes: '' })`, amb aquestes definicions:
  - `{ clau: 'etapa', label: 'Etapa', tipus: 'select', totes: 'Totes', opcions: opcions(ETAPES_EXCURSIO) }`;
  - `{ clau: 'estat', label: 'Estat', tipus: 'select', totes: 'Tots', opcions: opcions(ESTATS_EXCURSIO) }`;
  - `{ clau: 'mes', label: 'Mes', tipus: 'select', totes: 'Tot el curs', opcions: MESOS.map((m) => ({ valor: m.valor, etiqueta: m.nom })) }`.
- La casella «Només pendents de pressupost» i el botó d'aprovar (amb les seves condicions `potVeureCostos` i `potAprovar`) van com a `children` de `BarraFiltres`, sense canvis.
- Sense píndoles.

**Correus** (`NotificacionsPage.tsx`):
- `useValorsFiltres({ estat: '', desDe: '', finsA: '' })`, amb aquestes definicions:
  - `{ clau: 'estat', label: 'Estat', tipus: 'select', totes: 'Tots', opcions: ESTATS_NOTIFICACIO.map((e) => ({ valor: e, etiqueta: `${ESTAT_LABELS[e]}${resum[e] ? ` (${resum[e]})` : ''}` })) }`;
  - `{ clau: 'desDe', label: 'Des de', tipus: 'data', max: valors.finsA }`;
  - `{ clau: 'finsA', label: 'Fins a', tipus: 'data', min: valors.desDe }`.
- S'esborren el botó «Treu els filtres» i el comentari de les dates, que pot passar a sobre de les definicions.
- Sense píndoles.

- [ ] **Pas 1:** Manteniment. Typecheck.
- [ ] **Pas 2:** Excursions. Typecheck.
- [ ] **Pas 3:** Correus. Typecheck.
- [ ] **Pas 4:** `npm run typecheck && npm run lint && npm test` → net.
- [ ] **Pas 5: Commit** `refactor: Manteniment, Excursions i Correus amb la barra de filtres comuna`.

---

### Tasca 6: Camp «Destí» als préstecs

**Fitxers:**
- Crear: `supabase/migrations/202610080001_prestecs_desti.sql`
- Modificar: `tests/database.test.ts`, `src/modules/prestecs/types.ts`, `usePrestecs.ts`, `PrestecForm.tsx`, `PrestecsPage.tsx`, `PrestecDetall.tsx`

- [ ] **Pas 1: Prova de BD** a `tests/database.test.ts`, dins `describe('operational integrity')`, just després de la prova `'creates a loan once and restores stock once on repeated return'`:

```ts
  it('desa el destí del préstec, i sense destí el deixa buit', async () => {
    await asUser('admin@stjosep.org')
    await db.exec('savepoint loan_desti')
    const amb = (await db.query<{desti:string}>('select desti from public.create_loan($1,$2,$3)',[
      JSON.stringify({usuari:'Teacher',data_inici:'2026-09-14',desti:'5è A · aula 12'}),JSON.stringify([{codi:'TEST-001',quantitat:1}]),'22222222-2222-4222-8222-222222222222',
    ])).rows[0]
    expect(amb.desti).toBe('5è A · aula 12')
    const sense = (await db.query<{desti:string}>('select desti from public.create_loan($1,$2,$3)',[
      JSON.stringify({usuari:'Teacher',data_inici:'2026-09-14'}),JSON.stringify([{codi:'TEST-001',quantitat:1}]),'33333333-3333-4333-8333-333333333333',
    ])).rows[0]
    expect(sense.desti).toBe('')
    await db.exec('rollback to savepoint loan_desti')
  })
```

- [ ] **Pas 2:** `npx vitest run tests/database.test.ts` → la prova nova ha de FALLAR (`column "desti" does not exist`).

- [ ] **Pas 3: Migració** `supabase/migrations/202610080001_prestecs_desti.sql`. La funció és la de `202609130003_integrity.sql` amb `desti` afegit a l'`insert`, i res més. Abans s'ha comprovat que la versió de producció és idèntica a la del repositori.

```sql
-- On ha anat el material d'un préstec (aula o grup). Opcional.
begin;
alter table public.prestecs add column desti text not null default '';

create or replace function public.create_loan(p_data jsonb,p_items jsonb,p_request_id uuid) returns public.prestecs
language plpgsql security definer set search_path = '' as $$
declare result public.prestecs; item record; mid uuid; quantity integer;
begin
  if not (app_private.module_visible('prestecs') and app_private.creator()) then raise exception 'No autoritzat'; end if;
  if p_request_id is null then raise exception 'Cal identificar la petició'; end if;
  perform pg_advisory_xact_lock(hashtextextended('loan:'||p_request_id::text,0));
  select * into result from public.prestecs where request_id=p_request_id;
  if found then return result; end if;
  if coalesce(trim(p_data->>'usuari'),'')='' then raise exception 'Cal indicar la persona'; end if;
  if coalesce(p_data->>'dispositiu_id','')='' and jsonb_array_length(p_items)=0 then raise exception 'Cal indicar dispositiu o material'; end if;
  perform (p_data->>'data_inici')::date;
  if nullif(p_data->>'data_fi_prevista','')::date < (p_data->>'data_inici')::date then raise exception 'Dates invàlides'; end if;
  if coalesce(p_data->>'dispositiu_id','')<>'' then
    perform pg_advisory_xact_lock(hashtextextended('device:'||(p_data->>'dispositiu_id'),0));
    if exists(select 1 from public.prestecs where dispositiu_id=p_data->>'dispositiu_id' and estat<>'Retornat') then raise exception 'Aquest dispositiu ja està en préstec'; end if;
  end if;
  insert into public.prestecs(dispositiu_id,dispositiu_nom,usuari,email,data_inici,data_fi_prevista,notes,desti,request_id)
  values(coalesce(p_data->>'dispositiu_id',''),coalesce(p_data->>'dispositiu_nom',''),p_data->>'usuari',coalesce(p_data->>'email',''),p_data->>'data_inici',coalesce(p_data->>'data_fi_prevista',''),coalesce(p_data->>'notes',''),coalesce(trim(p_data->>'desti'),''),p_request_id) returning * into result;
  for item in select value from jsonb_array_elements(p_items) order by value->>'codi' loop
    quantity:=(item.value->>'quantitat')::integer;
    if quantity is null or quantity<=0 then raise exception 'Quantitat invàlida'; end if;
    update public.material set quantitat_disponible=quantitat_disponible-quantity
      where codi=item.value->>'codi' and quantitat_disponible>=quantity returning id into mid;
    if not found then raise exception 'Estoc insuficient o material desconegut: %',item.value->>'codi'; end if;
    insert into public.prestec_items(prestec_id,material_id,quantitat) values(result.id,mid,quantity);
  end loop;
  return result;
end;
$$;
commit;
```

`create or replace` conserva els `grant` i `revoke` que ja té la funció.

- [ ] **Pas 4:** `npx vitest run tests/database.test.ts` → tot PASSA.

- [ ] **Pas 5: Frontend**
  - `types.ts`: afegir `Desti: string` a `Prestec`, just després d'`Email`. `PrestecFormData` ja l'hereta.
  - `usePrestecs.ts`:
    - `PrestecRow` porta `desti: string`;
    - `rowToPrestec` fa `Desti: row.desti ?? ''`;
    - `crear` envia `desti: data.Desti` dins `p_data`.
  - `PrestecForm.tsx`:
    - l'estat inicial porta `Desti: ''`;
    - just després del camp Usuari, un camp opcional amb el mateix estil que els altres: `<FormField label="Destí (aula o grup)">` amb un `<input>` i el placeholder `Ex.: 5è A · aula 12`.
  - `PrestecsPage.tsx`:
    - les dades de demostració del principi del fitxer porten `Desti: ''`;
    - la cerca inclou `${p.Desti}`;
    - a la cel·la d'usuari (cap a la línia 239), sota `{p.Usuari}`, va `{p.Desti && <p className="text-xs text-gray-500">{p.Desti}</p>}`.
  - `PrestecDetall.tsx`: a la secció Usuari, sota la fila Nom, `{prestec.Desti && <InfoRow icon={<MapPin size={14} />} label="Destí" value={prestec.Desti} />}`. `MapPin` s'importa de `lucide-react`.
  - Si `DashboardPage.tsx` construeix objectes `Prestec` complets, també cal afegir-hi `Desti`. El typecheck ho dirà.

- [ ] **Pas 6:** `npm run typecheck && npm run lint && npm test` → net.

- [ ] **Pas 7: Commit** `feat: camp Destí als préstecs`.

> **Desplegament (ho fa el controlador, no l'implementador):** la migració s'aplica a producció amb `apply_migration` **abans** de fusionar la PR.
