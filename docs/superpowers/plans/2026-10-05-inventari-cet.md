# Inventari ampliat i importació del CET — pla d'implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar el mòdul d'Inventari perquè pugui guardar tot el que porta el full CET: nou estats, acció pendent, sistema operatiu i un catàleg d'ubicacions amb edifici i planta. Després, importar-hi els 153 dispositius.

**Architecture:**
- **Migració** (una de sola): crea la taula `ubicacions`, lliga-hi `inventari.ubicacio` amb una clau forana, amplia el `CHECK` d'estats i afegeix dues columnes.
- **Lògica en mòduls purs, amb proves**: estats i ubicacions.
- **Components**: només pinten el que els mòduls purs decideixen.
- **Importació**: es fa un sol cop, amb un script fora del repositori, **després** de fusionar i aplicar la migració.

**Tech Stack:** PostgreSQL 17 (Supabase), React 19 + TypeScript estricte, Zustand, Tailwind, Vitest (entorn `node`) amb PGlite per a les proves de base de dades.

**Spec:** `docs/superpowers/specs/2026-10-05-inventari-cet-design.md`

## Global Constraints

- **Tot en català**: noms, comentaris, missatges i textos de pantalla.
- **Apòstrof tipogràfic `’` a tot el text de cara a l'usuari**, inclosos els títols de prova.
  - **Mai un apòstrof recte dins d'una cadena de cometes simples**: ja ha trencat la compilació dues vegades.
  - **Als comentaris de codi, l'apòstrof recte és la convenció del repositori** i no és un defecte.
- **TypeScript estricte** (`verbatimModuleSyntax`, `noUnusedLocals`). Els tipus s'importen amb `import type`, en una línia a part.
- **No hi ha proves de components**: Vitest corre amb `environment: 'node'`, sense DOM. Tota lògica provable viu en un mòdul pur, mai dins un `.tsx`.
- **`supabase/schema.sql` no es toca, ni cap migració ja aplicada.** Els canvis d'esquema van a `supabase/migrations/202610050001_inventari_cet.sql`.
- **`npx tsc --noEmit` compila zero fitxers** en aquest projecte. La comprovació real és `npm run typecheck`.
- **Mai `text-gray-400` per a text que s'hagi de llegir.** El text secundari és `text-gray-500`; les icones poden ser `text-gray-400`.
- **Cap contrasenya entra al repositori ni a la base de dades.** El full CET en té moltes; el codi del repositori no n'ha de contenir cap.
- **Els nou estats, literalment i en aquest ordre:** `Actiu`, `Avariat`, `En reparació`, `En préstec`, `En proves`, `No desplegat`, `Retirat temporalment`, `De baixa`, `Robat`.
- **`ubicacio` i `mac_wan` mantenen el nom** a la base de dades i a la pantalla. Ho ha decidit l'Andrés.

## Estructura de fitxers

| Fitxer | Responsabilitat |
|---|---|
| `supabase/migrations/202610050001_inventari_cet.sql` **(nou)** | Taula `ubicacions`, clau forana, estats, `accio` i `sistema_operatiu`. |
| `tests/database.test.ts` **(modificar)** | Proves de la migració contra PGlite. |
| `src/modules/inventari/estats.ts` **(nou)** | Els 9 estats i `esAvariat`. |
| `src/modules/inventari/estats.test.ts` **(nou)** | |
| `src/modules/inventari/ubicacions.ts` **(nou)** | Tipus `Ubicacio`, `ubicacioCompleta`, `missatgeErrorUbicacio`. |
| `src/modules/inventari/ubicacions.test.ts` **(nou)** | |
| `src/modules/inventari/types.ts` **(modificar)** | `Accio`, `SistemaOperatiu`; `EstatInventari` ve d'`estats.ts`. |
| `src/modules/inventari/useInventari.ts` **(modificar)** | Llegir i escriure els camps nous; `ubicacio` buida es desa com a `null`. |
| `src/modules/inventari/useUbicacions.ts` **(nou)** | Llegir i escriure el catàleg d'ubicacions. |
| `src/modules/inventari/InventariForm.tsx` **(modificar)** | Ubicació del catàleg, 9 estats, acció i sistema operatiu. |
| `src/modules/inventari/InventariDetall.tsx` **(modificar)** | Ubicació completa, acció pendent i sistema operatiu. |
| `src/modules/inventari/InventariPage.tsx` **(modificar)** | Filtres per ubicació i acció; fora el *mock*. |
| `src/modules/inventari/UbicacionsEditor.tsx` **(nou)** | Editor del catàleg per a Configuració. |
| `src/app/routes/InventariWrapper.tsx` **(modificar)** | Carrega les ubicacions i les passa a les tres vistes. |
| `src/components/Badge.tsx` **(modificar)** | Color per a cadascun dels 9 estats. |
| `src/modules/dashboard/DashboardPage.tsx` **(modificar)** | La targeta compta `Avariat` i `En reparació`. |
| `src/store/configStore.ts` **(modificar)** | Valors per defecte de Tipus, Accions i Sistemes operatius. |
| `src/modules/configuracio/ConfiguracioPage.tsx` **(modificar)** | Llistes noves i editor d'ubicacions a la categoria Inventari. |
| `src/pages/AjudaPage.tsx` **(modificar)** | Secció d'Inventari, Dashboard i taula de Configuració. |

---

### Task 1: La migració i les seves proves

**Files:**
- Create: `supabase/migrations/202610050001_inventari_cet.sql`
- Modify: `tests/database.test.ts` (afegir un `describe` al final del fitxer)

**Interfaces:**
- Consumes: `app_private.module_visible(text)`, `app_private.admin()`, `app_private.audit_change()` i `app_private.fre_esborrats()`. Ja existeixen.
- Produces:
  - la taula `public.ubicacions(id uuid, codi text unique, edifici text, planta text)`;
  - la clau forana `inventari_ubicacio_fkey`;
  - les columnes `inventari.accio` i `inventari.sistema_operatiu` (`text not null default ''`);
  - el `CHECK` `inventari_estat_check` amb els 9 estats.

**Context que et cal i que no pots endevinar:**

- `tests/database.test.ts` carrega `supabase/schema.sql` i **totes** les migracions per ordre alfabètic a una PGlite.
  - Cada prova corre dins d'un `begin` que l'`afterEach` desfà.
  - **Una sentència que falla avorta la transacció.** Per això, una prova que espera un error l'ha de tenir com a **última sentència**, o ha d'usar `savepoint` com fa el `describe('fre als esborrats massius')`.
- **`asUser(email)`** canvia d'usuari (vegeu les línies 8-12 del fitxer). Els usuaris de prova són:
  - `admin@stjosep.org` (coordinador);
  - `teacher@stjosep.org` (professorat).
- **El test `anon no té cap privilegi sobre cap taula` ja existeix i la taula nova l'ha de passar.** L'entorn de proves (línies 34-35) replica el que fa Supabase: dona tots els privilegis a `anon` i `authenticated` a cada taula nova. Per això la migració ha de començar amb `revoke all … from anon, authenticated`.
- **Polítiques actuals d'`inventari`**: lectura amb `module_visible('inventari')`; escriptura amb `module_visible('inventari') and admin()`. La taula nova copia exactament aquesta regla.
- **Patró de disparadors**: `supabase/migrations/202609210001_excursions_finances.sql:48-60`.

- [ ] **Step 1: Escriu les proves (fallaran)**

Afegeix al final de `tests/database.test.ts`:

