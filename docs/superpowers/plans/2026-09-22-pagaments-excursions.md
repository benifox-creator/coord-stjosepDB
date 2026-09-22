# Control de pagaments de les excursions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que es pugui apuntar quants alumnes de cada grup han pagat una excursió, perquè el panell econòmic tingui ingressos reals amb què treballar.

**Architecture:** Una columna a `excursio_grups` i una funció de servidor que n'és l'únic camí d'escriptura. El tancament no es fa amb una política —les de PostgreSQL són per fila, no per columna— sinó **retirant el permís d'escriptura d'aquella columna** i deixant que només la funció, que corre com a propietària, hi entri.

**Tech Stack:** PostgreSQL 17 (Supabase) · React 19 + TypeScript estricte · Zustand · Vitest + PGlite

**Spec:** `docs/superpowers/specs/2026-09-22-pagaments-excursions-design.md`

## Global Constraints

- **Cap dada d'alumnat.** Ni noms, ni números de llista, ni res per alumne: només un recompte per grup. És el que fa que aquesta entrega no toqui la nota de protecció de dades del dossier.
- `alumnes_pagats` **no es limita a `alumnes_previstos`**: un grup pot acabar amb més pagaments que previsions, i un límit dur convertiria una dada correcta en un error que no deixa desar.
- **No es guarda cap import.** Els diners recaptats es calculen: `sum(alumnes_pagats) × preu_alumne`.
- Qui pot apuntar: **qualsevol que vegi el mòdul** (`app_private.module_visible('excursions')` i `app_private.creator()`), sobre qualsevol grup. `usuaris` no sap qui és tutor de quin grup.
- Les migracions **no es toquen un cop aplicades a producció**; cada canvi és una migració nova. `supabase/schema.sql` **no es toca mai**.
- Textos de la interfície **en català**. Comentaris i missatges de commit, també, explicant **per què** i no què.
- TypeScript estricte: `verbatimModuleSyntax` (cal `import type`) i `noUnusedLocals`.

> **Avís que val per a tota la feina d'aquest mòdul.** Ja hi ha hagut dos forats del mateix tipus: la política d'`excursions` és **per fila** i concedeix `update` sencer, i el disparador surt d'hora quan l'estat no canvia. Si una regla ha de ser inviolable, no n'hi ha prou de posar-la dins d'una funció: cal tancar el camí directe. Aquí es tanca amb permisos per columna, que és el que el projecte ja fa amb `prestecs.notes`.

---

## Estructura de fitxers

| Fitxer | Responsabilitat |
|---|---|
| `supabase/migrations/202609230001_pagaments.sql` | La columna, els permisos per columna i `registra_pagaments` |
| `tests/database.test.ts` | Qui pot apuntar, qui no, i que l'únic camí sigui la funció (modificació) |
| `src/modules/excursions/types.ts` | `AlumnesPagats` a `ExcursioGrup` (modificació) |
| `src/modules/excursions/excursions.utils.ts` | La columna a `GrupRow` i al mapatge (modificació) |
| `src/modules/excursions/useExcursions.ts` | `registraPagaments(grupId, pagats)` (modificació) |
| `src/modules/excursions/pagaments.ts` | Què s'ha recaptat, funció pura |
| `src/modules/excursions/pagaments.test.ts` | Les seves proves |
| `src/modules/excursions/ExcursioDetall.tsx` | El camp per grup i el total (modificació) |

---

### Task 1: La columna i el seu únic camí d'escriptura

**Files:**
- Create: `supabase/migrations/202609230001_pagaments.sql`
- Modify: `tests/database.test.ts`

**Interfaces:**
- Produces: la columna `public.excursio_grups.alumnes_pagats integer not null default 0` i
  `public.registra_pagaments(p_grup uuid, p_pagats integer) returns void`.

**Com es tanca el camí directe.** Les polítiques RLS filtren files senceres, així que no poden dir «aquest pot tocar aquesta columna i aquella no». El que sí que es pot fer és **retirar el permís d'`update` sobre la taula i tornar-lo a concedir només sobre les columnes antigues**. Llavors un `update` directe sobre `alumnes_pagats` falla per permisos, i la funció —que és `security definer` i corre com la propietària— hi continua entrant. El projecte ja ho fa així a `prestecs`, on `authenticated` només pot actualitzar `notes`; hi ha una prova que ho vigila i que et servirà de model.

- [ ] **Step 1: Escriure les proves**

