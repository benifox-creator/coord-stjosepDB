# Gestió d'Absències del Professorat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the paper-based absence slip with a digital flow: a teacher reports their own absence (date + start/end time + reason), Direcció/Coordinador approve or reject it, approved absences feed the existing Substitucions module to arrange cover, and Direcció/Coordinador can see a running tally of hours missed per teacher for the whole course.

**Architecture:** New `absencies` table + new `src/modules/absencies/` module (types, Zustand store, form, detail modal, tab view), plugged into the existing `Substitucions` module as a third tab (mirrors how "Vista setmanal" / "Estadístiques" already coexist there). A nullable `absencia_id` foreign key on `substitucions` links a coverage slot back to the absence it came from, without touching the existing substitucions flow for cases that don't originate from a reported absence. No timetable/schedule data exists anywhere in the app, so automatic generation of per-class substitucions from an absence window is explicitly out of scope — approving an absence hands off to the existing "Nova substitució" form, now pre-filled.

**Tech Stack:** React 19 + TypeScript, Zustand, Supabase (Postgres + `@supabase/supabase-js`), Gmail API (existing `sendEmail` in `src/services/gmail.ts`), Tailwind CSS, lucide-react icons.

**Spec:** This plan's spec is the design agreed in conversation (no separate spec doc exists). Key decisions, verbatim from that conversation:
- One report per absence event (a single date + start/end time), not one report per class period.
- A `Motiu` (reason) is required, chosen from a configurable list with an "Altre" free-text override — same pattern as `incidencies.tipus`.
- Hours are counted as decimals (e.g. `2,5` = two and a half hours), computed from start/end time.
- New absences start `Pendent revisió`; only Direcció and Coordinador can approve/reject. Cap d'Estudis keeps its existing Substitucions-management powers but does **not** get absence approval or the hours tally.
- Any role except Convidat can report their own absence (nobody reports someone else's).

**Real payroll-adjacent nuance verified against the live schema:** `supabase/schema.sql` stores `substitucions.franja` as free text (not `time`) and `substitucions.data` as a real `date` column (a documented exception to the project's "dates as text" convention, justified by range queries in the weekly view). This plan follows the same pattern: `absencies.data` is `date`, `hora_inici`/`hora_fi` stay free text (`"09:00"`), and a separate `numeric(4,2)` `hores` column holds the computed decimal so the tally can be summed without re-parsing strings.

## Global Constraints

- **No test framework exists in this project** (`package.json` has no vitest/jest/testing-library — only `dev`, `build`, `lint`, `preview`). Every task below replaces the skill's default "write a failing test" step with this project's actual verification convention, used throughout this whole engagement: `npx tsc -b` (must be clean), `npx eslint <changed files>` (must be clean, pre-existing unrelated warnings are OK), and a manual check (dev server + browser, or a Supabase SQL query for DB tasks). Do not add a test framework as a side effect of this plan — that's a separate, unapproved piece of work.
- All new UI text is in Catalan, matching the rest of the app.
- Corporate red `#861414` is used inline via `style={{ backgroundColor: '#861414' }}` for primary buttons — copy this exact pattern, don't invent a new one (`bg-primary` Tailwind class also exists and is used interchangeably elsewhere; prefer whichever the file you're editing already uses).
- Supabase project id for all MCP/DB operations: `gbugvympcvlskkrbklae`.
- RLS on every table in this project currently uses a single permissive `anon_full_access` policy (`using (true) with check (true))`) — all real access control is enforced in the React app via the `Rol` checks in `src/store/usuarisStore.ts`. Follow this exact pattern for the new table; do not attempt per-row RLS (that would be inconsistent with every other table and isn't asked for).
- Reuse `sendEmail` from `src/services/gmail.ts` as-is (plain-text only, no attachments) — do not modify it.

---

### Task 1: Database — `absencies` table + link column on `substitucions`

**Files:**
- Modify (apply directly to Supabase): none locally — DDL is applied via the Supabase MCP tool.
- Modify: `supabase/schema.sql` (append the new table + the `alter table` at the end of the file, to keep it in sync with the live DB, matching how every prior schema change in this file was documented).

**Interfaces:**
- Produces: table `public.absencies` with columns `id, codi, professor, data, hora_inici, hora_fi, hores, motiu, notes, estat, motiu_rebuig, creat_el, creat_per, revisat_per, revisat_el` — this is the exact column set every later task's `AbsenciaRow` type must match.
- Produces: `public.substitucions.absencia_id` (nullable uuid FK) — Task 12 relies on this column existing.

- [ ] **Step 1: Apply the migration via Supabase MCP**

Call `mcp__claude_ai_Supabase__apply_migration` with `project_id: "gbugvympcvlskkrbklae"`, `name: "add_absencies_table"`, and this `query`:

```sql
create sequence public.absencies_codi_seq;

create table public.absencies (
  id            uuid primary key default gen_random_uuid(),
  -- codi legible (ABS-001...) mostrat a la UI; la clau real és "id" — mateix
  -- patró que substitucions/incidencies/etc.
  codi          text not null unique
                default ('ABS-' || lpad(nextval('public.absencies_codi_seq')::text, 3, '0')),
  professor     text not null default '',
  data          date not null,
  hora_inici    text not null default '',
  hora_fi       text not null default '',
  -- decimal precomputat (ex: 2.50) perquè el recompte d'hores no hagi de
  -- reparsear hora_inici/hora_fi cada vegada.
  hores         numeric(4,2) not null default 0,
  motiu         text not null default '',
  notes         text not null default '',
  estat         text not null default 'Pendent revisió'
                check (estat in ('Pendent revisió', 'Aprovada', 'Rebutjada')),
  motiu_rebuig  text not null default '',
  creat_el      text not null default to_char(now(), 'YYYY-MM-DD HH24:MI'),
  creat_per     text not null default '',
  revisat_per   text not null default '',
  revisat_el    text not null default ''
);

alter table public.absencies enable row level security;
create policy "anon_full_access" on public.absencies for all using (true) with check (true);

-- Enllaç opcional: una substitució pot venir d'una absència aprovada.
-- Nullable perquè les substitucions creades pel flux existent (sense passar
-- per una absència) han de seguir funcionant exactament igual.
alter table public.substitucions
  add column absencia_id uuid references public.absencies(id);
```

- [ ] **Step 2: Verify the table and column exist**

Call `mcp__claude_ai_Supabase__list_tables` with `project_id: "gbugvympcvlskkrbklae"`, `schemas: ["public"]`, `verbose: true`. Confirm `absencies` appears with all 15 columns listed above, and that `substitucions` now has an `absencia_id` column.

- [ ] **Step 3: Check the security advisor**

Call `mcp__claude_ai_Supabase__get_advisors` with `project_id: "gbugvympcvlskkrbklae"`, `type: "security"`. Expected: no new warnings introduced by this migration (empty `lints` array, same as before this change).

- [ ] **Step 4: Append the same schema to `supabase/schema.sql`**

Open `supabase/schema.sql`, find the `-- ---------- substitucions ----------` section (around line 28-54), and add a new section right after it (before `-- ---------- inventari ----------`):

```sql
-- ---------- absencies ----------

create sequence public.absencies_codi_seq;

create table public.absencies (
  id            uuid primary key default gen_random_uuid(),
  codi          text not null unique
                default ('ABS-' || lpad(nextval('public.absencies_codi_seq')::text, 3, '0')),
  professor     text not null default '',
  data          date not null,
  hora_inici    text not null default '',
  hora_fi       text not null default '',
  hores         numeric(4,2) not null default 0,
  motiu         text not null default '',
  notes         text not null default '',
  estat         text not null default 'Pendent revisió'
                check (estat in ('Pendent revisió', 'Aprovada', 'Rebutjada')),
  motiu_rebuig  text not null default '',
  creat_el      text not null default to_char(now(), 'YYYY-MM-DD HH24:MI'),
  creat_per     text not null default '',
  revisat_per   text not null default '',
  revisat_el    text not null default ''
);
```

And add the `alter table` + RLS policy for `absencies` in the RLS section near the bottom of the file (find `alter table public.substitucions enable row level security;` around line 260 and add right after its matching policy block):

```sql
alter table public.absencies enable row level security;
create policy "anon_full_access" on public.absencies for all using (true) with check (true);

alter table public.substitucions
  add column absencia_id uuid references public.absencies(id);
```

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(absencies): crear taula absencies i enllaç amb substitucions"
```

---

### Task 2: Permission helper — `potAprovarAbsencies`

**Files:**
- Modify: `src/store/usuarisStore.ts:35-45`

**Interfaces:**
- Produces: `potAprovarAbsencies(rol: Rol | null): boolean` — every later UI task that gates the "Aprovar/Rebutjar" buttons and the "Recompte d'hores" view calls this exact function name.

- [ ] **Step 1: Add the helper next to the existing permission functions**

In `src/store/usuarisStore.ts`, right after `potCrear` (line 43-45), add:

```ts
export function potAprovarAbsencies(rol: Rol | null): boolean {
  return rol === 'coordinador' || rol === 'direccio'
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/usuarisStore.ts
git commit -m "feat(absencies): afegir permís potAprovarAbsencies (Direcció + Coordinador)"
```

---

### Task 3: Configurable "Motiu" list

**Files:**
- Modify: `src/store/configStore.ts`

**Interfaces:**
- Produces: `CONFIG_DEFAULTS['absencies.motius']` — Task 4 (Configuració UI) and Task 8 (`AbsenciaForm`) both read this exact key via `useConfigStore.getState().getValues('absencies.motius')`.

- [ ] **Step 1: Add the default list**

In `src/store/configStore.ts`, inside the `CONFIG_DEFAULTS` object, add a new entry right after `'manteniment.email': [],` (line 67):

```ts
  'absencies.motius': [
    'Visita mèdica', 'Assumptes propis', 'Baixa/malaltia', 'Formació', 'Altre',
  ],
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/configStore.ts
git commit -m "feat(absencies): afegir llista configurable de motius d'absència"
```

---

### Task 4: Configuració — editable "Motiu" list in the admin screen

**Files:**
- Modify: `src/modules/configuracio/ConfiguracioPage.tsx:21-58`

**Interfaces:**
- Consumes: `CONFIG_DEFAULTS['absencies.motius']` (Task 3), the existing `LlistaEditor` component (already defined at line 60, unchanged).

- [ ] **Step 1: Register a new group in `GRUPS`**

In `src/modules/configuracio/ConfiguracioPage.tsx`, add a new entry to the `GRUPS` array, right after the `'Base de Coneixement'` group (after line 57, before the closing `]`):

```ts
  {
    modul: 'Absències',
    color: '#b45309',
    llistes: [
      { clau: 'absencies.motius', label: "Motius d'absència", descripcio: "Motius disponibles al formulari de reportar una absència. \"Altre\" sempre és disponible." },
    ],
  },
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Manual check**

Run `npm run dev`, log in as coordinador (or check visually via code review if no live login is available), go to Configuració, confirm a new "Absències" section appears with the "Motius d'absència" list, editable and restorable to defaults exactly like the other lists.

- [ ] **Step 4: Commit**

```bash
git add src/modules/configuracio/ConfiguracioPage.tsx
git commit -m "feat(absencies): exposar la llista de motius a Configuració"
```

---

### Task 5: `absencies` module — types

**Files:**
- Create: `src/modules/absencies/types.ts`

**Interfaces:**
- Produces: `Absencia`, `AbsenciaFormData`, `EstatAbsencia` — every file in Tasks 6-13 imports from here.

- [ ] **Step 1: Create the types file**

```ts
export type EstatAbsencia = 'Pendent revisió' | 'Aprovada' | 'Rebutjada'

export interface Absencia {
  id: string
  ID: string
  Professor: string
  Data: string
  HoraInici: string
  HoraFi: string
  Hores: number
  Motiu: string
  Notes: string
  Estat: EstatAbsencia
  MotiuRebuig: string
  Creat_el: string
  Creat_per: string
  Revisat_per: string
  Revisat_el: string
}

export interface AbsenciaFormData {
  Data: string
  HoraInici: string
  HoraFi: string
  Motiu: string
  Notes: string
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors (this file has no consumers yet, so it just needs to parse).

- [ ] **Step 3: Commit**

```bash
git add src/modules/absencies/types.ts
git commit -m "feat(absencies): definir tipus Absencia"
```

---

### Task 6: `absencies` module — utils (mappers, hores calculation, emails)

**Files:**
- Create: `src/modules/absencies/absencies.utils.ts`
- Modify: `src/modules/substitucions/substitucions.utils.ts:21-22` (export two constants that are currently module-private, needed for reuse — see Step 1)

**Interfaces:**
- Consumes: `Absencia`, `AbsenciaFormData`, `EstatAbsencia` (Task 5); `formatDate` (already exported from `substitucions.utils.ts`); `useUsuarisStore` (existing); `supabase` from `src/services/db.ts` (existing).
- Produces: `TABLE_ABSENCIES`, `calcularHores(horaInici: string, horaFi: string): number`, `rowToAbsencia`, `absenciaToInsert`, `absenciaToUpdate`, `buildEmailNovaAbsencia`, `buildEmailRevisioAbsencia`, `getDireccioICoordinadorEmails(): Promise<string[]>`, and the `AbsenciaRow` type — Task 7 (`useAbsencies.ts`) imports every one of these by these exact names.

- [ ] **Step 1: Export the day/month name arrays from `substitucions.utils.ts`**

In `src/modules/substitucions/substitucions.utils.ts`, change line 21-22 from:

```ts
const DIES_CA_LLARG = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte']
const MESOS_CA_LLARG = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre']
```

to:

```ts
export const DIES_CA_LLARG = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte']
export const MESOS_CA_LLARG = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre']
```

(Only add the `export` keyword — everything else about these two lines stays identical. `MESOS_CA_CURT` stays private, it isn't needed outside this file.)

- [ ] **Step 2: Create `src/modules/absencies/absencies.utils.ts`**

```ts
import { supabase } from '../../services/db'
import { useUsuarisStore } from '../../store/usuarisStore'
import { DIES_CA_LLARG, MESOS_CA_LLARG } from '../substitucions/substitucions.utils'
import type { Absencia, EstatAbsencia } from './types'

export const TABLE_ABSENCIES = 'absencies'

export function calcularHores(horaInici: string, horaFi: string): number {
  const [hIni, mIni] = horaInici.split(':').map(Number)
  const [hFi, mFi] = horaFi.split(':').map(Number)
  if ([hIni, mIni, hFi, mFi].some((n) => Number.isNaN(n))) return 0
  const minuts = (hFi * 60 + mFi) - (hIni * 60 + mIni)
  if (minuts <= 0) return 0
  return Math.round((minuts / 60) * 100) / 100
}

export interface AbsenciaRow {
  id: string
  codi: string
  professor: string
  data: string
  hora_inici: string
  hora_fi: string
  hores: number
  motiu: string
  notes: string
  estat: string
  motiu_rebuig: string
  creat_el: string
  creat_per: string
  revisat_per: string
  revisat_el: string
}

export function rowToAbsencia(row: AbsenciaRow): Absencia {
  return {
    id: row.id,
    ID: row.codi,
    Professor: row.professor,
    Data: row.data,
    HoraInici: row.hora_inici,
    HoraFi: row.hora_fi,
    Hores: row.hores,
    Motiu: row.motiu,
    Notes: row.notes,
    Estat: (row.estat as EstatAbsencia) ?? 'Pendent revisió',
    MotiuRebuig: row.motiu_rebuig,
    Creat_el: row.creat_el,
    Creat_per: row.creat_per,
    Revisat_per: row.revisat_per,
    Revisat_el: row.revisat_el,
  }
}

export function absenciaToInsert(a: {
  Professor: string
  Data: string
  HoraInici: string
  HoraFi: string
  Hores: number
  Motiu: string
  Notes: string
  Estat: EstatAbsencia
  Creat_per: string
}): Record<string, unknown> {
  return {
    professor: a.Professor,
    data: a.Data,
    hora_inici: a.HoraInici,
    hora_fi: a.HoraFi,
    hores: a.Hores,
    motiu: a.Motiu,
    notes: a.Notes,
    estat: a.Estat,
    creat_per: a.Creat_per,
  }
}

export function absenciaToUpdate(a: Partial<Pick<Absencia,
  'Estat' | 'MotiuRebuig' | 'Revisat_per' | 'Revisat_el'
>>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (a.Estat !== undefined) out.estat = a.Estat
  if (a.MotiuRebuig !== undefined) out.motiu_rebuig = a.MotiuRebuig
  if (a.Revisat_per !== undefined) out.revisat_per = a.Revisat_per
  if (a.Revisat_el !== undefined) out.revisat_el = a.Revisat_el
  return out
}

function formatDiaComplet(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${DIES_CA_LLARG[d.getDay()]}, ${d.getDate()} de ${MESOS_CA_LLARG[d.getMonth()]} de ${d.getFullYear()}`
}

export function buildEmailNovaAbsencia(
  a: Absencia,
  nomProfessor: string,
): { subject: string; body: string } {
  const diaStr = formatDiaComplet(a.Data)
  const subject = `Nova absència pendent de revisar — ${nomProfessor}`
  const lines = [
    `Hola,`,
    '',
    `${nomProfessor} ha reportat una absència pendent de revisar:`,
    '',
    `  Data:    ${diaStr}`,
    `  Horari:  ${a.HoraInici}–${a.HoraFi} (${a.Hores.toString().replace('.', ',')} hores)`,
    `  Motiu:   ${a.Motiu}`,
    ...(a.Notes ? ['', `  Notes: ${a.Notes}`] : []),
    '',
    `Accedeix a SJO Hub per aprovar-la o rebutjar-la.`,
    '',
    '— SJO Hub · Col·legi Sant Josep Obrer',
  ]
  return { subject, body: lines.join('\n') }
}

export function buildEmailRevisioAbsencia(a: Absencia): { subject: string; body: string } {
  const diaStr = formatDiaComplet(a.Data)
  const aprovada = a.Estat === 'Aprovada'
  const subject = `Absència ${aprovada ? 'aprovada' : 'rebutjada'} — ${diaStr}`
  const lines = [
    `Hola,`,
    '',
    `La teva absència del ${diaStr} (${a.HoraInici}–${a.HoraFi}) ha estat ${aprovada ? 'aprovada' : 'rebutjada'}.`,
    ...(!aprovada && a.MotiuRebuig ? ['', `Motiu: ${a.MotiuRebuig}`] : []),
    '',
    '— SJO Hub · Col·legi Sant Josep Obrer',
  ]
  return { subject, body: lines.join('\n') }
}

export async function getDireccioICoordinadorEmails(): Promise<string[]> {
  const { usuaris } = useUsuarisStore.getState()
  if (usuaris.length > 0) {
    return usuaris
      .filter((u) => u.Rol === 'coordinador' || u.Rol === 'direccio')
      .map((u) => u.Email)
      .filter(Boolean)
  }
  try {
    const { data, error } = await supabase.from('usuaris').select('email').in('rol', ['coordinador', 'direccio'])
    if (error) throw error
    return (data ?? []).map((r) => r.email).filter(Boolean)
  } catch {
    return []
  }
}
```

- [ ] **Step 3: Manually verify `calcularHores`**

This is the one piece of real logic in this task, so verify it directly rather than trusting it by inspection. Run:

```bash
npx tsx -e "
import { calcularHores } from './src/modules/absencies/absencies.utils'
console.log(calcularHores('09:00', '11:30'))  // expect 2.5
console.log(calcularHores('08:00', '08:00'))  // expect 0 (zero-length)
console.log(calcularHores('10:00', '09:00'))  // expect 0 (end before start)
console.log(calcularHores('09:15', '10:00'))  // expect 0.75
"
```

If `tsx` isn't available, run `npx --yes tsx -e "..."` (same command, forces a one-off install). Expected output: `2.5`, `0`, `0`, `0.75`.

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc -b`
Run: `npx eslint src/modules/absencies/absencies.utils.ts src/modules/substitucions/substitucions.utils.ts`
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add src/modules/absencies/absencies.utils.ts src/modules/substitucions/substitucions.utils.ts
git commit -m "feat(absencies): utils de mapeig, càlcul d'hores i correus"
```

---

### Task 7: `absencies` module — Zustand store

**Files:**
- Create: `src/modules/absencies/useAbsencies.ts`

**Interfaces:**
- Consumes: everything produced by Task 6 (`TABLE_ABSENCIES`, `rowToAbsencia`, `absenciaToInsert`, `absenciaToUpdate`, `calcularHores`, `buildEmailNovaAbsencia`, `buildEmailRevisioAbsencia`, `getDireccioICoordinadorEmails`, `AbsenciaRow`); `getAll`, `insertRow`, `updateRowById`, `deleteRowById` from `src/services/db.ts` (existing); `sendEmail` from `src/services/gmail.ts` (existing); `useAuthStore`, `useUsuarisStore` (existing).
- Produces: `useAbsencies` hook exposing `{ absencies: Absencia[], loading: boolean, error: string | null, load(), crear(data: AbsenciaFormData), aprovar(a: Absencia), rebutjar(a: Absencia, motiu: string), eliminar(a: Absencia) }` — Task 13 (`App.tsx` wrapper) calls every one of these by these exact names.

- [ ] **Step 1: Create the store**

```ts
import { create } from 'zustand'
import { getAll, insertRow, updateRowById, deleteRowById } from '../../services/db'
import { sendEmail } from '../../services/gmail'
import { useAuthStore } from '../../store/authStore'
import { useUsuarisStore } from '../../store/usuarisStore'
import type { Absencia, AbsenciaFormData } from './types'
import {
  TABLE_ABSENCIES, rowToAbsencia, absenciaToInsert, absenciaToUpdate,
  calcularHores, buildEmailNovaAbsencia, buildEmailRevisioAbsencia, getDireccioICoordinadorEmails,
  type AbsenciaRow,
} from './absencies.utils'

interface AbsenciesState {
  absencies: Absencia[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  crear: (data: AbsenciaFormData) => Promise<void>
  aprovar: (a: Absencia) => Promise<void>
  rebutjar: (a: Absencia, motiu: string) => Promise<void>
  eliminar: (a: Absencia) => Promise<void>
}

export const useAbsencies = create<AbsenciesState>((set, get) => ({
  absencies: [],
  loading: false,
  error: null,

  async load() {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const rows = await getAll<AbsenciaRow>(TABLE_ABSENCIES, 'data')
      set({ absencies: rows.map(rowToAbsencia) })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error carregant absències' })
    } finally {
      set({ loading: false })
    }
  },

  async crear(data) {
    const email = useAuthStore.getState().user?.email ?? ''
    const hores = calcularHores(data.HoraInici, data.HoraFi)

    const row = await insertRow<AbsenciaRow>(TABLE_ABSENCIES, absenciaToInsert({
      Professor: email,
      Data: data.Data,
      HoraInici: data.HoraInici,
      HoraFi: data.HoraFi,
      Hores: hores,
      Motiu: data.Motiu,
      Notes: data.Notes,
      Estat: 'Pendent revisió',
      Creat_per: email,
    }))
    const creada = rowToAbsencia(row)
    set((s) => ({ absencies: [...s.absencies, creada] }))

    try {
      const usuaris = useUsuarisStore.getState().usuaris
      const nom = usuaris.find((u) => u.Email === email)?.Nom || email
      const { subject, body } = buildEmailNovaAbsencia(creada, nom)
      const destinataris = await getDireccioICoordinadorEmails()
      await Promise.allSettled(destinataris.map((to) => sendEmail({ to, subject, body })))
    } catch {
      // error d'email és no bloquejant
    }
  },

  async aprovar(a) {
    const revisor = useAuthStore.getState().user?.email ?? ''
    const row = await updateRowById<AbsenciaRow>(TABLE_ABSENCIES, a.id, absenciaToUpdate({
      Estat: 'Aprovada', Revisat_per: revisor, Revisat_el: new Date().toISOString(),
    }))
    const updated = rowToAbsencia(row)
    set((s) => ({ absencies: s.absencies.map((x) => (x.id === a.id ? updated : x)) }))
    try {
      const { subject, body } = buildEmailRevisioAbsencia(updated)
      await sendEmail({ to: updated.Professor, subject, body })
    } catch {
      // no bloquejant
    }
  },

  async rebutjar(a, motiu) {
    const revisor = useAuthStore.getState().user?.email ?? ''
    const row = await updateRowById<AbsenciaRow>(TABLE_ABSENCIES, a.id, absenciaToUpdate({
      Estat: 'Rebutjada', MotiuRebuig: motiu, Revisat_per: revisor, Revisat_el: new Date().toISOString(),
    }))
    const updated = rowToAbsencia(row)
    set((s) => ({ absencies: s.absencies.map((x) => (x.id === a.id ? updated : x)) }))
    try {
      const { subject, body } = buildEmailRevisioAbsencia(updated)
      await sendEmail({ to: updated.Professor, subject, body })
    } catch {
      // no bloquejant
    }
  },

  async eliminar(a) {
    await deleteRowById(TABLE_ABSENCIES, a.id)
    set((s) => ({ absencies: s.absencies.filter((x) => x.id !== a.id) }))
  },
}))
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc -b`
Run: `npx eslint src/modules/absencies/useAbsencies.ts`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/modules/absencies/useAbsencies.ts
git commit -m "feat(absencies): store de gestió d'absències"
```

---

### Task 8: `AbsenciaForm` — report an absence

**Files:**
- Create: `src/modules/absencies/AbsenciaForm.tsx`

**Interfaces:**
- Consumes: `AbsenciaFormData` (Task 5), `calcularHores` (Task 6), `formatDateISO` (existing, from `../substitucions/substitucions.utils`), `useConfigStore` (existing).
- Produces: `<AbsenciaForm onDesar={(data: AbsenciaFormData) => Promise<void>} onCancel={() => void} />` — Task 13 renders this exact component with these exact props.

- [ ] **Step 1: Create the form**

```tsx
import { useState, useMemo } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { AbsenciaFormData } from './types'
import { calcularHores } from './absencies.utils'
import { formatDateISO } from '../substitucions/substitucions.utils'
import { useConfigStore } from '../../store/configStore'

interface Props {
  onDesar: (data: AbsenciaFormData) => Promise<void>
  onCancel: () => void
}

export function AbsenciaForm({ onDesar, onCancel }: Props) {
  const avui = formatDateISO(new Date())
  const motius = useConfigStore((s) => s.getValues('absencies.motius'))

  const [data, setData] = useState<AbsenciaFormData>({
    Data: avui,
    HoraInici: '',
    HoraFi: '',
    Motiu: '',
    Notes: '',
  })
  const [motiuAltre, setMotiuAltre] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof AbsenciaFormData>(k: K, v: AbsenciaFormData[K]) {
    setData((prev) => ({ ...prev, [k]: v }))
  }

  const hores = useMemo(() => calcularHores(data.HoraInici, data.HoraFi), [data.HoraInici, data.HoraFi])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!data.Data) { setError('Cal indicar la data.'); return }
    if (!data.HoraInici || !data.HoraFi) { setError("Cal indicar l'hora d'inici i de fi."); return }
    if (hores <= 0) { setError("L'hora de fi ha de ser posterior a la d'inici."); return }
    const motiuFinal = data.Motiu === 'Altre' ? motiuAltre.trim() : data.Motiu
    if (!motiuFinal) { setError('Cal indicar el motiu.'); return }
    setError('')
    setSaving(true)
    try {
      await onDesar({ ...data, Motiu: motiuFinal })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desant l'absència")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-sm font-semibold text-text-main">Nova absència</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
            <input
              type="date"
              value={data.Data}
              onChange={(e) => set('Data', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hora d'inici</label>
              <input
                type="time"
                value={data.HoraInici}
                onChange={(e) => set('HoraInici', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hora de fi</label>
              <input
                type="time"
                value={data.HoraFi}
                onChange={(e) => set('HoraFi', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {hores > 0 && (
            <p className="text-xs text-gray-500">
              Total: <span className="font-semibold text-text-main">{hores.toString().replace('.', ',')} hores</span>
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Motiu</label>
            <select
              value={data.Motiu}
              onChange={(e) => set('Motiu', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Selecciona un motiu…</option>
              {motius.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {data.Motiu === 'Altre' && (
              <input
                type="text"
                value={motiuAltre}
                onChange={(e) => setMotiuAltre(e.target.value)}
                placeholder="Especifica el motiu"
                className="w-full mt-2 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (opcional)</label>
            <textarea
              value={data.Notes}
              onChange={(e) => set('Notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>

        <div className="px-5 py-4 border-t border-gray-200 shrink-0 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel·la
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60"
            style={{ backgroundColor: '#861414' }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Reporta l'absència
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc -b`
Run: `npx eslint src/modules/absencies/AbsenciaForm.tsx`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/modules/absencies/AbsenciaForm.tsx
git commit -m "feat(absencies): formulari per reportar una absència"
```

---

### Task 9: `AbsenciaDetall` — view + approve/reject/delete/hand-off

**Files:**
- Create: `src/modules/absencies/AbsenciaDetall.tsx`

**Interfaces:**
- Consumes: `Absencia` (Task 5), `formatDate` (existing, from `../substitucions/substitucions.utils`), `useUsuarisStore` (existing).
- Produces: `<AbsenciaDetall absencia potAprovar potGestionar potEliminar onClose onAprovar onRebutjar onEliminar onCrearSubstitucio />` — Task 13 renders this with these exact prop names.

- [ ] **Step 1: Create the detail modal**

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
  const usuaris = useUsuarisStore((s) => s.usuaris)
  const nomProfessor = usuaris.find((u) => u.Email === absencia.Professor)?.Nom || absencia.Professor
  const [rebutjant, setRebutjant] = useState(false)
  const [motiuRebuig, setMotiuRebuig] = useState('')
  const [working, setWorking] = useState(false)

  async function handleAprovar() {
    setWorking(true)
    await onAprovar(absencia)
    setWorking(false)
  }

  async function handleRebutjar() {
    setWorking(true)
    await onRebutjar(absencia, motiuRebuig.trim())
    setWorking(false)
    setRebutjant(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-sm font-semibold text-text-main">Absència — {absencia.ID}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${ESTAT_COLORS[absencia.Estat]}`}>
            {absencia.Estat}
          </span>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-gray-400">Professor</p><p className="text-text-main font-medium">{nomProfessor}</p></div>
            <div><p className="text-gray-400">Data</p><p className="text-text-main font-medium">{formatDate(absencia.Data)}</p></div>
            <div><p className="text-gray-400">Horari</p><p className="text-text-main font-medium">{absencia.HoraInici}–{absencia.HoraFi}</p></div>
            <div><p className="text-gray-400">Hores</p><p className="text-text-main font-medium">{absencia.Hores.toString().replace('.', ',')}</p></div>
            <div className="col-span-2"><p className="text-gray-400">Motiu</p><p className="text-text-main font-medium">{absencia.Motiu}</p></div>
          </div>

          {absencia.Notes && (
            <div><p className="text-xs text-gray-400 mb-1">Notes</p><p className="text-text-main">{absencia.Notes}</p></div>
          )}

          {absencia.Estat === 'Rebutjada' && absencia.MotiuRebuig && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              Motiu del rebuig: {absencia.MotiuRebuig}
            </div>
          )}

          {rebutjant && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600">Motiu del rebuig (opcional)</label>
              <textarea
                value={motiuRebuig}
                onChange={(e) => setMotiuRebuig(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 shrink-0 flex flex-col gap-2">
          {absencia.Estat === 'Pendent revisió' && potAprovar && !rebutjant && (
            <div className="flex gap-2">
              <button
                onClick={() => setRebutjant(true)}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50"
              >
                <XCircle size={15} /> Rebutja
              </button>
              <button
                onClick={handleAprovar}
                disabled={working}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 bg-green-600 hover:bg-green-700"
              >
                <Check size={15} /> Aprova
              </button>
            </div>
          )}

          {rebutjant && (
            <div className="flex gap-2">
              <button
                onClick={() => setRebutjant(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel·la
              </button>
              <button
                onClick={handleRebutjar}
                disabled={working}
                className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 bg-red-600 hover:bg-red-700"
              >
                Confirma el rebuig
              </button>
            </div>
          )}

          {absencia.Estat === 'Aprovada' && potGestionar && (
            <button
              onClick={() => onCrearSubstitucio(absencia)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg"
              style={{ backgroundColor: '#861414' }}
            >
              <ClipboardPlus size={15} /> Crea la substitució
            </button>
          )}

          {potEliminar && (
            <button
              onClick={() => onEliminar(absencia)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-500 hover:text-red-600"
            >
              <Trash2 size={13} /> Elimina
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc -b`
Run: `npx eslint src/modules/absencies/AbsenciaDetall.tsx`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/modules/absencies/AbsenciaDetall.tsx
git commit -m "feat(absencies): detall d'absència amb aprovar/rebutjar/eliminar"
```

---

### Task 10: `AbsenciesTab` — list view + hours tally

**Files:**
- Create: `src/modules/absencies/AbsenciesTab.tsx`

**Interfaces:**
- Consumes: `Absencia` (Task 5), `formatDate` (existing), `useUsuarisStore`, `potCrear`, `potAprovarAbsencies` (Task 2).
- Produces: `<AbsenciesTab absencies loading error onRefresh onNova onVeure />` — Task 11 (`SubstitucionsPage.tsx`) renders this with these exact prop names.

- [ ] **Step 1: Create the tab component**

```tsx
import { useState, useMemo } from 'react'
import { Plus, RefreshCw, CalendarOff, Timer } from 'lucide-react'
import type { Absencia } from './types'
import { formatDate } from '../substitucions/substitucions.utils'
import { useUsuarisStore, potCrear, potAprovarAbsencies } from '../../store/usuarisStore'

const ESTAT_COLORS: Record<Absencia['Estat'], string> = {
  'Pendent revisió': 'text-amber-700 bg-amber-100 border-amber-200',
  'Aprovada': 'text-green-700 bg-green-100 border-green-200',
  'Rebutjada': 'text-red-700 bg-red-100 border-red-200',
}

interface Props {
  absencies: Absencia[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onNova: () => void
  onVeure: (a: Absencia) => void
}

export function AbsenciesTab({ absencies, loading, error, onRefresh, onNova, onVeure }: Props) {
  const rol = useUsuarisStore((s) => s.rol)
  const usuaris = useUsuarisStore((s) => s.usuaris)
  const [vista, setVista] = useState<'llista' | 'recompte'>('llista')
  const potRecompte = potAprovarAbsencies(rol)

  const pendents = absencies.filter((a) => a.Estat === 'Pendent revisió').length

  const recompte = useMemo(() => {
    const totals = new Map<string, number>()
    for (const a of absencies) {
      if (a.Estat !== 'Aprovada') continue
      totals.set(a.Professor, (totals.get(a.Professor) ?? 0) + a.Hores)
    }
    return Array.from(totals.entries())
      .map(([email, hores]) => ({
        email,
        hores,
        nom: usuaris.find((u) => u.Email === email)?.Nom || email,
      }))
      .sort((a, b) => b.hores - a.hores)
  }, [absencies, usuaris])

  return (
    <div className="flex-1 overflow-auto px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {potCrear(rol) && (
            <button
              onClick={onNova}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg"
              style={{ backgroundColor: '#861414' }}
            >
              <Plus size={14} /> Nova absència
            </button>
          )}
          {pendents > 0 && (
            <span className="text-xs text-amber-700 bg-amber-100 border border-amber-200 px-2 py-1 rounded-full">
              {pendents} pendent{pendents > 1 ? 's' : ''} de revisar
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {potRecompte && (
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {([['llista', 'Absències', CalendarOff], ['recompte', "Recompte d'hores", Timer]] as const).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setVista(key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    vista === key ? 'bg-white text-text-main shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          )}
          <button onClick={onRefresh} className="p-1.5 text-gray-400 hover:text-gray-600">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {vista === 'llista' ? (
        <div className="space-y-2">
          {absencies.length === 0 && !loading && (
            <p className="text-sm text-gray-400 text-center py-8">Encara no hi ha cap absència reportada.</p>
          )}
          {absencies.map((a) => {
            const nom = usuaris.find((u) => u.Email === a.Professor)?.Nom || a.Professor
            return (
              <button
                key={a.id}
                onClick={() => onVeure(a)}
                className="w-full text-left flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${ESTAT_COLORS[a.Estat]}`}>
                    {a.Estat}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-text-main">{nom}</p>
                    <p className="text-xs text-gray-400">{formatDate(a.Data)} · {a.HoraInici}–{a.HoraFi} · {a.Motiu}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-text-main shrink-0">
                  {a.Hores.toString().replace('.', ',')}h
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Professor</th>
                <th className="px-4 py-2.5 font-medium text-right">Hores faltades (curs)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recompte.length === 0 && (
                <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-400">Encara no hi ha absències aprovades.</td></tr>
              )}
              {recompte.map((r) => (
                <tr key={r.email}>
                  <td className="px-4 py-2.5 text-text-main">{r.nom}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-text-main">{r.hores.toString().replace('.', ',')}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc -b`
Run: `npx eslint src/modules/absencies/AbsenciesTab.tsx`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/modules/absencies/AbsenciesTab.tsx
git commit -m "feat(absencies): llista d'absències i recompte d'hores"
```

---

### Task 11: Wire the "Absències" tab into `SubstitucionsPage`

**Files:**
- Modify: `src/modules/substitucions/SubstitucionsPage.tsx:1-28` (imports, `Tab` type, `Props`), `:352-366` (tab bar), end of file (new render block)

**Interfaces:**
- Consumes: `AbsenciesTab` (Task 10), `Absencia` (Task 5).
- Produces: `SubstitucionsPage` now accepts 6 new props: `absencies: Absencia[]`, `loadingAbsencies: boolean`, `errorAbsencies: string | null`, `onRefreshAbsencies: () => void`, `onNovaAbsencia: () => void`, `onVeureAbsencia: (a: Absencia) => void` — Task 13 passes all six.

- [ ] **Step 1: Update imports and the `Tab` type**

In `src/modules/substitucions/SubstitucionsPage.tsx`, change line 1-11 from:

```tsx
import { useState, useMemo } from 'react'
import { Plus, RefreshCw, ChevronLeft, ChevronRight, BarChart2, CalendarDays } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuthStore } from '../../store/authStore'
import type { Substitucio, EstatSubstitucio } from './types'
import {
  formatDateISO, formatDiaLlarg, formatWeekRange, getWeekDates,
} from './substitucions.utils'
import { useUsuarisStore, potGestionar } from '../../store/usuarisStore'

type Tab = 'setmana' | 'estadistiques'
```

to:

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

- [ ] **Step 2: Extend `Props`**

Change the `Props` interface (currently lines 21-28) from:

```tsx
interface Props {
  substitucions: Substitucio[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onNova: (dataInicial?: string) => void
  onVeure: (s: Substitucio) => void
}
```

to:

```tsx
interface Props {
  substitucions: Substitucio[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onNova: (dataInicial?: string) => void
  onVeure: (s: Substitucio) => void
  absencies: Absencia[]
  loadingAbsencies: boolean
  errorAbsencies: string | null
  onRefreshAbsencies: () => void
  onNovaAbsencia: () => void
  onVeureAbsencia: (a: Absencia) => void
}
```

- [ ] **Step 3: Destructure the new props**

Find the component signature (`export function SubstitucionsPage({ ... }: Props) {`) and add the 6 new names to the destructured argument list, matching whatever style is already used there (the existing 6 props are already destructured the same way — add the new ones after `onVeure`).

- [ ] **Step 4: Add the third tab to the tab bar**

Change lines 353-365 from:

```tsx
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {([['setmana', 'Vista setmanal', CalendarDays], ['estadistiques', 'Estadístiques', BarChart2]] as const).map(([key, label, Icon]) => (
```

to:

```tsx
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {([['setmana', 'Vista setmanal', CalendarDays], ['estadistiques', 'Estadístiques', BarChart2], ['absencies', 'Absències', CalendarOff]] as const).map(([key, label, Icon]) => (
```

(the rest of that `.map(...)` block — the `<button>` — is unchanged, it already reads `key`/`label`/`Icon` generically).

- [ ] **Step 5: Render `AbsenciesTab` for the new tab**

At the very end of the file, the last two blocks are the `{tab === 'estadistiques' && ( ... )}` block followed by the component's closing `</div>\n)\n}`. Insert a new block between them:

```tsx
      {tab === 'absencies' && (
        <AbsenciesTab
          absencies={absencies}
          loading={loadingAbsencies}
          error={errorAbsencies}
          onRefresh={onRefreshAbsencies}
          onNova={onNovaAbsencia}
          onVeure={onVeureAbsencia}
        />
      )}
```

So the tail of the file reads (unchanged text above is just context, only the new block in the middle is added):

```tsx
          <p className="text-[11px] text-gray-400 mt-3">
            Les substitucions cancel·lades no compten. Les de pati es compten per separat.
          </p>
        </div>
      )}

      {tab === 'absencies' && (
        <AbsenciesTab
          absencies={absencies}
          loading={loadingAbsencies}
          error={errorAbsencies}
          onRefresh={onRefreshAbsencies}
          onNova={onNovaAbsencia}
          onVeure={onVeureAbsencia}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc -b`
Expected: errors about `App.tsx` not passing the 6 new required props (Task 13 fixes this) — that's expected and fine at this point. Confirm there are **no errors inside `SubstitucionsPage.tsx` itself** (no typos, no missing imports).

- [ ] **Step 7: Commit**

```bash
git add src/modules/substitucions/SubstitucionsPage.tsx
git commit -m "feat(absencies): afegir la pestanya Absències a Substitucions"
```

---

### Task 12: Link a `Substitucio` back to the `Absència` it came from

**Files:**
- Modify: `src/modules/substitucions/types.ts`
- Modify: `src/modules/substitucions/substitucions.utils.ts`
- Modify: `src/modules/substitucions/SubstitucioForm.tsx`

**Interfaces:**
- Produces: `Substitucio.Absencia_ID?: string`, `SubstitucioFormData.Absencia_ID?: string`, and three new optional `SubstitucioForm` props (`professorAbsentInicial`, `franjaInicial`, `absenciaIdInicial`) — Task 13 passes these when opening the form from an approved absence.

- [ ] **Step 1: Add the optional field to both types**

In `src/modules/substitucions/types.ts`, add `Absencia_ID?: string` to both `Substitucio` (after `Creat_per: string`) and `SubstitucioFormData` (after `Notes: string`):

```ts
export interface Substitucio {
  id: string
  ID: string
  Data: string
  Etapa: EtapaSubstitucio
  Franja: string
  Tipus: TipusSubstitucio
  ProfessorAbsent: string
  ProfessorSubstitut: string
  Grup: string
  Materia: string
  Estat: EstatSubstitucio
  Notes: string
  Creat_el: string
  Creat_per: string
  Absencia_ID?: string
}

export interface SubstitucioFormData {
  Data: string
  Etapa: EtapaSubstitucio
  Franja: string
  Tipus: TipusSubstitucio
  ProfessorAbsent: string
  ProfessorSubstitut: string
  Grup: string
  Materia: string
  Notes: string
  Absencia_ID?: string
}
```

- [ ] **Step 2: Thread the field through the row mappers**

In `src/modules/substitucions/substitucions.utils.ts`, add `absencia_id: string | null` to `SubstitucioRow`:

```ts
export interface SubstitucioRow {
  id: string
  codi: string
  data: string
  etapa: string
  franja: string
  tipus: string
  professor_absent: string
  professor_substitut: string
  grup: string
  materia: string
  estat: string
  notes: string
  creat_el: string
  creat_per: string
  absencia_id: string | null
}
```

Update `rowToSubstitucio` to map it (add after `Creat_per: row.creat_per,`):

```ts
    Absencia_ID: row.absencia_id ?? undefined,
```

Update `substitucioToInsert` to include it when present — change:

```ts
export function substitucioToInsert(s: Omit<Substitucio, 'id' | 'ID' | 'Creat_el'>): Record<string, unknown> {
  return {
    data: s.Data, etapa: s.Etapa, franja: s.Franja, tipus: s.Tipus,
    professor_absent: s.ProfessorAbsent, professor_substitut: s.ProfessorSubstitut,
    grup: s.Grup, materia: s.Materia, estat: s.Estat,
    notes: s.Notes, creat_per: s.Creat_per,
  }
}
```

to:

```ts
export function substitucioToInsert(s: Omit<Substitucio, 'id' | 'ID' | 'Creat_el'>): Record<string, unknown> {
  return {
    data: s.Data, etapa: s.Etapa, franja: s.Franja, tipus: s.Tipus,
    professor_absent: s.ProfessorAbsent, professor_substitut: s.ProfessorSubstitut,
    grup: s.Grup, materia: s.Materia, estat: s.Estat,
    notes: s.Notes, creat_per: s.Creat_per,
    absencia_id: s.Absencia_ID ?? null,
  }
}
```

- [ ] **Step 3: Prefill `SubstitucioForm` from an absence**

In `src/modules/substitucions/SubstitucioForm.tsx`, change the `Props` interface and initial state (lines 8-31) from:

```tsx
interface Props {
  dataInicial?: string
  onDesar: (data: SubstitucioFormData) => Promise<void>
  onCancel: () => void
}

const TIPUS: TipusSubstitucio[] = ['Classe', 'Pati']

export function SubstitucioForm({ dataInicial, onDesar, onCancel }: Props) {
  const avui = formatDateISO(new Date())
  const usuaris = useUsuarisStore((s) => s.usuaris)


  const [data, setData] = useState<SubstitucioFormData>({
    Data: dataInicial ?? avui,
    Etapa: 'ESO 1r-2n',
    Franja: '',
    Tipus: 'Classe',
    ProfessorAbsent: '',
    ProfessorSubstitut: '',
    Grup: '',
    Materia: '',
    Notes: '',
  })
```

to:

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

- [ ] **Step 4: Type-check**

Run: `npx tsc -b`
Expected: no errors (the only remaining errors at this point should be the `App.tsx` ones from Task 11 Step 6 — Task 13 fixes those next).

- [ ] **Step 5: Apply the same optional column to the live Supabase table**

This was already created by Task 1 (`absencia_id` on `substitucions`) — nothing to do here, this step is just confirming Task 1 covered it. Skip re-running the migration.

- [ ] **Step 6: Lint the three touched files**

Run: `npx eslint src/modules/substitucions/types.ts src/modules/substitucions/substitucions.utils.ts src/modules/substitucions/SubstitucioForm.tsx`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/modules/substitucions/types.ts src/modules/substitucions/substitucions.utils.ts src/modules/substitucions/SubstitucioForm.tsx
git commit -m "feat(absencies): enllaçar les substitucions amb l'absència d'origen"
```

---

### Task 13: Wire everything together in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useAbsencies` (Task 7), `AbsenciaForm` (Task 8), `AbsenciaDetall` (Task 9), `potAprovarAbsencies`, `potGestionar`, `potEliminar` (existing + Task 2), the extended `SubstitucionsPage` (Task 11), the extended `SubstitucioForm` (Task 12).

- [ ] **Step 1: Add imports**

In `src/App.tsx`, near the other `substitucions` imports (around line 38-42), add:

```tsx
import { useAbsencies } from './modules/absencies/useAbsencies'
import { AbsenciaForm } from './modules/absencies/AbsenciaForm'
import { AbsenciaDetall } from './modules/absencies/AbsenciaDetall'
import type { Absencia } from './modules/absencies/types'
```

And add `potAprovarAbsencies` to the existing import from `usuarisStore` (currently `import { useUsuarisStore, potGestionar, potEliminar } from './store/usuarisStore'`):

```tsx
import { useUsuarisStore, potGestionar, potEliminar, potAprovarAbsencies } from './store/usuarisStore'
```

- [ ] **Step 2: Replace `SubstitucionsWrapper`**

Replace the whole existing `SubstitucionsWrapper` function (currently lines 545-594) with:

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
  const [seleccionada, setSeleccionada] = useState<Substitucio | null>(null)

  const [formAbsenciaObert, setFormAbsenciaObert] = useState(false)
  const [absenciaSeleccionada, setAbsenciaSeleccionada] = useState<Absencia | null>(null)

  async function handleCanviarEstat(s: Substitucio, estat: Parameters<typeof canviarEstat>[1]) {
    await canviarEstat(s, estat)
    setSeleccionada((prev) => prev ? { ...prev, Estat: estat } : null)
  }

  function handleNova(data?: string) {
    setDataInicial(data)
    setProfessorAbsentInicial(undefined)
    setFranjaInicial(undefined)
    setAbsenciaIdInicial(undefined)
    setFormObert(true)
  }

  function handleCrearSubstitucioDesDAbsencia(a: Absencia) {
    setAbsenciaSeleccionada(null)
    setDataInicial(a.Data)
    setProfessorAbsentInicial(a.Professor)
    setFranjaInicial(`${a.HoraInici}-${a.HoraFi}`)
    setAbsenciaIdInicial(a.id)
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
      {absenciaSeleccionada && (
        <AbsenciaDetall
          absencia={absenciaSeleccionada}
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

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: clean — this closes out every "missing prop" error left over from Tasks 11 and 12.

- [ ] **Step 4: Lint**

Run: `npx eslint src/App.tsx`
Expected: clean (the one pre-existing unrelated warning about `useSubstitucions`'s `load` dependency, noted earlier in this project, may still appear — that's not introduced by this change, leave it).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(absencies): connectar el flux d'absències a App.tsx"
```

---

### Task 14: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Full build**

Run: `npx tsc -b && npm run build`
Expected: clean build, no TypeScript errors, no Vite build errors.

- [ ] **Step 2: Lint the whole project**

Run: `npx eslint .`
Expected: no new errors beyond the one pre-existing warning already present before this feature (`useReserves.ts`/`useSubstitucions` `set-state-in-effect`).

- [ ] **Step 3: Manual walkthrough in the dev server**

Run `npm run dev`, log in with a real `@stjosep.org` account, and check (adjust the account's `rol` directly in the `usuaris` table via Supabase if you need to test more than one role):

- As `professorat`: Substitucions → "Absències" tab is visible, "Nova absència" button visible, "Recompte d'hores" toggle is **not** visible. Submit an absence (e.g. 09:00–11:30) — form shows "2,5 hores" live, saves, appears in the list as `Pendent revisió`.
- As `cap_estudis`: can see the absence in the list, but no Aprovar/Rebutjar buttons on it, and no "Recompte d'hores" toggle.
- As `direccio` or `coordinador`: sees Aprovar/Rebutjar buttons on the pending absence; rejecting asks for an optional reason and moves it to `Rebutjada`; approving moves it to `Aprovada` and shows a "Crea la substitució" button, which opens the existing "Nova substitució" form pre-filled with the right date, professor, and franja.
- Still as `direccio`/`coordinador`: "Recompte d'hores" toggle is visible; after approving the test absence, the professor appears in the tally with the right decimal hours.
- Confirm in the Supabase table editor (or via `mcp__claude_ai_Supabase__execute_sql`) that the created `substitucions` row has `absencia_id` set to the absence's `id`.

- [ ] **Step 4: Final commit (only if Step 3 required fixes)**

If manual verification surfaced any fix, commit it separately with a message describing exactly what was wrong — do not fold silent fixes into an earlier task's commit.

---

## Self-Review Notes

- **Spec coverage:** single-event report (Task 8) ✓, Motiu required with configurable list + Altre (Tasks 3, 4, 8) ✓, decimal hours e.g. `2,5` (Task 6 `calcularHores`, verified with `9:00`→`11:30` → `2.5`) ✓, Pendent-revisió → Direcció/Coordinador approval, Cap d'Estudis excluded (Task 2 `potAprovarAbsencies`, Task 9/10 gating) ✓, linked to Substitucions (Tasks 11-13) ✓, recompte d'hores restricted to Direcció/Coordinador (Task 10 `potRecompte`) ✓.
- **Out of scope, explicitly:** automatic per-class-period generation of substitucions from an absence window — no timetable data exists in the app to make this possible; Task 9's "Crea la substitució" hands off to the existing manual form instead.
- **Placeholder scan:** none found — every step has literal, complete code.
- **Type consistency check:** `Absencia`/`AbsenciaFormData` (Task 5) → same field names used verbatim in Tasks 6, 7, 8, 9, 10, 13. `potAprovarAbsencies` (Task 2) → same name used in Tasks 9, 10, 13. `AbsenciesTab` props (Task 10: `absencies, loading, error, onRefresh, onNova, onVeure`) → matched exactly by `SubstitucionsPage`'s new props and JSX in Task 11. `SubstitucioForm`'s three new props (Task 12: `professorAbsentInicial, franjaInicial, absenciaIdInicial`) → matched exactly by Task 13's `handleCrearSubstitucioDesDAbsencia`.