```ts
describe('inventari: catàleg d’ubicacions i estats nous', () => {
  async function ubicacio(codi = 'A21-ESO-2A') {
    await asUser('admin@stjosep.org')
    await db.query("insert into public.ubicacions(codi,edifici,planta) values($1,'A-EscC','PTA1')", [codi])
  }

  it('el coordinador dona d’alta una ubicació i el professorat la llegeix', async () => {
    await ubicacio()
    await asUser('teacher@stjosep.org')
    expect((await db.query('select codi, edifici, planta from public.ubicacions')).rows)
      .toEqual([{ codi: 'A21-ESO-2A', edifici: 'A-EscC', planta: 'PTA1' }])
  })

  it('el professorat no pot crear ubicacions', async () => {
    await asUser('teacher@stjosep.org')
    await expect(db.query("insert into public.ubicacions(codi) values('Aula X')")).rejects.toThrow()
  })

  it('un dispositiu només pot anar a una ubicació del catàleg', async () => {
    await asUser('admin@stjosep.org')
    await expect(db.query("insert into public.inventari(nom,ubicacio) values('PC','No existeix')"))
      .rejects.toThrow(/foreign key/)
  })

  it('un dispositiu pot no tenir ubicació', async () => {
    await asUser('admin@stjosep.org')
    const r = await db.query<{ ubicacio: string | null }>("insert into public.inventari(nom) values('Tauleta') returning ubicacio")
    expect(r.rows[0].ubicacio).toBeNull()
  })

  it('reanomenar una ubicació arriba als seus dispositius', async () => {
    await ubicacio()
    await db.query("insert into public.inventari(nom,ubicacio) values('Pissarra','A21-ESO-2A')")
    await db.query("update public.ubicacions set codi='A21-ESO-2B' where codi='A21-ESO-2A'")
    expect((await db.query("select ubicacio from public.inventari where nom='Pissarra'")).rows)
      .toEqual([{ ubicacio: 'A21-ESO-2B' }])
  })

  it('no es pot esborrar una ubicació que encara té dispositius', async () => {
    await ubicacio()
    await db.query("insert into public.inventari(nom,ubicacio) values('Pissarra','A21-ESO-2A')")
    await expect(db.query("delete from public.ubicacions where codi='A21-ESO-2A'")).rejects.toThrow(/foreign key/)
  })

  it('admet els nou estats i rebutja els que no hi són', async () => {
    await asUser('admin@stjosep.org')
    for (const estat of ['Actiu', 'Avariat', 'En reparació', 'En préstec', 'En proves',
      'No desplegat', 'Retirat temporalment', 'De baixa', 'Robat']) {
      await db.query("insert into public.inventari(nom,estat) values('X',$1)", [estat])
    }
    await expect(db.query("insert into public.inventari(nom,estat) values('X','Perdut')"))
      .rejects.toThrow(/inventari_estat_check/)
  })

  it('guarda l’acció pendent i el sistema operatiu', async () => {
    await asUser('admin@stjosep.org')
    const r = await db.query<{ accio: string; sistema_operatiu: string }>(
      "insert into public.inventari(nom,accio,sistema_operatiu) values('PC','Revisar','Windows 11') returning accio, sistema_operatiu")
    expect(r.rows[0]).toEqual({ accio: 'Revisar', sistema_operatiu: 'Windows 11' })
  })
})
```

- [ ] **Step 2: Comprova que fallen**

Run: `npx vitest run tests/database.test.ts -t "catàleg d’ubicacions"`
Expected: FAIL. `relation "public.ubicacions" does not exist`, o columna inexistent.

- [ ] **Step 3: Escriu la migració**

Crea `supabase/migrations/202610050001_inventari_cet.sql`:

```sql
begin;

-- Catàleg d'aules i espais. El full CET ja el portava (pestanya Barems): cada
-- ubicació té un sol edifici i una sola planta, i així dos dispositius de la
-- mateixa aula no poden dir coses diferents.
create table if not exists public.ubicacions (
  id uuid primary key default gen_random_uuid(),
  codi text not null unique,
  edifici text not null default '',
  planta text not null default '',
  constraint ubicacions_codi_no_buit check (trim(codi) <> '')
);
alter table public.ubicacions enable row level security;

-- L'RLS filtra files; el GRANT dona accés a la taula. Calen les dues coses.
revoke all on public.ubicacions from anon, authenticated;
grant select, insert, update, delete on public.ubicacions to authenticated;

-- La mateixa regla que inventari: la veu qui veu el mòdul, la toca la coordinació.
create policy ubicacions_read on public.ubicacions for select to authenticated
using (app_private.module_visible('inventari'));
create policy ubicacions_admin on public.ubicacions for all to authenticated
using (app_private.module_visible('inventari') and app_private.admin())
with check (app_private.module_visible('inventari') and app_private.admin());

create trigger audit_change after insert or update or delete on public.ubicacions
for each row execute function app_private.audit_change();
create trigger fre_esborrats after delete on public.ubicacions
referencing old table as esborrades
for each statement execute function app_private.fre_esborrats('1');

-- La ubicació d'un dispositiu passa a ser un codi del catàleg. Pot ser buida
-- (null): al full n'hi ha uns quants sense aula. Les que ja hi hagués escrites
-- a mà entren al catàleg tal qual, perquè la clau forana no les rebutgi.
alter table public.inventari alter column ubicacio drop not null;
alter table public.inventari alter column ubicacio drop default;
update public.inventari set ubicacio = null where trim(ubicacio) = '';
insert into public.ubicacions(codi)
  select distinct ubicacio from public.inventari where ubicacio is not null
  on conflict (codi) do nothing;
-- Reanomenar una ubicació arriba als seus dispositius; esborrar-ne una que
-- encara en té no es pot.
alter table public.inventari add constraint inventari_ubicacio_fkey
  foreign key (ubicacio) references public.ubicacions(codi)
  on update cascade on delete restrict;

-- Nou estats fixos. No són una llista de Configuració perquè el Dashboard i
-- les etiquetes de color en depenen.
alter table public.inventari drop constraint if exists inventari_estat_check;
alter table public.inventari add constraint inventari_estat_check check (estat in (
  'Actiu','Avariat','En reparació','En préstec','En proves',
  'No desplegat','Retirat temporalment','De baixa','Robat'));

-- Els valors surten de dues llistes editables de Configuració
-- (inventari.accions i inventari.sistemes-operatius); per això són text lliure.
alter table public.inventari add column if not exists accio text not null default '';
alter table public.inventari add column if not exists sistema_operatiu text not null default '';

commit;
```

- [ ] **Step 4: Comprova que passen, i que no se n'ha trencat cap altra**

Run: `npx vitest run tests/database.test.ts`
Expected: PASS a tot el fitxer, incloses `anon no té cap privilegi sobre cap taula` i `cap taula de public dona TRUNCATE ni REFERENCES`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202610050001_inventari_cet.sql tests/database.test.ts
git commit -m "feat(inventari): catàleg d'ubicacions, nou estats, acció i sistema operatiu a la base de dades

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Els mòduls purs d'estats i ubicacions

**Files:**
- Create: `src/modules/inventari/estats.ts`, `src/modules/inventari/estats.test.ts`
- Create: `src/modules/inventari/ubicacions.ts`, `src/modules/inventari/ubicacions.test.ts`

**Interfaces:**
- Consumes: res.
- Produces:
  - `ESTATS_INVENTARI` (tupla `as const` dels 9 estats);
  - `type EstatInventari`;
  - `esAvariat(estat: EstatInventari): boolean`;
  - `interface Ubicacio { id: string; Codi: string; Edifici: string; Planta: string }`;
  - `ubicacioCompleta(codi: string, ubicacions: Ubicacio[]): string`;
  - `missatgeErrorUbicacio(err: unknown): string`.

**Context que et cal:** cap dels dos fitxers pot importar res del projecte, perquè s'han de poder provar sense pantalla. El patró és el de `src/modules/excursions/preu.ts`.

- [ ] **Step 1: Escriu les proves (fallaran)**

`src/modules/inventari/estats.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ESTATS_INVENTARI, esAvariat } from './estats'

describe('estats de l’inventari', () => {
  it('són exactament els nou que admet la base de dades, en aquest ordre', () => {
    expect(ESTATS_INVENTARI).toEqual([
      'Actiu', 'Avariat', 'En reparació', 'En préstec', 'En proves',
      'No desplegat', 'Retirat temporalment', 'De baixa', 'Robat',
    ])
  })

  it('compta com a avariat el que s’ha d’arreglar', () => {
    expect(esAvariat('Avariat')).toBe(true)
    expect(esAvariat('En reparació')).toBe(true)
  })

  it('no compta com a avariat cap altre estat', () => {
    for (const e of ['Actiu', 'En préstec', 'En proves', 'No desplegat', 'Retirat temporalment', 'De baixa', 'Robat'] as const) {
      expect(esAvariat(e)).toBe(false)
    }
  })
})
```