Al final de `tests/database.test.ts`. Mira els `describe` veïns i segueix-ne l'estil: `asUser(...)`, `reset role`, i un savepoint **abans** de cada sentència que hagi de fallar.

```ts
describe('apuntar els pagaments', () => {
  async function grupDUnaExcursio() {
    await asUser('admin@stjosep.org')
    const id = (await db.query<{id:string}>(`
      insert into public.excursions(etapa,lloc,activitat,data,hora_sortida,hora_tornada,transport)
      values('EP','Can Montcau','Visita','2026-11-18','09:00','13:00','autocar') returning id`)).rows[0].id
    return (await db.query<{id:string}>(`
      insert into public.excursio_grups(excursio_id,grup,alumnes_previstos)
      values($1,'EP-1 A',25) returning id`,[id])).rows[0].id
  }
  const pagats = async (grup: string) => Number((await db.query<{alumnes_pagats:number}>(
    'select alumnes_pagats from public.excursio_grups where id=$1',[grup])).rows[0].alumnes_pagats)

  it('comença a zero', async () => {
    expect(await pagats(await grupDUnaExcursio())).toBe(0)
  })

  it('un docent corrent pot apuntar-ne, encara que l’excursió no sigui seva', async () => {
    // Qui té els resguards a la mà és el tutor, i `usuaris` no sap de quin grup
    // és tutor cadascú. La porta és oberta a propòsit, i queda rastre.
    const grup = await grupDUnaExcursio()
    await asUser('teacher@stjosep.org')
    await db.query('select public.registra_pagaments($1,$2)',[grup,18])
    expect(await pagats(grup)).toBe(18)
  })

  it('però un docent corrent segueix sense poder tocar les previsions', async () => {
    // Obrir la porta als pagaments no n'ha d'obrir cap altra: qui no gestiona
    // excursions no ha de poder canviar quants alumnes s'hi esperen.
    const grup = await grupDUnaExcursio()
    await asUser('teacher@stjosep.org')
    expect((await db.query(
      'update public.excursio_grups set alumnes_previstos=99 where id=$1 returning id',[grup])).rows)
      .toHaveLength(0)
  })

  it('un convidat no', async () => {
    const grup = await grupDUnaExcursio()
    await asUser('guest@stjosep.org')
    await expect(db.query('select public.registra_pagaments($1,$2)',[grup,18]))
      .rejects.toThrow('No autoritzat')
  })

  it('un número negatiu es rebutja', async () => {
    const grup = await grupDUnaExcursio()
    await asUser('teacher@stjosep.org')
    await expect(db.query('select public.registra_pagaments($1,$2)',[grup,-1]))
      .rejects.toThrow('no pot ser negatiu')
  })

  it('pot haver-hi més pagaments que previsions', async () => {
    // Els previstos s'escriuen al setembre i el nombre es mou. Que en paguin
    // més dels previstos és una dada correcta, no un error que calgui aturar.
    const grup = await grupDUnaExcursio()
    await asUser('teacher@stjosep.org')
    await db.query('select public.registra_pagaments($1,$2)',[grup,30])
    expect(await pagats(grup)).toBe(30)
  })

  it('un grup que no existeix no passa en silenci', async () => {
    await asUser('teacher@stjosep.org')
    await expect(db.query('select public.registra_pagaments($1,$2)',
      ['00000000-0000-0000-0000-000000000000',5]))
      .rejects.toThrow('no existeix')
  })

  // La prova que dona sentit a tota la tasca.
  it('la funció és l’únic camí: un update directe es rebutja', async () => {
    // Fins i tot per a qui gestiona excursions i pot escriure la resta de la
    // fila. Si això deixés de ser cert, apuntar pagaments deixaria de ser una
    // acció controlada i passaria a ser una columna qualsevol.
    const grup = await grupDUnaExcursio()
    await asUser('admin@stjosep.org')
    await db.exec('savepoint intent')
    await expect(db.query('update public.excursio_grups set alumnes_pagats=99 where id=$1',[grup]))
      .rejects.toThrow()
    await db.exec('rollback to savepoint intent')
    await db.exec('reset role')
    expect(await pagats(grup)).toBe(0)
  })

  it('però les columnes de sempre es continuen podent escriure', async () => {
    // Retirar el permís d'update i tornar-lo a donar per columnes és fàcil que
    // es passi de frenada i bloquegi el que ja funcionava.
    const grup = await grupDUnaExcursio()
    await asUser('admin@stjosep.org')
    await db.query('update public.excursio_grups set alumnes_previstos=26, alumnes_finals=24 where id=$1',[grup])
    const g = (await db.query<{alumnes_previstos:number;alumnes_finals:number}>(
      'select alumnes_previstos,alumnes_finals from public.excursio_grups where id=$1',[grup])).rows[0]
    expect(g.alumnes_previstos).toBe(26)
    expect(g.alumnes_finals).toBe(24)
  })
})
```

