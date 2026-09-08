# Millores Absències + Substitucions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three usability fixes for the absence-management feature shipped earlier: (1) let a Direcció/Coordinador/Cap d'Estudis create *several* substitucions from one approved absence, and see the list of ones already created; (2) let the reporting teacher write the tasks a substitute should do, and carry that text into each substitució's Notes; (3) add a flat, searchable "Totes les substitucions" tab so nobody has to hunt week-by-week for an older substitució.

**Architecture:** No database changes — every field this plan needs (`substitucions.absencia_id`, `absencies.notes`, `substitucions.notes`) already exists live in Supabase from the original feature. This is a pure frontend change: a small state-flow fix in `App.tsx` so the absence-detail panel survives a "create substitució" round trip instead of closing, two field/label additions threaded through existing props, and one new list-view component plugged into the existing `SubstitucionsPage` tab bar.

**Tech Stack:** React 19 + TypeScript, Zustand, Supabase, Tailwind CSS, lucide-react icons — same as the rest of the app, no new dependencies.

**Spec:** This plan's spec is the design agreed in conversation (no separate spec doc). Key decisions, verbatim from that conversation:
- Multiple substitucions per absence, because the substitute may differ per class period covered.
- The already-existing free-text `Notes` field on `Absència` is repurposed as "Tasques a realitzar" (what the substitute should do) — no new column, just a clearer label and a prefill into the substitució's own Notes, which the approver edits down per class before saving each one.
- The teacher-timetable / automatic-substitute-suggestion idea raised in the same conversation is explicitly OUT OF SCOPE for this plan — it's a separate, much larger initiative to be designed later.
- The absence hours-tally improvement mentioned in the same conversation is also OUT OF SCOPE here — parked for a future conversation.
- The new "all substitucions" tab reuses the existing `SubstitucioDetall` modal for viewing/editing a row — no new edit UI is being built, only a new way to find a row.

## Global Constraints

- **No automated test framework exists in this project.** Verification is `npx tsc -b` (must stay clean), `npx eslint <changed files>`, and manual code-reading / the live dev server — matching the convention used for every prior change in this codebase.
- Corporate red `#861414` for primary buttons via inline `style={{ backgroundColor: '#861414' }}` — copy the exact pattern already used in the files you're editing.
- All new UI text is in Catalan, matching the rest of the app.
- Reuse `formatDate`, `useUsuarisStore`, and the existing `ESTAT_COLORS`-style local constant pattern (each file defines its own small color map rather than importing a shared one — that's this codebase's established convention, not a DRY gap to fix).

---

### Task 1: Prep — thread a "Tasques" prefill through the form/detail components

**Files:**
- Modify: `src/modules/substitucions/SubstitucioForm.tsx`
- Modify: `src/modules/absencies/AbsenciaForm.tsx`
- Modify: `src/modules/absencies/AbsenciaDetall.tsx`

**Interfaces:**
- Produces: `SubstitucioForm` gains a 4th optional prefill prop `notesInicial?: string`, seeding `Notes: notesInicial ?? ''` — Task 4 (`App.tsx`) passes this.
- Produces: `AbsenciaDetall` gains a new required prop `substitucionsVinculades: Substitucio[]` — Task 4 (`App.tsx`) computes and passes this.
- Consumes: `Substitucio` type from `../substitucions/types` (existing).

- [ ] **Step 1: `SubstitucioForm.tsx` — add the `notesInicial` prefill prop**

Change the `Props` interface and the component's destructuring + initial state (currently lines 8-37) from:

```tsx
interface Props {
  dataInicial?: string
  professorAbsentInicial?: string
  franjaInicial?: string
  absenciaIdInicial?: string
  onDesar: (data: SubstitucioFormData) => Promise<void>
  onCancel: () => void
}

const TIPUS: TipusSubstitucio[] = ['Classe', 'Pati']

export function SubstitucioForm({
  dataInicial, professorAbsentInicial, franjaInicial, absenciaIdInicial, onDesar, onCancel,
}: Props) {
  const avui = formatDateISO(new Date())
  const usuaris = useUsuarisStore((s) => s.usuaris)


  const [data, setData] = useState<SubstitucioFormData>({
    Data: dataInicial ?? avui,
    Etapa: 'ESO 1r-2n',
    Franja: franjaInicial ?? '',
    Tipus: 'Classe',
    ProfessorAbsent: professorAbsentInicial ?? '',
    ProfessorSubstitut: '',
    Grup: '',
    Materia: '',
    Notes: '',
    Absencia_ID: absenciaIdInicial,
  })
```