`src/modules/inventari/ubicacions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ubicacioCompleta, missatgeErrorUbicacio } from './ubicacions'
import type { Ubicacio } from './ubicacions'

const CATALEG: Ubicacio[] = [
  { id: '1', Codi: 'A21-ESO-2A', Edifici: 'A-EscC', Planta: 'PTA1' },
  { id: '2', Codi: 'Aula Portàtil', Edifici: '', Planta: '' },
  { id: '3', Codi: 'Biblioteca', Edifici: 'Principal', Planta: '' },
]

describe('ubicacioCompleta', () => {
  it('uneix codi, edifici i planta', () => {
    expect(ubicacioCompleta('A21-ESO-2A', CATALEG)).toBe('A21-ESO-2A · A-EscC · PTA1')
  })

  it('omet les parts buides', () => {
    expect(ubicacioCompleta('Aula Portàtil', CATALEG)).toBe('Aula Portàtil')
    expect(ubicacioCompleta('Biblioteca', CATALEG)).toBe('Biblioteca · Principal')
  })

  it('sense codi no hi ha ubicació', () => {
    expect(ubicacioCompleta('', CATALEG)).toBe('')
  })

  it('mostra tal qual un codi que no és al catàleg', () => {
    expect(ubicacioCompleta('Magatzem', CATALEG)).toBe('Magatzem')
  })
})

describe('missatgeErrorUbicacio', () => {
  it('explica per què no es pot esborrar una ubicació amb dispositius', () => {
    const err = new Error('Error eliminant registre de ubicacions: update or delete on table "ubicacions" violates foreign key constraint "inventari_ubicacio_fkey" on table "inventari"')
    expect(missatgeErrorUbicacio(err)).toBe('Aquesta ubicació encara té dispositius assignats. Canvia’ls d’ubicació abans d’esborrar-la.')
  })

  it('explica un codi repetit', () => {
    const err = new Error('Error afegint registre a ubicacions: duplicate key value violates unique constraint "ubicacions_codi_key"')
    expect(missatgeErrorUbicacio(err)).toBe('Ja hi ha una ubicació amb aquest codi.')
  })

  it('deixa passar qualsevol altre error tal com és', () => {
    expect(missatgeErrorUbicacio(new Error('Sense connexió'))).toBe('Sense connexió')
  })
})
```

- [ ] **Step 2: Comprova que fallen**

Run: `npx vitest run src/modules/inventari/`
Expected: FAIL. `Failed to resolve import "./estats"`.

- [ ] **Step 3: Escriu els dos mòduls**

`src/modules/inventari/estats.ts`:

```ts
// Els nou estats d'un dispositiu. Són fixos i no una llista de Configuració:
// el Dashboard i les etiquetes de color en depenen, i la base de dades
// (inventari_estat_check) admet exactament aquests.
export const ESTATS_INVENTARI = [
  'Actiu', 'Avariat', 'En reparació', 'En préstec', 'En proves',
  'No desplegat', 'Retirat temporalment', 'De baixa', 'Robat',
] as const

export type EstatInventari = typeof ESTATS_INVENTARI[number]

// El que compta la targeta del Dashboard: tot el que necessita que algú hi
// faci alguna cosa per tornar a funcionar.
export function esAvariat(estat: EstatInventari): boolean {
  return estat === 'Avariat' || estat === 'En reparació'
}
```

`src/modules/inventari/ubicacions.ts`:

```ts
export interface Ubicacio {
  id: string
  Codi: string
  Edifici: string
  Planta: string
}

// `A21-ESO-2A · A-EscC · PTA1`, sense les parts buides. Un codi que no és al
// catàleg es mostra tal qual: millor veure'l que amagar-lo.
export function ubicacioCompleta(codi: string, ubicacions: Ubicacio[]): string {
  if (!codi) return ''
  const u = ubicacions.find((x) => x.Codi === codi)
  return [codi, u?.Edifici ?? '', u?.Planta ?? ''].filter((p) => p.trim() !== '').join(' · ')
}

// Els dos errors que pot donar el catàleg arriben amb el text de Postgres,
// que no el sabria llegir ningú.
export function missatgeErrorUbicacio(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('foreign key')) {
    return 'Aquesta ubicació encara té dispositius assignats. Canvia’ls d’ubicació abans d’esborrar-la.'
  }
  if (msg.includes('duplicate key')) return 'Ja hi ha una ubicació amb aquest codi.'
  return msg
}
```

- [ ] **Step 4: Comprova que passen**

Run: `npx vitest run src/modules/inventari/`
Expected: PASS, 10 proves en 2 fitxers.

- [ ] **Step 5: Mutació de control**

1. A `estats.ts`, canvia `estat === 'En reparació'` per `estat === 'En préstec'`.
2. Torna a córrer. Han de fallar les dues proves de `esAvariat`.
3. Desfés el canvi.

- [ ] **Step 6: Commit**

```bash
git add src/modules/inventari/estats.ts src/modules/inventari/estats.test.ts src/modules/inventari/ubicacions.ts src/modules/inventari/ubicacions.test.ts
git commit -m "feat(inventari): estats i ubicacions com a mòduls purs, amb proves

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: El model de dades al client i els seus consumidors

**Files:**
- Modify: `src/modules/inventari/types.ts`
- Modify: `src/modules/inventari/useInventari.ts`
- Create: `src/modules/inventari/useUbicacions.ts`
- Modify: `src/components/Badge.tsx`
- Modify: `src/modules/dashboard/DashboardPage.tsx`
- Modify: `src/store/configStore.ts`
- Modify: `src/modules/inventari/InventariPage.tsx` (només treure el *mock*)
- Modify: `src/modules/inventari/InventariForm.tsx` (només el que cal perquè compili)

**Interfaces:**
- Consumes (Task 2): `ESTATS_INVENTARI`, `EstatInventari` i `esAvariat` d'`./estats`; `Ubicacio` d'`./ubicacions`.
- Produces:
  - `ItemInventari` amb els camps nous `Accio: string` i `SistemaOperatiu: string`. `Ubicació` és `''` quan la base de dades hi té `null`.
  - `useUbicacions()` retorna `{ ubicacions: Ubicacio[], loading, error, crear(d: Omit<Ubicacio,'id'>), editar(u: Ubicacio, d: Omit<Ubicacio,'id'>), eliminar(u: Ubicacio), refetch }`.
  - Les claus de configuració `inventari.accions` i `inventari.sistemes-operatius`, amb valor per defecte.

**Context que et cal:**

- **Canviar `ItemInventari` obliga a tocar tots els llocs que en construeixen un, o `npm run typecheck` falla.** Aquests llocs són:
  - el *mock* d'`InventariPage.tsx`, línies 8-52. Fora: el *wrapper* sempre passa `items`, i el comentari ja diu que era temporal;
  - l'estat inicial d'`InventariForm.tsx`;
  - `ESTAT_ACTIVE` del mateix formulari. És un `Record<EstatInventari, string>`, així que ara ha de tenir les 9 claus.
- **La resta del formulari, la fitxa i la pàgina es fan a les Tasks 4 i 5. Aquí no s'hi toca res més.**
- **El patró del *hook* és el de `useInventari.ts`**, inclòs el comentari i l'`eslint-disable` de l'`useEffect`.
- **`getAll(table, 'codi')` ordena per codi.**
- **`'Punt d’accés'` porta l'apòstrof tipogràfic**: dins de cometes simples, un de recte tancaria la cadena.

- [ ] **Step 1: `types.ts`**

Substitueix el fitxer sencer per:

```ts
import type { EstatInventari } from './estats'

export type { EstatInventari }

// Llista editable des de Configuració (clau 'inventari.categories'), no un
// conjunt fix — per això és `string` i no un union de literals.
export type CategoriaInventari = string

export interface ItemInventari {
  id: string
  ID: string               // INV-001, INV-002...
  Nom: string
  Categoria: CategoriaInventari
  Marca: string
  Model: string
  'Núm_sèrie': string
  Ubicació: string         // codi del catàleg d'ubicacions; '' si no en té
  Estat: EstatInventari
  Accio: string            // acció pendent; '' si no n'hi ha cap
  SistemaOperatiu: string
  'Data_compra': string    // ISO date
  'Garantia_fins': string  // ISO date
  MAC_LAN: string
  MAC_WAN: string
  IP_LAN: string
  IP_WAN: string
  Notes: string
}