- [ ] **Step 2: Executar-les i veure-les fallar**

Run: `npx vitest run tests/database.test.ts -t "apuntar els pagaments"`
Esperat: FAIL, la columna i la funció no existeixen.

- [ ] **Step 3: Escriure la migració**

```sql
begin;

-- Quants alumnes de cada grup han pagat. Un recompte i res més: ni noms, ni
-- números de llista, ni imports. El que el centre vol saber és la xifra
-- recaptada —perseguir qui deu diners ho continua fent el tutor amb la seva
-- llista—, i per a la xifra un recompte per grup ja n'hi ha prou.
alter table public.excursio_grups add column if not exists alumnes_pagats integer not null default 0;
alter table public.excursio_grups drop constraint if exists excursio_grups_pagats_check;
-- Sense límit superior a propòsit: els previstos s'escriuen al setembre i el
-- nombre es mou, així que pagar-ne més dels previstos és una dada correcta.
alter table public.excursio_grups add constraint excursio_grups_pagats_check
  check (alumnes_pagats >= 0);

-- Qui apunta els pagaments és el tutor, que no pot escriure aquesta taula: la
-- política només hi deixa entrar qui gestiona excursions o l'autor mentre és
-- esborrany. I les polítiques de PostgreSQL són **per fila, no per columna**,
-- així que obrir-la del tot també deixaria tocar les previsions.
--
-- La sortida és el permís per columna: es retira l'`update` sobre la taula i
-- es torna a concedir només sobre les columnes de sempre. Llavors un `update`
-- directe sobre `alumnes_pagats` falla per privilegis —també per a qui
-- gestiona excursions— i només hi entra la funció de sota, que corre com la
-- propietària. És el mateix que ja es fa a `prestecs`, on `authenticated`
-- només pot actualitzar `notes`.
revoke update on public.excursio_grups from authenticated;
grant update (grup, alumnes_previstos, alumnes_finals) on public.excursio_grups to authenticated;

create or replace function public.registra_pagaments(p_grup uuid, p_pagats integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Qualsevol que vegi el mòdul, sobre qualsevol grup: `usuaris` no sap qui és
  -- tutor de quin grup, i restringir-ho a qui va proposar l'excursió deixaria
  -- el tutor de B sense poder apuntar el seu quan la proposa el de A. Queda
  -- rastre: la taula té el disparador d'auditoria des de la Fase A.
  if not (app_private.module_visible('excursions') and app_private.creator()) then
    raise exception 'No autoritzat';
  end if;
  if p_pagats is null or p_pagats < 0 then
    raise exception 'El nombre de pagaments no pot ser negatiu';
  end if;

  update public.excursio_grups set alumnes_pagats = p_pagats where id = p_grup;
  if not found then raise exception 'Aquest grup no existeix'; end if;
end;
$$;

revoke all on function public.registra_pagaments(uuid, integer) from public, anon, authenticated;
grant execute on function public.registra_pagaments(uuid, integer) to authenticated;

commit;
```

- [ ] **Step 4: Executar-les i veure-les passar**

Run: `npx vitest run tests/database.test.ts`
Esperat: PASS, totes.

**Si falla «però les columnes de sempre es continuen podent escriure»**, el `grant update (...)` s'ha deixat alguna columna: compara la llista amb les que la taula tenia abans d'aquesta migració (`grup`, `alumnes_previstos`, `alumnes_finals`). No hi afegeixis `alumnes_pagats` per fer-la passar — és justament el que no ha de poder-se.

- [ ] **Step 5: Comprovar que les proves proven alguna cosa**

```bash
mv supabase/migrations/202609230001_pagaments.sql /tmp/ && npx vitest run tests/database.test.ts 2>&1 | grep -E "×|Tests "; mv /tmp/202609230001_pagaments.sql supabase/migrations/
```