to:

```tsx
interface Props {
  dataInicial?: string
  professorAbsentInicial?: string
  franjaInicial?: string
  absenciaIdInicial?: string
  notesInicial?: string
  onDesar: (data: SubstitucioFormData) => Promise<void>
  onCancel: () => void
}

const TIPUS: TipusSubstitucio[] = ['Classe', 'Pati']

export function SubstitucioForm({
  dataInicial, professorAbsentInicial, franjaInicial, absenciaIdInicial, notesInicial, onDesar, onCancel,
}: Props) {
  const avui = formatDateISO(new Date())
  const usuaris = useUsuarisStore((s) => s.usuaris)


  const [data, setData] = useState<SubstitucioFormData>({
    Data: dataInicial ?? avui,
    Etapa: 'ESO 1r-2n',
    Franja: franjaInicial ?? '',
    Tipus: 'Classe',
    ProfessorAbsent: professorAbsentInicial ?? '',
    ProfessorSubstitut: '',
    Grup: '',
    Materia: '',
    Notes: notesInicial ?? '',
    Absencia_ID: absenciaIdInicial,
  })
```

(Only the `Notes: '',` → `Notes: notesInicial ?? '',` line and the prop plumbing around it change — nothing else in this file.)

- [ ] **Step 2: `AbsenciaForm.tsx` — relabel the Notes field as "Tasques a realitzar"**

The underlying field name stays `Notes` (no type change, no DB change) — only the label and placeholder change so the UI communicates its actual purpose. Change (currently lines 123-131):

```tsx
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (opcional)</label>
            <textarea
              value={data.Notes}
              onChange={(e) => set('Notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
```

to:

```tsx
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tasques a realitzar (opcional)</label>
            <textarea
              value={data.Notes}
              onChange={(e) => set('Notes', e.target.value)}
              rows={3}
              placeholder="Indica els exercicis o tasques que ha de fer cada classe durant la teva absència. Si afecta diverses classes, pots separar-ho per grups."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
```

- [ ] **Step 3: `AbsenciaDetall.tsx` — relabel the Notes display, and add the linked-substitucions list**

First, add the import and the local color map. Change the top of the file (currently lines 1-11) from:

```tsx
import { useState } from 'react'
import { X, Check, XCircle, Trash2, ClipboardPlus } from 'lucide-react'
import type { Absencia } from './types'
import { formatDate } from '../substitucions/substitucions.utils'
import { useUsuarisStore } from '../../store/usuarisStore'

const ESTAT_COLORS: Record<Absencia['Estat'], string> = {
  'Pendent revisió': 'text-amber-700 bg-amber-100 border-amber-200',
  'Aprovada': 'text-green-700 bg-green-100 border-green-200',
  'Rebutjada': 'text-red-700 bg-red-100 border-red-200',
}
```

to:

```tsx
import { useState } from 'react'
import { X, Check, XCircle, Trash2, ClipboardPlus } from 'lucide-react'
import type { Absencia } from './types'
import type { Substitucio, EstatSubstitucio } from '../substitucions/types'
import { formatDate } from '../substitucions/substitucions.utils'
import { useUsuarisStore } from '../../store/usuarisStore'

const ESTAT_COLORS: Record<Absencia['Estat'], string> = {
  'Pendent revisió': 'text-amber-700 bg-amber-100 border-amber-200',
  'Aprovada': 'text-green-700 bg-green-100 border-green-200',
  'Rebutjada': 'text-red-700 bg-red-100 border-red-200',
}

const ESTAT_SUBST_COLORS: Record<EstatSubstitucio, string> = {
  Pendent:      'text-amber-700 bg-amber-100 border-amber-200',
  Realitzada:   'text-green-700 bg-green-100 border-green-200',
  'Cancel·lada':'text-gray-500 bg-gray-100 border-gray-200',
}
```

Next, add the new prop. Change the `Props` interface and function signature (currently lines 13-28) from:

```tsx
interface Props {
  absencia: Absencia
  potAprovar: boolean
  potGestionar: boolean
  potEliminar: boolean
  onClose: () => void
  onAprovar: (a: Absencia) => Promise<void>
  onRebutjar: (a: Absencia, motiu: string) => Promise<void>
  onEliminar: (a: Absencia) => Promise<void>
  onCrearSubstitucio: (a: Absencia) => void
}

export function AbsenciaDetall({
  absencia, potAprovar, potGestionar, potEliminar,
  onClose, onAprovar, onRebutjar, onEliminar, onCrearSubstitucio,
}: Props) {
```

to:

```tsx
interface Props {
  absencia: Absencia
  substitucionsVinculades: Substitucio[]
  potAprovar: boolean
  potGestionar: boolean
  potEliminar: boolean
  onClose: () => void
  onAprovar: (a: Absencia) => Promise<void>
  onRebutjar: (a: Absencia, motiu: string) => Promise<void>
  onEliminar: (a: Absencia) => Promise<void>
  onCrearSubstitucio: (a: Absencia) => void
}

export function AbsenciaDetall({
  absencia, substitucionsVinculades, potAprovar, potGestionar, potEliminar,
  onClose, onAprovar, onRebutjar, onEliminar, onCrearSubstitucio,
}: Props) {
```

Next, relabel the Notes display. Change (currently lines 91-93):

```tsx
          {absencia.Notes && (
            <div><p className="text-xs text-gray-400 mb-1">Notes</p><p className="text-text-main">{absencia.Notes}</p></div>
          )}
```

to:

```tsx
          {absencia.Notes && (
            <div><p className="text-xs text-gray-400 mb-1">Tasques a realitzar</p><p className="text-text-main whitespace-pre-wrap">{absencia.Notes}</p></div>
          )}
```