export type ItemInventariFormData = Omit<ItemInventari, 'id' | 'ID'>
```

- [ ] **Step 2: `useInventari.ts`**

**A la interfície `InventariRow`**, substitueix `ubicacio: string` per:

```ts
  ubicacio: string | null
```

i, just després de `estat: string`, afegeix:

```ts
  accio: string
  sistema_operatiu: string
```

**A `rowToItem`**, substitueix `Ubicació: row.ubicacio,` per `Ubicació: row.ubicacio ?? '',` i, després de la línia d'`Estat`, afegeix:

```ts
    Accio: row.accio,
    SistemaOperatiu: row.sistema_operatiu,
```

**A `formToInsert`**:
- substitueix `ubicacio: data.Ubicació, estat: data.Estat,` per:

  ```ts
    ubicacio: data.Ubicació || null, estat: data.Estat,
    accio: data.Accio, sistema_operatiu: data.SistemaOperatiu,
  ```

- **El `|| null` és obligatori**: una cadena buida violaria la clau forana.

**A `editarUbicacio`**, substitueix `{ ubicacio }` per `{ ubicacio: ubicacio || null }`.

- [ ] **Step 3: `useUbicacions.ts`**

```ts
import { useCallback, useEffect, useState } from 'react'
import { getAll, insertRow, updateRowById, deleteRowById } from '../../services/db'
import type { Ubicacio } from './ubicacions'

const TABLE = 'ubicacions'

interface UbicacioRow {
  id: string
  codi: string
  edifici: string
  planta: string
}

function rowToUbicacio(row: UbicacioRow): Ubicacio {
  return { id: row.id, Codi: row.codi, Edifici: row.edifici, Planta: row.planta }
}

function dadesToRow(d: Omit<Ubicacio, 'id'>): Record<string, unknown> {
  return { codi: d.Codi.trim(), edifici: d.Edifici.trim(), planta: d.Planta.trim() }
}

export function useUbicacions() {
  const [ubicacions, setUbicacions] = useState<Ubicacio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await getAll<UbicacioRow>(TABLE, 'codi')
      setUbicacions(rows.map(rowToUbicacio))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [])

  // External fetch: synchronous loading state prevents stale content during refresh.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData() }, [fetchData])

  async function crear(d: Omit<Ubicacio, 'id'>): Promise<void> {
    await insertRow(TABLE, dadesToRow(d))
    await fetchData()
  }

  async function editar(u: Ubicacio, d: Omit<Ubicacio, 'id'>): Promise<void> {
    await updateRowById(TABLE, u.id, dadesToRow(d))
    await fetchData()
  }

  async function eliminar(u: Ubicacio): Promise<void> {
    await deleteRowById(TABLE, u.id)
    await fetchData()
  }

  return { ubicacions, loading, error, crear, editar, eliminar, refetch: fetchData }
}
```

- [ ] **Step 4: `Badge.tsx`**

Substitueix el bloc `'inventari-estat': { … }` per:

```ts
  'inventari-estat': {
    'Actiu':                'bg-green-100 text-green-700',
    'Avariat':              'bg-orange-100 text-orange-700',
    'En reparació':         'bg-yellow-100 text-yellow-700',
    'En préstec':           'bg-blue-100 text-blue-700',
    'En proves':            'bg-violet-100 text-violet-700',
    'No desplegat':         'bg-gray-100 text-gray-600',
    'Retirat temporalment': 'bg-slate-100 text-slate-600',
    'De baixa':             'bg-red-100 text-red-700',
    'Robat':                'bg-red-200 text-red-800',
  },
```

- [ ] **Step 5: `DashboardPage.tsx`**

- Afegeix l'import, al costat del de `useInventari`:

  ```ts
  import { esAvariat } from '../inventari/estats'
  ```

- Substitueix `const invEnReparacio = inventari.filter((i) => i.Estat === 'En reparació')` per:

  ```ts
      const invEnReparacio = inventari.filter((i) => esAvariat(i.Estat))
  ```

- Al `KpiCard` que fa servir `stats.invEnReparacio`, substitueix `label="En reparació"` per `label="Avariats o en reparació"`.

- [ ] **Step 6: `configStore.ts`**

Substitueix l'entrada `'inventari.categories': [ … ],` de `CONFIG_DEFAULTS` per:

```ts
  // Els tipus del full CET (pestanya Barems), en català. «Altre» al final
  // conserva l'opció de text lliure que fa servir el formulari.
  'inventari.categories': [
    'Alarma', 'Altaveus', 'Altaveus Bluetooth', 'Càmera de seguretat', 'Impressora', 'Mòbil',
    'NAS', 'PC', 'Pissarra digital', 'Portàtil', 'Projector', 'Punt d’accés', 'Ràdio CD',
    'Router', 'Servidor', 'Switch', 'Switch gestionable', 'Tauleta', 'Televisió',
    'Videogravador', 'Webcam', 'Altre',
  ],
  'inventari.accions': ['Reparar', 'Registrar', 'Retirar', 'Revisar', 'Substituir'],
  'inventari.sistemes-operatius': [
    'Android OS', 'ChromeOS', 'DSM (Synology)', 'Linux', 'Windows 7', 'Windows 8',
    'Windows 11', 'Windows Vista', 'Windows X', 'Windows X Pro Education',
  ],
```

- [ ] **Step 7: Treu el *mock* d'`InventariPage.tsx`**

- Esborra el comentari `// ── Mock temporal …` i la constant `MOCK` sencera (línies 8-52).
- A la desestructuració de les *props*, substitueix `items = MOCK,` per `items = [],`.

- [ ] **Step 8: Fes compilar `InventariForm.tsx`**

**A l'estat inicial del `useState<ItemInventariFormData>`**, després de `Estat: inicial?.Estat ?? 'Actiu',`, afegeix:

```ts
    Accio: inicial?.Accio ?? '',
    SistemaOperatiu: inicial?.SistemaOperatiu ?? '',
```

**Substitueix la constant `ESTAT_ACTIVE`** del final del fitxer per:

```ts
const ESTAT_ACTIVE: Record<EstatInventari, string> = {
  'Actiu':                'bg-green-50 border-green-400 text-green-700',
  'Avariat':              'bg-orange-50 border-orange-400 text-orange-700',
  'En reparació':         'bg-yellow-50 border-yellow-400 text-yellow-700',
  'En préstec':           'bg-blue-50 border-blue-400 text-blue-700',
  'En proves':            'bg-violet-50 border-violet-400 text-violet-700',
  'No desplegat':         'bg-gray-50 border-gray-400 text-gray-600',
  'Retirat temporalment': 'bg-slate-50 border-slate-400 text-slate-600',
  'De baixa':             'bg-red-50 border-red-400 text-red-700',
  'Robat':                'bg-red-100 border-red-500 text-red-800',
}
```

- [ ] **Step 9: Portes**

Run: `npm run typecheck && npm run lint && npm test`
Expected: tot net. `npm test` ha d'incloure les 10 proves noves de la Task 2.

- [ ] **Step 10: Commit**