Esperat: fallen les proves noves i **cap altra**. Si en falla alguna de `prestecs` o d'excursions, la migració ha tocat permisos que no li tocaven.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202609230001_pagaments.sql tests/database.test.ts
git commit -m "feat(pagaments): un recompte per grup, i una sola porta per escriure'l"
```

---

### Task 2: Portar-ho a l'aplicació

**Files:**
- Modify: `src/modules/excursions/types.ts`, `src/modules/excursions/excursions.utils.ts`, `src/modules/excursions/useExcursions.ts`, `src/modules/excursions/useExcursions.test.ts`
- Create: `src/modules/excursions/pagaments.ts`, `src/modules/excursions/pagaments.test.ts`

**Interfaces:**
- Consumes: `registra_pagaments(p_grup, p_pagats)` de la Task 1.
- Produces:
  ```ts
  // a ExcursioGrup
  AlumnesPagats: number
  // pagaments.ts
  export function recaptat(grups: ExcursioGrup[], preuAlumne: number | null): number | null
  export function totalPagats(grups: ExcursioGrup[]): number
  // a l'store
  registraPagaments: (grupId: string, pagats: number) => Promise<void>
  ```

- [ ] **Step 1: Escriure les proves del càlcul**

```ts
// src/modules/excursions/pagaments.test.ts
import { describe, it, expect } from 'vitest'
import { recaptat, totalPagats } from './pagaments'
import type { ExcursioGrup } from './types'

const grup = (pagats: number, previstos = 25): ExcursioGrup =>
  ({ id: `g${pagats}`, Grup: 'EP-1 A', AlumnesPrevistos: previstos, AlumnesFinals: null, AlumnesPagats: pagats })

describe('què s’ha recaptat', () => {
  it('suma els pagaments de tots els grups i multiplica pel preu', () => {
    expect(recaptat([grup(18), grup(20)], 12.5)).toBe(475)
  })

  it('sense preu confirmat no hi ha cap xifra, i no és zero', () => {
    // Zero vol dir que no ha pagat ningú; buit vol dir que encara no se sap
    // quant es cobra. A un panell econòmic, confondre-ho seria ensenyar una
    // pèrdua que no existeix.
    expect(recaptat([grup(18)], null)).toBeNull()
  })

  it('amb el preu a zero, el recaptat és zero', () => {
    expect(recaptat([grup(18)], 0)).toBe(0)
  })

  it('sense grups, zero', () => {
    expect(totalPagats([])).toBe(0)
    expect(recaptat([], 12.5)).toBe(0)
  })

  it('no arrossega errors de coma flotant', () => {
    // 3 × 10,10 en coma flotant fa 30,299999999999997, i això acabaria imprès
    // en un panell que parla de diners.
    expect(recaptat([grup(3)], 10.1)).toBe(30.3)
  })
})
```

- [ ] **Step 2: Executar-les i veure-les fallar**

Run: `npx vitest run src/modules/excursions/pagaments.test.ts`
Esperat: FAIL, «Failed to resolve import "./pagaments"».

- [ ] **Step 3: Afegir el camp al tipus i al mapatge**

A `types.ts`, dins `interface ExcursioGrup`, després de `AlumnesFinals`:

```ts
  AlumnesPagats: number
```

A `excursions.utils.ts` (i allà on `useExcursions.ts` declara `GrupRow`), afegeix `alumnes_pagats: number` a la fila i mapa'l amb `?? 0`: **mai `null`**, perquè «ningú ha pagat» és zero i no és un desconegut.

Les proves existents que construeixen un `ExcursioGrup` o un `GrupRow` literal deixaran de compilar. Actualitza-les al mínim; és esperat.

- [ ] **Step 4: Escriure `pagaments.ts`**

```ts
// src/modules/excursions/pagaments.ts
//
// Què s'ha recaptat d'una excursió. Va a part perquè és l'entrada del panell
// econòmic que ve després, i perquè així es prova sense muntar cap pantalla.
import type { ExcursioGrup } from './types'

export function totalPagats(grups: ExcursioGrup[]): number {
  return grups.reduce((s, g) => s + g.AlumnesPagats, 0)
}

/**
 * Els diners que han entrat. `null` quan encara no hi ha preu confirmat: no és
 * el mateix que zero, i a un panell econòmic confondre-ho ensenyaria una
 * pèrdua que no existeix.
 */