(`whitespace-pre-wrap` added because task instructions are more likely to contain the teacher's own line breaks between classes than a generic one-line note was.)

Finally, add the linked-substitucions list. Insert it right after that Notes block and before the `{absencia.Estat === 'Rebutjada' && ...}` block (currently starting at line 95), so the file reads:

```tsx
          {absencia.Notes && (
            <div><p className="text-xs text-gray-400 mb-1">Tasques a realitzar</p><p className="text-text-main whitespace-pre-wrap">{absencia.Notes}</p></div>
          )}

          {substitucionsVinculades.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5">Substitucions creades ({substitucionsVinculades.length})</p>
              <div className="space-y-1.5">
                {substitucionsVinculades.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="min-w-0">
                      <p className="font-medium text-text-main truncate">
                        {s.Tipus === 'Pati' ? 'Pati' : (s.Grup || 'Sense grup')}
                        {s.Materia && <span className="text-gray-400"> · {s.Materia}</span>}
                      </p>
                      <p className="text-gray-400">{s.Franja}</p>
                    </div>
                    <span className={`shrink-0 text-[11px] px-1.5 py-0.5 rounded-full font-medium border ${ESTAT_SUBST_COLORS[s.Estat]}`}>
                      {s.Estat}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {absencia.Estat === 'Rebutjada' && absencia.MotiuRebuig && (
```

(The rest of that block — `Motiu del rebuig: {absencia.MotiuRebuig}\n            </div>\n          )}` — is unchanged; only the new block is inserted above it.)

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc -b`
Expected: errors in `App.tsx` about the new required `substitucionsVinculades` prop on `AbsenciaDetall` not being passed — that's expected at this point, Task 4 fixes it. Confirm there are no errors inside the three files this task touched themselves.

Run: `npx eslint src/modules/substitucions/SubstitucioForm.tsx src/modules/absencies/AbsenciaForm.tsx src/modules/absencies/AbsenciaDetall.tsx`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/modules/substitucions/SubstitucioForm.tsx src/modules/absencies/AbsenciaForm.tsx src/modules/absencies/AbsenciaDetall.tsx
git commit -m "feat(absencies): afegir camp de tasques i llista de substitucions vinculades"
```

---

### Task 2: New "Totes les substitucions" list/search tab

**Files:**
- Create: `src/modules/substitucions/SubstitucionsTotesTab.tsx`

**Interfaces:**
- Consumes: `Substitucio`, `EstatSubstitucio` (existing, from `./types`), `formatDate` (existing, from `./substitucions.utils`), `useUsuarisStore` (existing).
- Produces: `<SubstitucionsTotesTab substitucions={Substitucio[]} loading={boolean} onVeure={(s: Substitucio) => void} />` — Task 3 (`SubstitucionsPage.tsx`) renders this with these exact prop names, reusing props `SubstitucionsPage` already receives (no new data plumbing needed from `App.tsx`).

- [ ] **Step 1: Create the component**

```tsx
import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import type { Substitucio, EstatSubstitucio } from './types'
import { formatDate } from './substitucions.utils'
import { useUsuarisStore } from '../../store/usuarisStore'

const ESTAT_COLORS: Record<EstatSubstitucio, string> = {
  Pendent:      'text-amber-700 bg-amber-100 border-amber-200',
  Realitzada:   'text-green-700 bg-green-100 border-green-200',
  'Cancel·lada':'text-gray-500 bg-gray-100 border-gray-200',
}

interface Props {
  substitucions: Substitucio[]
  loading: boolean
  onVeure: (s: Substitucio) => void
}

export function SubstitucionsTotesTab({ substitucions, loading, onVeure }: Props) {
  const usuaris = useUsuarisStore((s) => s.usuaris)
  const [cerca, setCerca] = useState('')
  const [filtreEstat, setFiltreEstat] = useState<EstatSubstitucio | 'Totes'>('Totes')

  function nom(email: string): string {
    return usuaris.find((u) => u.Email === email)?.Nom || email
  }

  const filtrades = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    return substitucions
      .filter((s) => filtreEstat === 'Totes' || s.Estat === filtreEstat)
      .filter((s) => {
        if (!q) return true
        return [nom(s.ProfessorAbsent), nom(s.ProfessorSubstitut), s.Grup, s.Materia]
          .some((v) => v.toLowerCase().includes(q))
      })
      .sort((a, b) => b.Data.localeCompare(a.Data) || b.Franja.localeCompare(a.Franja))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [substitucions, cerca, filtreEstat, usuaris])

  return (
    <div className="flex-1 overflow-auto px-6 py-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cerca per professor, grup o matèria..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {(['Totes', 'Pendent', 'Realitzada', 'Cancel·lada'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltreEstat(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              filtreEstat === f ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Franja</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Grup / Pati</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Absent</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Substitut</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estat</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Carregant...</td></tr>
            )}
            {!loading && filtrades.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Cap substitució coincideix amb la cerca.</td></tr>
            )}
            {filtrades.map((s) => (
              <tr
                key={s.id}
                onClick={() => onVeure(s)}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-4 py-2.5 text-sm text-text-main whitespace-nowrap">{formatDate(s.Data)}</td>
                <td className="px-4 py-2.5 text-sm text-gray-500 whitespace-nowrap">{s.Franja}</td>
                <td className="px-4 py-2.5 text-sm text-text-main">
                  {s.Tipus === 'Pati' ? '🏃 Pati' : (s.Grup || '—')}
                  {s.Materia && <span className="text-gray-400"> · {s.Materia}</span>}
                </td>
                <td className="px-4 py-2.5 text-sm text-gray-600">{nom(s.ProfessorAbsent)}</td>
                <td className="px-4 py-2.5 text-sm text-gray-600">{nom(s.ProfessorSubstitut)}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${ESTAT_COLORS[s.Estat]}`}>{s.Estat}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc -b`
Expected: no errors (this file has no consumers yet, so it just needs to parse and type-check on its own).

Run: `npx eslint src/modules/substitucions/SubstitucionsTotesTab.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/modules/substitucions/SubstitucionsTotesTab.tsx
git commit -m "feat(substitucions): nova pestanya de llistat cercable de totes les substitucions"
```

---

### Task 3: Wire the "Totes" tab into `SubstitucionsPage`

**Files:**
- Modify: `src/modules/substitucions/SubstitucionsPage.tsx`

**Interfaces:**
- Consumes: `SubstitucionsTotesTab` (Task 2).
- Produces: nothing new for other tasks — `SubstitucionsPage`'s own `Props` interface is unchanged, since this tab reuses `substitucions`, `loading`, and `onVeure`, which the component already receives.

- [ ] **Step 1: Add the import and extend the `Tab` type**

Change (currently lines 1-13):

```tsx
import { useState, useMemo } from 'react'
import { Plus, RefreshCw, ChevronLeft, ChevronRight, BarChart2, CalendarDays, CalendarOff } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuthStore } from '../../store/authStore'
import type { Substitucio, EstatSubstitucio } from './types'
import {
  formatDateISO, formatDiaLlarg, formatWeekRange, getWeekDates,
} from './substitucions.utils'
import { useUsuarisStore, potGestionar } from '../../store/usuarisStore'
import type { Absencia } from '../absencies/types'
import { AbsenciesTab } from '../absencies/AbsenciesTab'