```bash
git add src/modules/inventari/types.ts src/modules/inventari/useInventari.ts src/modules/inventari/useUbicacions.ts src/components/Badge.tsx src/modules/dashboard/DashboardPage.tsx src/store/configStore.ts src/modules/inventari/InventariPage.tsx src/modules/inventari/InventariForm.tsx
git commit -m "feat(inventari): camps nous al client, catàleg d'ubicacions i nou estats al Dashboard i les etiquetes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: El formulari, la fitxa i el *wrapper*

**Files:**
- Modify: `src/modules/inventari/InventariForm.tsx`
- Modify: `src/modules/inventari/InventariDetall.tsx`
- Modify: `src/app/routes/InventariWrapper.tsx`

**Interfaces:**
- Consumes:
  - de la Task 2: `ESTATS_INVENTARI`; `Ubicacio`; `ubicacioCompleta`;
  - de la Task 3: `useUbicacions`; els camps `Accio` i `SistemaOperatiu`; les claus `inventari.accions` i `inventari.sistemes-operatius`.
- Produces:
  - `InventariForm` i `InventariDetall` reben una *prop* nova obligatòria, `ubicacions: Ubicacio[]`;
  - `InventariPage` rep `ubicacions?: Ubicacio[]`, que es fa servir a la Task 5.

**Context que et cal:**

- **Marca, Model i Ubicació deixen de ser obligatoris.** Els dispositius importats del full no sempre en tenen. Si continuessin sent obligatoris, el coordinador no podria desar cap canvi en molts d'ells.
- **Valors fora de la llista:** si l'acció o el sistema operatiu d'un dispositiu ja no és a la llista (perquè algú l'ha tret a Configuració), el desplegable l'ha de continuar mostrant. Si no, desar el formulari l'esborraria sense voler.

- [ ] **Step 1: `InventariForm.tsx` — imports i *props***

**Substitueix les línies 3-5** (l'import de tipus, el de `useConfigStore` i la constant `ESTATS`) per:

```ts
import type { ItemInventariFormData } from './types'
import type { EstatInventari } from './estats'
import type { Ubicacio } from './ubicacions'
import { ESTATS_INVENTARI } from './estats'
import { ubicacioCompleta } from './ubicacions'
import { useConfigStore } from '../../store/configStore'
```

**A `interface Props`**, afegeix:

```ts
  ubicacions: Ubicacio[]