export function recaptat(grups: ExcursioGrup[], preuAlumne: number | null): number | null {
  if (preuAlumne === null) return null
  // En cèntims: 3 × 10,10 en coma flotant fa 30,299999999999997, i això
  // acabaria imprès en una pantalla que parla de diners.
  return Math.round(totalPagats(grups) * preuAlumne * 100) / 100
}
```

- [ ] **Step 5: Executar-les i veure-les passar**

Run: `npx vitest run src/modules/excursions/pagaments.test.ts`
Esperat: PASS.

- [ ] **Step 6: Afegir l'acció a l'store**

A `useExcursions.ts`, seguint el patró de les altres accions que criden funcions de servidor (`callRpc`), i recarregant després perquè la fitxa mostri el número nou:

```ts
  async registraPagaments(grupId, pagats) {
    await callRpc('registra_pagaments', { p_grup: grupId, p_pagats: pagats })
    await get().load()
  },
```

Declara-la a la interfície de l'estat. Afegeix una prova a `useExcursions.test.ts` que comprovi el nom de la funció i el dels dos paràmetres —han de coincidir amb la migració, i és l'única manera que una errata surti abans d'arribar a producció.

- [ ] **Step 7: Passar totes les comprovacions**

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
```

Esperat: tot net. Digues el recompte de proves **i el de fitxers**: un fitxer que no carrega deixa passar la resta.

- [ ] **Step 8: Commit**

```bash
git add src/modules/excursions/
git commit -m "feat(pagaments): el recompte arriba a l'aplicació i el recaptat es calcula"
```

---

### Task 3: El camp a la fitxa

**Files:**
- Modify: `src/modules/excursions/ExcursioDetall.tsx`

**Interfaces:**
- Consumes: `AlumnesPagats`, `recaptat`, `totalPagats` (Task 2) i `registraPagaments` de l'store.

- [ ] **Step 1: Posar-hi el camp**

Al bloc de grups que ja hi ha. Avui cada grup es pinta en una línia:

```tsx
{e.Grups.map((g) => <li key={g.id}>{g.Grup} — {g.AlumnesPrevistos} alumnes</li>)}
```

Cada grup passa a tenir, a més, un camp numèric petit amb els pagats, amb l'etiqueta clara que són pagaments i no alumnes.

Requisits:
- Es desa quan el camp perd el focus o es prem Enter, **no a cada tecla**: cada desat és una crida al servidor i una recàrrega.
- Mentre la crida és en marxa, el camp es bloqueja; si peta, surt l'error. Fes servir el patró `ocupat` + try/catch + la franja d'error que el fitxer ja té per a les altres accions — no n'obris un de nou.
- Sota la llista, el total: quants han pagat de quants es preveien, i **què s'ha recaptat** quan hi ha preu confirmat. Si no n'hi ha, digues que falta confirmar el preu en comptes d'ensenyar un zero.
- Si en un grup hi ha més pagaments que previsions, assenyala-ho —en gris, no en vermell: és una dada correcta, no un error.

Ho veu i ho pot editar **tothom qui veu la fitxa**: no cal cap permís nou, la funció del servidor ja decideix qui pot.

- [ ] **Step 2: Passar totes les comprovacions**

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
```

Esperat: tot net. Recompte de proves **i de fitxers**.

- [ ] **Step 3: Provar-ho al navegador**

```bash
npm run dev
```

Obre una excursió amb grups i preu confirmat. Apunta pagaments en un grup, surt del camp i mira que el total i el recaptat es refresquin. Posa'n més que previstos i comprova que ho assenyala sense impedir-ho. Prova d'apuntar-ne en una excursió que no hagis creat tu: ha de deixar-te.

- [ ] **Step 4: Commit**

```bash
git add src/modules/excursions/ExcursioDetall.tsx
git commit -m "feat(pagaments): apuntar-los des de la fitxa"
```

---

## Desplegament

Un cop fusionat, aplicar `202609230001_pagaments.sql` a producció i comprovar-ho amb una consulta, no només amb el «success»:

```sql
select column_name, privilege_type from information_schema.column_privileges
 where table_name='excursio_grups' and grantee='authenticated' and privilege_type='UPDATE'
 order by column_name;
```

Esperat: hi surten `grup`, `alumnes_previstos` i `alumnes_finals`, i **no** `alumnes_pagats`.

## Què ve després

El panell econòmic. Dues coses que ja se saben i que el seu disseny haurà de dir clarament: **la comparació entre cursos no tindrà res a comparar** fins que passi un curs sencer, perquè les dades de 2022-23 són a l'Excel i no a la base de dades; i la previsió d'assistència es podrà proposar a partir de l'històric real quan n'hi hagi.