type Tab = 'setmana' | 'estadistiques' | 'absencies'
```

to:

```tsx
import { useState, useMemo } from 'react'
import { Plus, RefreshCw, ChevronLeft, ChevronRight, BarChart2, CalendarDays, CalendarOff, List } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuthStore } from '../../store/authStore'
import type { Substitucio, EstatSubstitucio } from './types'
import {
  formatDateISO, formatDiaLlarg, formatWeekRange, getWeekDates,
} from './substitucions.utils'
import { useUsuarisStore, potGestionar } from '../../store/usuarisStore'
import type { Absencia } from '../absencies/types'
import { AbsenciesTab } from '../absencies/AbsenciesTab'
import { SubstitucionsTotesTab } from './SubstitucionsTotesTab'

type Tab = 'setmana' | 'totes' | 'estadistiques' | 'absencies'
```

- [ ] **Step 2: Add the tab to the tab bar**

Change (currently line 368):

```tsx
          {([['setmana', 'Vista setmanal', CalendarDays], ['estadistiques', 'Estadístiques', BarChart2], ['absencies', 'Absències', CalendarOff]] as const).map(([key, label, Icon]) => (
```

to:

```tsx
          {([['setmana', 'Vista setmanal', CalendarDays], ['totes', 'Totes', List], ['estadistiques', 'Estadístiques', BarChart2], ['absencies', 'Absències', CalendarOff]] as const).map(([key, label, Icon]) => (
```

(the rest of that `.map(...)` block is unchanged — it already reads `key`/`label`/`Icon` generically.)

- [ ] **Step 3: Render `SubstitucionsTotesTab` for the new tab**

Insert a new block right after the `{/* ── Vista setmanal ── */}` block closes (currently ends at line 491, right before `{/* ── Estadístiques ── */}` starts at line 493-494):

```tsx
      {/* ── Totes ── */}
      {tab === 'totes' && (
        <SubstitucionsTotesTab
          substitucions={substitucions}
          loading={loading}
          onVeure={onVeure}
        />
      )}

      {/* ── Estadístiques ── */}
      {tab === 'estadistiques' && (
```

(so the new block sits between the two existing ones — the `{/* ── Estadístiques ── */}` comment and `{tab === 'estadistiques' && (` line that already exist are not duplicated, just the new block is inserted immediately before them.)

- [ ] **Step 4: Type-check**

Run: `npx tsc -b`
Expected: same pre-existing `App.tsx` error about `AbsenciaDetall`'s missing `substitucionsVinculades` prop (from Task 1) — nothing new from this task. Confirm no errors inside `SubstitucionsPage.tsx` itself.

Run: `npx eslint src/modules/substitucions/SubstitucionsPage.tsx`
Expected: only the one pre-existing `react-hooks/exhaustive-deps` warning on the `estadistiques` `useMemo` (already present before this task — confirm with `git diff` if unsure), no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/modules/substitucions/SubstitucionsPage.tsx
git commit -m "feat(substitucions): afegir la pestanya Totes al menú de Substitucions"
```

---

### Task 4: Wire everything together in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `notesInicial` prop on `SubstitucioForm` (Task 1), `substitucionsVinculades` prop on `AbsenciaDetall` (Task 1).

This task fixes the actual UX gap: today, clicking "Crea la substitució" immediately closes the absence's detail panel (`setAbsenciaSeleccionada(null)`), so there is no way to create a second substitució for the same absence, nor any way to see what's already been created. The fix: stop closing the absence detail when opening the substitució form, and instead just hide it *while* the form is open (so the two slide-over panels don't stack), letting it reappear automatically once the substitució form closes — whether by cancelling or by successfully saving.

- [ ] **Step 1: Add `useMemo` to the React import and add the `notesInicial` state**

Find the top of `App.tsx` (currently line 2): `import { Component, useEffect } from 'react'` — change to:

```tsx
import { Component, useEffect, useMemo } from 'react'
```

- [ ] **Step 2: Replace the `SubstitucionsWrapper` function**

Replace the whole existing `SubstitucionsWrapper` function (currently lines 550-651) with:

```tsx
function SubstitucionsWrapper() {
  const { substitucions, loading, error, load, crear, canviarEstat, eliminar } = useSubstitucions()
  const {
    absencies, loading: loadingAbsencies, error: errorAbsencies, load: loadAbsencies,
    crear: crearAbsencia, aprovar, rebutjar, eliminar: eliminarAbsencia,
  } = useAbsencies()
  const rol = useUsuarisStore((s) => s.rol)
  const canGestionar = potGestionar(rol)
  const canAprovar = potAprovarAbsencies(rol)
  const canEliminar = potEliminar(rol)

  useEffect(() => { load(); loadAbsencies() }, [])

  const [formObert, setFormObert] = useState(false)
  const [dataInicial, setDataInicial] = useState<string | undefined>()
  const [professorAbsentInicial, setProfessorAbsentInicial] = useState<string | undefined>()
  const [franjaInicial, setFranjaInicial] = useState<string | undefined>()
  const [absenciaIdInicial, setAbsenciaIdInicial] = useState<string | undefined>()
  const [notesInicial, setNotesInicial] = useState<string | undefined>()
  const [seleccionada, setSeleccionada] = useState<Substitucio | null>(null)

  const [formAbsenciaObert, setFormAbsenciaObert] = useState(false)
  const [absenciaSeleccionada, setAbsenciaSeleccionada] = useState<Absencia | null>(null)

  const substitucionsDeLAbsencia = useMemo(
    () => absenciaSeleccionada ? substitucions.filter((s) => s.Absencia_ID === absenciaSeleccionada.id) : [],
    [substitucions, absenciaSeleccionada]
  )

  async function handleCanviarEstat(s: Substitucio, estat: Parameters<typeof canviarEstat>[1]) {
    await canviarEstat(s, estat)
    setSeleccionada((prev) => prev ? { ...prev, Estat: estat } : null)
  }

  function handleNova(data?: string) {
    setDataInicial(data)
    setProfessorAbsentInicial(undefined)
    setFranjaInicial(undefined)
    setAbsenciaIdInicial(undefined)
    setNotesInicial(undefined)
    setFormObert(true)
  }

  function handleCrearSubstitucioDesDAbsencia(a: Absencia) {
    setDataInicial(a.Data)
    setProfessorAbsentInicial(a.Professor)
    setFranjaInicial(`${a.HoraInici}-${a.HoraFi}`)
    setAbsenciaIdInicial(a.id)
    setNotesInicial(a.Notes)
    setFormObert(true)
  }

  return (
    <>
      <SubstitucionsPage
        substitucions={substitucions}
        loading={loading}
        error={error}
        onRefresh={load}
        onNova={handleNova}
        onVeure={setSeleccionada}
        absencies={absencies}
        loadingAbsencies={loadingAbsencies}
        errorAbsencies={errorAbsencies}
        onRefreshAbsencies={loadAbsencies}
        onNovaAbsencia={() => setFormAbsenciaObert(true)}
        onVeureAbsencia={setAbsenciaSeleccionada}
      />
      {formObert && (
        <SubstitucioForm
          dataInicial={dataInicial}
          professorAbsentInicial={professorAbsentInicial}
          franjaInicial={franjaInicial}
          absenciaIdInicial={absenciaIdInicial}
          notesInicial={notesInicial}
          onDesar={async (data) => { await crear(data); setFormObert(false) }}
          onCancel={() => setFormObert(false)}
        />
      )}
      {seleccionada && (
        <SubstitucioDetall
          substitucio={seleccionada}
          canGestionar={canGestionar}
          onClose={() => setSeleccionada(null)}
          onCanviarEstat={handleCanviarEstat}
          onEliminar={async (s) => { await eliminar(s); setSeleccionada(null) }}
        />
      )}
      {formAbsenciaObert && (
        <AbsenciaForm
          onDesar={async (data) => { await crearAbsencia(data); setFormAbsenciaObert(false) }}
          onCancel={() => setFormAbsenciaObert(false)}
        />
      )}
      {absenciaSeleccionada && !formObert && (
        <AbsenciaDetall
          absencia={absenciaSeleccionada}
          substitucionsVinculades={substitucionsDeLAbsencia}
          potAprovar={canAprovar}
          potGestionar={canGestionar}
          potEliminar={canEliminar}
          onClose={() => setAbsenciaSeleccionada(null)}
          onAprovar={async (a) => { await aprovar(a); setAbsenciaSeleccionada(null) }}
          onRebutjar={async (a, motiu) => { await rebutjar(a, motiu); setAbsenciaSeleccionada(null) }}
          onEliminar={async (a) => { await eliminarAbsencia(a); setAbsenciaSeleccionada(null) }}
          onCrearSubstitucio={handleCrearSubstitucioDesDAbsencia}
        />
      )}
    </>
  )
}
```

The load-bearing changes versus the current file, spelled out so you can verify you got them all:
1. `useMemo` added to the `react` import.
2. New state `notesInicial` / `setNotesInicial`.
3. New computed `substitucionsDeLAbsencia`.
4. `handleNova` now also resets `notesInicial` to `undefined`.
5. `handleCrearSubstitucioDesDAbsencia` no longer calls `setAbsenciaSeleccionada(null)`, and now also calls `setNotesInicial(a.Notes)`.
6. `<SubstitucioForm>` now also receives `notesInicial={notesInicial}`.
7. `<AbsenciaDetall>`'s render guard changed from `{absenciaSeleccionada && (` to `{absenciaSeleccionada && !formObert && (`, and it now also receives `substitucionsVinculades={substitucionsDeLAbsencia}`.

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: fully clean, zero errors — this closes out the "missing prop" errors left over from Task 1.

- [ ] **Step 4: Lint**

Run: `npx eslint src/App.tsx`
Expected: clean (the one pre-existing unrelated warning about `useSubstitucions`'s `load` dependency, if it still shows up here, is not introduced by this change — leave it).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(absencies): permetre crear diverses substitucions des d'una mateixa absència"
```

---

### Task 5: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full build**

Run: `npx tsc -b && npm run build`
Expected: clean build, no TypeScript errors, no Vite build errors.

- [ ] **Step 2: Lint the whole project**

Run: `npx eslint .`
Expected: no new errors beyond the pre-existing ones already documented in this project (the `set-state-in-effect` warnings in `pla-accio`, `prestecs`, `reserves`, and the `exhaustive-deps` warning in `SubstitucionsPage.tsx`'s Estadístiques `useMemo`).

- [ ] **Step 3: Code-level trace of the three fixed flows (no live login available in this environment — see note below)**

Read through the final `App.tsx`, `AbsenciaDetall.tsx`, and `SubstitucionsTotesTab.tsx` once more and confirm by reading, not running:
- Approving an absence, then clicking "Crea la substitució" twice in a row (cancelling or saving the first time) would show the absence detail again each time, with the growing list of already-created substitucions visible.
- The `Tasques a realitzar` text written on the absence form would show up pre-filled (and editable) in `Notes` every time "Crea la substitució" is clicked for that absence.
- The new "Totes" tab's search/filter would correctly narrow the table, and clicking a row would call the existing `onVeure`, opening the pre-existing `SubstitucioDetall` unchanged.

- [ ] **Step 4: Note for the controller**

Unlike the original absences feature, real login credentials ARE available this time (the human partner has been testing this app live with a real `@stjosep.org` account in this same conversation). Once this plan's tasks are done and reviewed, tell the human partner it's ready and ask them to click through the three flows themselves in the running dev server, rather than relying only on the code-level trace above.

---

## Self-Review Notes

- **Spec coverage:** multiple substitucions per absence + visible linked list ✓ (Tasks 1 Step 3, 4), Tasques field + Notes prefill ✓ (Tasks 1 Steps 1-2, 4), searchable all-substitucions tab reusing the existing detail modal ✓ (Tasks 2, 3) — timetable/auto-suggest and hours-tally explicitly out of scope, not touched by any task.
- **Placeholder scan:** none found — every step has literal, complete code.
- **Type consistency check:** `notesInicial` (Task 1 Step 1) → passed by the same name in Task 4 Step 2. `substitucionsVinculades` (Task 1 Step 3) → computed as `substitucionsDeLAbsencia` and passed under the prop name `substitucionsVinculades` in Task 4 Step 2 — names match the prop, not the local variable, which is correct (props are named by their own interface, not by the caller's variable name). `SubstitucionsTotesTab` props (Task 2: `substitucions, loading, onVeure`) → matched exactly by Task 3's JSX.