```

**Substitueix la signatura del component** per:

```ts
export function InventariForm({ onClose, onGuardar, inicial, ubicacions }: Props) {
  const categories = useConfigStore((s) => s.getValues('inventari.categories'))
  const accions = useConfigStore((s) => s.getValues('inventari.accions'))
  const sistemes = useConfigStore((s) => s.getValues('inventari.sistemes-operatius'))
```

En lloc de la línia `const categories = …` que ja hi havia.

- [ ] **Step 2: `InventariForm.tsx` — validació**

A `validate()`, esborra aquestes tres línies:

```ts
    if (!form.Marca.trim()) e.Marca = 'La marca és obligatòria.'
    if (!form.Model.trim()) e.Model = 'El model és obligatori.'
    if (!form.Ubicació.trim()) e.Ubicació = "La ubicació és obligatòria."
```

Canvia també les etiquetes: `label="Marca *"` passa a `label="Marca"`, i `label="Model *"` passa a `label="Model"`.

- [ ] **Step 3: `InventariForm.tsx` — Ubicació del catàleg**

Substitueix el `FormField` d'Ubicació (el que té `label="Ubicació *"` i l'`<input type="text">`) per:

```tsx
            <FormField label="Ubicació">
              <select
                value={form.Ubicació}
                onChange={(e) => setField('Ubicació', e.target.value)}
                className={cls(false)}
              >
                <option value="">Sense ubicació</option>
                {ubicacions.map((u) => (
                  <option key={u.id} value={u.Codi}>{ubicacioCompleta(u.Codi, ubicacions)}</option>
                ))}
              </select>
            </FormField>
```

- [ ] **Step 4: `InventariForm.tsx` — estats, acció i sistema operatiu**

**Al bloc de l'Estat**, substitueix `{ESTATS.map((e) => (` per `{ESTATS_INVENTARI.map((e) => (`.

**Just després del `FormField` de l'Estat** (i abans del bloc `{/* Dates */}`), afegeix:

```tsx
          {/* Acció pendent + Sistema operatiu */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Acció pendent">
              <select
                value={form.Accio}
                onChange={(e) => setField('Accio', e.target.value)}
                className={cls(false)}
              >
                <option value="">Cap</option>
                {form.Accio && !accions.includes(form.Accio) && <option value={form.Accio}>{form.Accio}</option>}
                {accions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </FormField>
            <FormField label="Sistema operatiu">
              <select
                value={form.SistemaOperatiu}
                onChange={(e) => setField('SistemaOperatiu', e.target.value)}
                className={cls(false)}
              >
                <option value="">—</option>
                {form.SistemaOperatiu && !sistemes.includes(form.SistemaOperatiu) && (
                  <option value={form.SistemaOperatiu}>{form.SistemaOperatiu}</option>
                )}
                {sistemes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
          </div>
```

**El tipus `EstatInventari`** es continua fent servir a `ESTAT_ACTIVE`. Mantén-ne l'`import type`.

- [ ] **Step 5: `InventariDetall.tsx`**

**Substitueix les línies 2-10** (imports i constant `ESTATS`) per:

```ts
import {
  X, Package, Calendar, MapPin, Hash, Cpu, Wifi, Monitor, Wrench,
  ChevronDown, CheckCircle, Loader2, Pencil, MessageSquare, Trash2,
} from 'lucide-react'
import { Badge } from '../../components/Badge'
import { formatDate, garantiaEstat } from './inventari.utils'
import type { ItemInventari, EstatInventari } from './types'
import type { Ubicacio } from './ubicacions'
import { ESTATS_INVENTARI } from './estats'
import { ubicacioCompleta } from './ubicacions'
```

**Props:** a `interface Props`, afegeix `ubicacions: Ubicacio[]`, i afegeix `ubicacions,` a la desestructuració de la signatura.

**Llista d'estats:** substitueix `{ESTATS.map((e) => (` per `{ESTATS_INVENTARI.map((e) => (`.

**Acció pendent:** just abans del `</section>` que tanca la secció d'Estat (és a dir, dins la secció i després del `</div>` del desplegable), afegeix:

```tsx
            {item.Accio && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                <Wrench size={12} /> Acció pendent: {item.Accio}
              </p>
            )}
```

**Sistema operatiu:** a la secció Identificació, després de la fila de `Núm. sèrie`, afegeix:

```tsx
            {item.SistemaOperatiu && (
              <InfoRow icon={<Monitor size={14} />} label="Sistema operatiu" value={item.SistemaOperatiu} />
            )}
```

**Edició de la ubicació:** a la secció Ubicació, substitueix l'`<input type="text" … placeholder="Ex: Aula 55" … />` de l'edició per:

```tsx
                  <select
                    value={ubicacioDraft}
                    onChange={(e) => setUbicacioDraft(e.target.value)}
                    className="input text-sm flex-1"
                    autoFocus
                  >
                    <option value="">Sense ubicació</option>
                    {ubicacions.map((u) => (
                      <option key={u.id} value={u.Codi}>{ubicacioCompleta(u.Codi, ubicacions)}</option>
                    ))}
                  </select>
```

**Visualització de la ubicació:** a la mateixa secció, hi ha dos llocs on es mostra `{item.Ubicació || …}`: el botó del coordinador i el paràgraf de només lectura. Als dos, substitueix `item.Ubicació` per `ubicacioCompleta(item.Ubicació, ubicacions)`. El text alternatiu (`Sense ubicació…`) es queda igual.

- [ ] **Step 6: `InventariWrapper.tsx`**

- Afegeix l'import:

  ```ts
  import { useUbicacions } from '../../modules/inventari/useUbicacions'
  ```

- Després de la línia de `useInventari()`, afegeix:

  ```ts
    const { ubicacions } = useUbicacions()
  ```

- Passa `ubicacions={ubicacions}` als tres components: `<InventariPage …>`, `<InventariForm …>` i `<InventariDetall …>`.
- A `InventariPage.tsx`, afegeix la *prop* opcional i fes-la servir a la cel·la d'Ubicació de la taula:
  - Imports, al costat dels altres:

    ```ts
    import type { Ubicacio } from './ubicacions'
    import { ubicacioCompleta } from './ubicacions'
    ```

  - A `interface Props`: `ubicacions?: Ubicacio[]`.
  - A la desestructuració: `ubicacions = [],`.
  - A la taula, substitueix `{item.Ubicació || '—'}` per `{ubicacioCompleta(item.Ubicació, ubicacions) || '—'}`.

- [ ] **Step 7: Portes**

Run: `npm run typecheck && npm run lint && npm test`
Expected: tot net.

- [ ] **Step 8: Commit**

```bash
git add src/modules/inventari/InventariForm.tsx src/modules/inventari/InventariDetall.tsx src/app/routes/InventariWrapper.tsx src/modules/inventari/InventariPage.tsx
git commit -m "feat(inventari): ubicació del catàleg, nou estats, acció pendent i sistema operatiu al formulari i la fitxa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: El llistat — filtres i comptadors

**Files:**
- Modify: `src/modules/inventari/InventariPage.tsx`

**Interfaces:**
- Consumes:
  - de la Task 2: `ESTATS_INVENTARI`, `EstatInventari`, `esAvariat`, `ubicacioCompleta`;
  - de la Task 3: la clau `inventari.accions`;
  - de la Task 4: la *prop* `ubicacions`.
- Produces: res que facin servir altres tasques.

- [ ] **Step 1: Imports i estats**

- **Substitueix l'import de tipus de la línia 5** per:

  ```ts
  import type { ItemInventari, CategoriaInventari } from './types'
  import type { EstatInventari } from './estats'
  import { ESTATS_INVENTARI, esAvariat } from './estats'
  ```

  Conserva els dos imports d'`./ubicacions` que hi va posar la Task 4 (`Ubicacio` i `ubicacioCompleta`).

- Esborra la constant `const ESTATS: Array<EstatInventari | ''> = …`.

- Dins del component, després de `const categories = …`, afegeix:

  ```ts
    const accions = useConfigStore((s) => s.getValues('inventari.accions'))
    const [filtreUbicacio, setFiltreUbicacio] = useState('')
    // '' = totes; 'qualsevol' = només les que tenen alguna acció pendent.
    const [filtreAccio, setFiltreAccio] = useState('')
  ```

- [ ] **Step 2: Filtre i comptadors**

**Al `useMemo` de `filtrats`:**
- just després de la línia de `filtreCategoria`, afegeix:

  ```ts
          if (filtreUbicacio && item.Ubicació !== filtreUbicacio) return false
          if (filtreAccio === 'qualsevol' && !item.Accio) return false
          if (filtreAccio && filtreAccio !== 'qualsevol' && item.Accio !== filtreAccio) return false
  ```

- a la cadena de cerca `h`, afegeix `${item.SistemaOperatiu} ${item.Accio}` al final;
- a les dependències del `useMemo`, afegeix `filtreUbicacio, filtreAccio`.

**A `comptadors`**, substitueix la línia de `reparacio` per:

```ts
    reparacio: items.filter((i) => esAvariat(i.Estat)).length,
```

**Als KPIs**, substitueix `label: 'En reparació'` per `label: 'Avariats o en reparació'`.

- [ ] **Step 3: Filtres a la pantalla i cel·la d'Ubicació**

**Al `<select>` de filtre d'estat**, substitueix `{ESTATS.slice(1).map((e) => <option key={e}>{e}</option>)}` per:

```tsx
            {ESTATS_INVENTARI.map((e) => <option key={e}>{e}</option>)}
```

**Després del `<select>` de categories**, afegeix:

```tsx
          <select
            value={filtreUbicacio}
            onChange={(e) => setFiltreUbicacio(e.target.value)}
            className="input text-sm w-44"
            aria-label="Filtra per ubicació"
          >
            <option value="">Totes les ubicacions</option>
            {ubicacions.map((u) => <option key={u.id} value={u.Codi}>{u.Codi}</option>)}
          </select>
          <select
            value={filtreAccio}
            onChange={(e) => setFiltreAccio(e.target.value)}
            className="input text-sm w-44"
            aria-label="Filtra per acció pendent"
          >
            <option value="">Totes les accions</option>
            <option value="qualsevol">Amb alguna acció pendent</option>
            {accions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
```

**A la taula** (la cel·la d'Ubicació ja la va canviar la Task 4), a la cel·la del Nom, després del `<p>` de categoria per a mòbil, afegeix:

  ```tsx
                      {item.Accio && <p className="text-xs text-amber-700 mt-0.5">Acció pendent: {item.Accio}</p>}
  ```

**Al `<select>` de filtre d'estat**, el `onChange` continua fent `setFiltreEstat(e.target.value as EstatInventari | '')`. Mantén l'`import type { EstatInventari }`.

- [ ] **Step 4: Portes**

Run: `npm run typecheck && npm run lint && npm test`
Expected: tot net.

- [ ] **Step 5: Commit**

```bash
git add src/modules/inventari/InventariPage.tsx
git commit -m "feat(inventari): filtres per ubicació i per acció pendent al llistat

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Configuració → Inventari

**Files:**
- Create: `src/modules/inventari/UbicacionsEditor.tsx`
- Modify: `src/modules/configuracio/ConfiguracioPage.tsx`

**Interfaces:**
- Consumes:
  - de la Task 2: `Ubicacio`, `missatgeErrorUbicacio`;
  - de la Task 3: `useUbicacions`, les claus `inventari.accions` i `inventari.sistemes-operatius`.
- Produces: `export function UbicacionsEditor(): JSX.Element`.

**Context que et cal:**

- **Com es pinten les categories per mòdul de Configuració:**
  - surten de la constant `GRUPS` (línies ~18-95), amb el tipus `GrupConfig { modul, color, llistes }`;
  - un bucle (`GRUPS.forEach`, cap a la línia 1123) pinta un `LlistaEditor` per cada llista.
- **Per posar-hi l'editor d'ubicacions cal un camp opcional nou**, `extra`. Es pinta sota les llistes.
- **Text secundari**: `text-gray-500`, mai `text-gray-400`.

- [ ] **Step 1: `UbicacionsEditor.tsx`**

```tsx
import { useState } from 'react'
import { Plus, Trash2, Loader2, Pencil, Check, X } from 'lucide-react'
import { useUbicacions } from './useUbicacions'
import { missatgeErrorUbicacio } from './ubicacions'
import type { Ubicacio } from './ubicacions'

type Dades = Omit<Ubicacio, 'id'>
const BUIT: Dades = { Codi: '', Edifici: '', Planta: '' }
const CAMPS = ['Codi', 'Edifici', 'Planta'] as const
const EXEMPLE: Record<typeof CAMPS[number], string> = { Codi: 'Ex: A21-ESO-2A', Edifici: 'Ex: A-EscC', Planta: 'Ex: PTA1' }

export function UbicacionsEditor() {
  const { ubicacions, loading, error, crear, editar, eliminar } = useUbicacions()
  const [nova, setNova] = useState<Dades>(BUIT)
  const [editantId, setEditantId] = useState<string | null>(null)
  const [esborrany, setEsborrany] = useState<Dades>(BUIT)
  const [ocupat, setOcupat] = useState<string | null>(null)
  const [errorAccio, setErrorAccio] = useState<string | null>(null)

  async function fes(clau: string, accio: () => Promise<void>) {
    setOcupat(clau)
    setErrorAccio(null)
    try {
      await accio()
    } catch (err) {
      setErrorAccio(missatgeErrorUbicacio(err))
    } finally {
      setOcupat(null)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-sm font-semibold text-text-main">Ubicacions</p>
      <p className="text-xs text-gray-500 mt-0.5 mb-3 leading-relaxed">
        Catàleg d’aules i espais. En triar-ne una per a un dispositiu, l’edifici i la planta surten d’aquí; si en canvies el codi, el canvi arriba a tots els seus dispositius.
      </p>

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-gray-500"><Loader2 size={12} className="animate-spin" /> Carregant…</p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-1.5 pr-2 font-medium">Codi</th>
                <th className="py-1.5 pr-2 font-medium">Edifici</th>
                <th className="py-1.5 pr-2 font-medium">Planta</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ubicacions.map((u) => editantId === u.id ? (
                <tr key={u.id}>
                  {CAMPS.map((camp) => (
                    <td key={camp} className="py-1.5 pr-2">
                      <input
                        className="input text-sm w-full"
                        value={esborrany[camp]}
                        aria-label={camp}
                        onChange={(e) => setEsborrany((d) => ({ ...d, [camp]: e.target.value }))}
                      />
                    </td>
                  ))}
                  <td className="py-1.5 whitespace-nowrap text-right">
                    <button
                      type="button"
                      aria-label="Desa"
                      disabled={ocupat === u.id || !esborrany.Codi.trim()}
                      onClick={() => fes(u.id, async () => { await editar(u, esborrany); setEditantId(null) })}
                      className="p-1 text-green-700 disabled:opacity-40"
                    >
                      {ocupat === u.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button type="button" aria-label="Cancel·la" onClick={() => setEditantId(null)} className="p-1 text-gray-500">
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={u.id}>
                  <td className="py-1.5 pr-2 font-mono text-xs text-text-main">{u.Codi}</td>
                  <td className="py-1.5 pr-2 text-gray-600">{u.Edifici || '—'}</td>
                  <td className="py-1.5 pr-2 text-gray-600">{u.Planta || '—'}</td>
                  <td className="py-1.5 whitespace-nowrap text-right">
                    <button
                      type="button"
                      aria-label={`Edita ${u.Codi}`}
                      onClick={() => { setEditantId(u.id); setEsborrany({ Codi: u.Codi, Edifici: u.Edifici, Planta: u.Planta }) }}
                      className="p-1 text-gray-500 hover:text-primary"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Esborra ${u.Codi}`}
                      disabled={ocupat === u.id}
                      onClick={() => fes(u.id, () => eliminar(u))}
                      className="p-1 text-gray-500 hover:text-red-600 disabled:opacity-40"
                    >
                      {ocupat === u.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                {CAMPS.map((camp) => (
                  <td key={camp} className="pt-3 pr-2">
                    <input
                      className="input text-sm w-full"
                      value={nova[camp]}
                      placeholder={EXEMPLE[camp]}
                      aria-label={`${camp} de la nova ubicació`}
                      onChange={(e) => setNova((d) => ({ ...d, [camp]: e.target.value }))}
                    />
                  </td>
                ))}
                <td className="pt-3 text-right">
                  <button
                    type="button"
                    aria-label="Afegeix la ubicació"
                    disabled={ocupat === 'nova' || !nova.Codi.trim()}
                    onClick={() => fes('nova', async () => { await crear(nova); setNova(BUIT) })}
                    className="p-1.5 text-white rounded-lg disabled:opacity-40"
                    style={{ backgroundColor: '#861414' }}
                  >
                    {ocupat === 'nova' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {errorAccio && <p className="mt-2 text-xs text-red-600">{errorAccio}</p>}
    </div>
  )
}
```

- [ ] **Step 2: `ConfiguracioPage.tsx`**

**Import**, al costat dels altres imports de mòduls:

```ts
import { UbicacionsEditor } from '../inventari/UbicacionsEditor'
```

**A `interface GrupConfig`**, afegeix:

```ts
  /** Contingut propi del mòdul que no és una llista, pintat sota les llistes. */
  extra?: React.ReactNode
```

**A `GRUPS`**, substitueix l'entrada d'Inventari sencera per:

```tsx
  {
    modul: 'Inventari',
    color: '#15803d',
    llistes: [
      { clau: 'inventari.categories', label: 'Tipus de dispositius', descripcio: 'Tipus de dispositius que es poden registrar a l\'inventari.' },
      { clau: 'inventari.accions', label: 'Accions pendents', descripcio: 'Què cal fer amb un dispositiu (reparar-lo, revisar-lo...). Apareix a la fitxa i es pot filtrar al llistat.' },
      { clau: 'inventari.sistemes-operatius', label: 'Sistemes operatius', descripcio: 'Opcions del desplegable de sistema operatiu de la fitxa d\'un dispositiu.' },
    ],
    extra: <UbicacionsEditor />,
  },
```

**Al bucle `GRUPS.forEach`**, dins del `contingut`, just després del `{grup.llistes.map(…)}`, afegeix:

```tsx
          {grup.extra}
```

- [ ] **Step 3: Portes**

Run: `npm run typecheck && npm run lint && npm test`
Expected: tot net.

- [ ] **Step 4: Commit**

```bash
git add src/modules/inventari/UbicacionsEditor.tsx src/modules/configuracio/ConfiguracioPage.tsx
git commit -m "feat(configuracio): llistes d'accions i sistemes operatius i editor d'ubicacions a Inventari

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: La guia d'Ajuda

**Files:**
- Modify: `src/pages/AjudaPage.tsx`

**Interfaces:** cap.

**Context que et cal:** l'apòstrof del text nou ha de ser el tipogràfic `’`.

- [ ] **Step 1: Secció d'Inventari**

**A la secció `mod-inventari`**, substitueix el `<li>` que comença per `Cercar per nom, marca, ubicació` per:

```tsx
          <li>Cercar per nom, marca, ubicació, número de sèrie o sistema operatiu, i filtrar per estat, categoria, ubicació o acció pendent.</li>
```

**Al `FieldList` de la mateixa secció**, substitueix les files `Núm. sèrie / Ubicació` i `Estat` per:

```tsx
          { term: 'Núm. sèrie / Ubicació', desc: 'La ubicació es tria del catàleg d’ubicacions; l’edifici i la planta surten sols.' },
          { term: 'Estat', desc: 'Actiu, Avariat, En reparació, En préstec, En proves, No desplegat, Retirat temporalment, De baixa o Robat.' },
          { term: 'Acció pendent', desc: 'El que cal fer amb el dispositiu (reparar-lo, revisar-lo...). Es destaca a la fitxa i al llistat.' },
          { term: 'Sistema operatiu', desc: 'De la llista que es configura a Configuració → Inventari.' },
```

- [ ] **Step 2: Dashboard i Configuració**

**A la secció `mod-dashboard`**, a la llista «Què hi trobaràs», substitueix `dispositius en reparació` per `dispositius avariats o en reparació`.

**A la taula de Configuració**, substitueix la fila `['Inventari', 'Els tipus de dispositius que es poden registrar.'],` per:

```tsx
                ['Inventari', 'Els tipus de dispositius, les accions pendents, els sistemes operatius i el catàleg d’ubicacions (codi, edifici i planta).'],
```

- [ ] **Step 3: Portes**

Run: `npm run typecheck && npm run lint`
Expected: net.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AjudaPage.tsx
git commit -m "docs(ajuda): l'inventari ampliat, els estats nous i el catàleg d'ubicacions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Després de fusionar (ho fa el controlador, no un subagent)

Aquests passos necessiten el connector de Supabase i els CSV, que són fora del repositori i contenen contrasenyes. Per això **no són una tasca de subagent**.

### A. Aplicar la migració a producció

- Aplica `202610050001_inventari_cet.sql` amb `apply_migration` del connector de Supabase, amb el nom `inventari_cet`.
  - Si el connector la rebutja (com fa amb els `DELETE`), dona el SQL a l'Andrés perquè l'executi al SQL Editor.
- Després, comprova-ho amb consultes. **Un «success» no n'és prova:**
  - `select to_regclass('public.ubicacions')` no és null;
  - el `CHECK` `inventari_estat_check` té els 9 estats;
  - la clau forana `inventari_ubicacio_fkey` existeix;
  - `accio` i `sistema_operatiu` existeixen a `information_schema.columns`.

### B. Importar el CET

1. **Desa l'script.** Copia el de sota a l'*scratchpad* (no al repositori) com a `importa_cet.py`.
2. **Executa'l** passant-li les contrasenyes del full per variable d'entorn. Les has de llegir tu mateix del CSV; **no les escriguis a cap fitxer**. L'script s'atura si en troba cap en el text que inseriria.

   ```sh
   CONTRASENYES='…,…' python3 importa_cet.py \
     "../CET (Control Equipamiento TIC) - Baremos.csv" \
     "../CET (Control Equipamiento TIC) - 🖥️ Dispositivos.csv" > importa.sql 2> discrepancies.txt
   ```

3. **Executa `importa.sql`** amb `execute_sql`. Són `INSERT`, i el connector els accepta.
4. **Comprova el resultat:**
   - 66 ubicacions;
   - 153 dispositius;
   - recompte per categoria: Tauleta 50, Pissarra digital 41, Portàtil 38, PC 14, Projector 9, Altaveus 1;
   - recompte per estat: Actiu 136, De baixa 12, No desplegat 3, Avariat 1, Robat 1;
   - `select count(*) from public.inventari where notes ~* '(pass|pas:|clau|codigo|patron)'` ha de donar 0.
5. **Envia a l'Andrés la llista de `discrepancies.txt`**: els dispositius on el full deia un edifici o una planta diferents dels del catàleg.

```python
#!/usr/bin/env python3
# Importació única del full CET a SJO Hub. Genera SQL per stdout; les
# discrepàncies d'ubicació van per stderr. Les contrasenyes que no han de
# quedar enlloc arriben per la variable CONTRASENYES, separades per comes.
import csv, json, os, re, sys

TIPUS = {
    'Alarma': 'Alarma', 'Altavoces': 'Altaveus', 'Altavoces BT': 'Altaveus Bluetooth',
    'Cámara seg.': 'Càmera de seguretat', 'Impresora': 'Impressora', 'Móvil': 'Mòbil', 'NAS': 'NAS',
    'PC': 'PC', 'Pizarra Digital': 'Pissarra digital', 'Portátil': 'Portàtil', 'Proyector': 'Projector',
    'Punto acceso': 'Punt d’accés', 'Radio CD': 'Ràdio CD', 'Router': 'Router', 'Servidor': 'Servidor',
    'Switch': 'Switch', 'Switch gest.': 'Switch gestionable', 'Tableta': 'Tauleta',
    'Televisión': 'Televisió', 'Videograbador': 'Videogravador', 'Webcam': 'Webcam',
}
ESTATS = {'Activo': 'Actiu', 'Averiado': 'Avariat', 'En pruebas': 'En proves', 'No desplegado': 'No desplegat',
          'Retirado': 'De baixa', 'Retirado temp.': 'Retirat temporalment', 'Robado': 'Robat'}
ACCIONS = {'Reparar': 'Reparar', 'Registrar': 'Registrar', 'Retirar': 'Retirar', 'Revisar': 'Revisar',
           'Sustituir': 'Substituir', '-': '', '': ''}
MARQUES = {'acer': 'Acer', 'hp': 'HP', 'lenovo': 'Lenovo', 'asus': 'Asus', 'epson': 'Epson'}
CATEGORIES = list(TIPUS.values()) + ['Altre']
ACCIONS_LLISTA = ['Reparar', 'Registrar', 'Retirar', 'Revisar', 'Substituir']
SISTEMES = ['Android OS', 'ChromeOS', 'DSM (Synology)', 'Linux', 'Windows 7', 'Windows 8',
            'Windows 11', 'Windows Vista', 'Windows X', 'Windows X Pro Education']
SECRETS = [re.compile(p, re.I) for p in (
    r'\b(admin(istrador|strador)?|pas|pass)\s*(pass)?\s*:\s*\S+',
    r'--\s*\d+\s*clau\b',
    r'\bcodigo\s*:\s*\d+',
    r'\bpatron\b.*$',
)]
MAC = re.compile(r'^([0-9A-F]{2}:){5}[0-9A-F]{2}$')
IP = re.compile(r'^(\d{1,3}\.){3}\d{1,3}$')

def neteja(text):
    linies = []
    for l in text.replace('\r', '').split('\n'):
        for p in SECRETS:
            l = p.sub('', l)
        l = re.sub(r'\s{2,}', ' ', l).strip(' ,')
        if l:
            linies.append(l)
    return '\n'.join(linies)

def normalitza_mac(v):
    v = re.sub(r'\s+', '', v).replace('-', ':').upper()
    return v if MAC.match(v) else None

def macs(raw):
    raw = raw.strip()
    if not raw:
        return '', '', []
    if not re.search(r'[WL]\s*:', raw):
        m = normalitza_mac(raw)
        return '', (m or ''), ([] if m else [raw])
    wifi = lan = ''
    invalides = []
    for clau, valor in re.findall(r'([WL])\s*:\s*([^WL]*)', raw):
        valor = valor.strip()
        if not valor:
            continue
        m = normalitza_mac(valor)
        if not m:
            invalides.append(f'{clau}: {valor}')
        elif clau == 'W':
            wifi = m
        else:
            lan = m
    return wifi, lan, invalides

def marca_model(descripcio, nom):
    primera = next((l for l in descripcio.split('\n') if l.strip()), '')
    for font in (primera, nom):
        paraules = font.split()
        if paraules and paraules[0].lower() in MARQUES:
            return MARQUES[paraules[0].lower()], ' '.join(paraules[1:]).split(',')[0].strip()
    return '', ''

def q(v):
    return 'null' if v is None else "'" + v.replace("'", "''") + "'"

def main(barems_csv, dispositius_csv):
    secrets = [s for s in os.environ.get('CONTRASENYES', '').split(',') if s]
    if not secrets:
        sys.exit('Cal la variable CONTRASENYES per comprovar que no se n’insereix cap.')

    barems = list(csv.reader(open(barems_csv, encoding='utf-8')))[1:]
    cataleg = {}
    for r in barems:
        if len(r) > 2 and r[2].strip():
            cataleg[r[2].strip()] = (r[0].strip(), r[1].strip())

    files = list(csv.reader(open(dispositius_csv, encoding='utf-8')))
    capcalera = [h.strip() for h in files[2]]
    c = {h: i for i, h in enumerate(capcalera) if h}
    dades = [r for r in files[3:] if any(x.strip() for x in r)]

    dispositius = []
    for r in dades:
        g = lambda col: r[c[col]].strip()
        tipus_es, estat_es = g('Tipo'), g('Estado')
        if tipus_es not in TIPUS or estat_es not in ESTATS:
            sys.exit(f'Valor desconegut: tipus={tipus_es!r} estat={estat_es!r}')
        tipus = TIPUS[tipus_es]
        classe = g('Classe')
        if classe and classe not in cataleg:
            sys.exit(f'Ubicació fora del catàleg: {classe!r}')
        if classe and g('Centro') and cataleg[classe] != (g('Centro'), g('Ubicación')):
            print(f'{g("Usuari / Nom Equip") or tipus} ({g("Referencia SNID") or "sense SNID"}): '
                  f'el full deia {g("Centro")} · {g("Ubicación")}, el catàleg diu '
                  f'{cataleg[classe][0]} · {cataleg[classe][1]} per a {classe}', file=sys.stderr)
        nom = g('Usuari / Nom Equip') or tipus
        descripcio = neteja(r[c['Descripción (Maj + F2 para insertar notas)']])
        marca, model = marca_model(descripcio, nom)
        wifi, lan, macs_dolentes = macs(r[c['MAC ADDRESS']])
        ip_raw = g('IP')
        ip = ip_raw if IP.match(ip_raw) else ''
        notes = [descripcio] if descripcio else []
        periferics = neteja(g('Periféricos'))
        if periferics:
            notes.append(f'Perifèrics: {periferics}')
        producte = neteja(g('id. productop'))
        if producte:
            notes.append(producte if ' ' in producte else f'ID producte: {producte}')
        notes += [f'MAC no vàlida ({m})' for m in macs_dolentes]
        if ip_raw and not ip:
            notes.append(f'IP no vàlida: {ip_raw}')
        d = dict(nom=nom, categoria=tipus, marca=marca, model=model, num_serie=g('Referencia SNID'),
                 ubicacio=classe or None, estat=ESTATS[estat_es], accio=ACCIONS.get(g('Acción'), ''),
                 sistema_operatiu=g('Sistema operativo'), mac_lan=lan, mac_wan=wifi, ip_lan=ip,
                 notes='\n'.join(notes))
        text = ' '.join(v for v in d.values() if v)
        if any(s in text for s in secrets):
            sys.exit(f'Queda una contrasenya al dispositiu {nom!r}: revisa SECRETS.')
        dispositius.append(d)

    print('begin;')
    print('insert into public.ubicacions(codi,edifici,planta) values')
    print(',\n'.join(f'({q(k)},{q(v[0])},{q(v[1])})' for k, v in cataleg.items()))
    print('on conflict (codi) do nothing;')
    for clau, valors in (('inventari.categories', CATEGORIES), ('inventari.accions', ACCIONS_LLISTA),
                         ('inventari.sistemes-operatius', SISTEMES)):
        print(f"insert into public.config(clau,valors) values ({q(clau)},{q(json.dumps(valors, ensure_ascii=False))}::jsonb) "
              'on conflict (clau) do update set valors = excluded.valors;')
    cols = ['nom', 'categoria', 'marca', 'model', 'num_serie', 'ubicacio', 'estat', 'accio',
            'sistema_operatiu', 'mac_lan', 'mac_wan', 'ip_lan', 'notes']
    print(f'insert into public.inventari({",".join(cols)}) values')
    print(',\n'.join('(' + ','.join(q(d[k]) for k in cols) + ')' for d in dispositius) + ';')
    print('commit;')
    print(f'-- {len(cataleg)} ubicacions, {len(dispositius)} dispositius', file=sys.stderr)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
```
