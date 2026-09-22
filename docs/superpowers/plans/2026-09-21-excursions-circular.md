# Excursions Fase B2a — la circular

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que l'aplicació generi la circular d'una excursió en Word, amb les dades de l'excursió desada, i que enviar-la sigui una transició d'estat.

**Architecture:** El document es construeix per codi amb `docx`, portant el generador ja validat el 2026-09-17. Les tres dates es proposen soles amb funcions pures i Gestió les pot ajustar; els textos vénen de Configuració. Enviar la circular és una funció del servidor que exigeix que el preu estigui congelat.

**Tech Stack:** React 19 + TypeScript estricte · Zustand · `docx` (dependència nova, carregada només dins el mòdul) · PostgreSQL 17 (Supabase) · Vitest + PGlite

**Spec:** `docs/superpowers/specs/2026-09-18-excursions-design.md` (apartats 5, 8 i 9)

**Prototip a portar:** `~/Desktop/ClaudeProjectos/Coordinacion Digital/Circular excursió - generador.js` i el boceto aprovat al costat (`.docx` i `.pdf`). **El disseny no es toca**: està validat i és el que s'ha d'obtenir.

## Global Constraints

- **El disseny del boceto és la referència.** Si alguna cosa no encaixa, es pregunta; no s'improvisa un disseny nou.
- Els textos de la interfície i del document van **en català**. Comentaris i missatges de commit, també, explicant **per què** i no què.
- TypeScript estricte: `verbatimModuleSyntax` (cal `import type`) i `noUnusedLocals`.
- Les migracions **no es toquen un cop aplicades**; cada canvi és una migració nova. `supabase/schema.sql` **no es toca mai**.
- **`Circular enviada` no s'afegeix mai a la llista d'estats que admet `confirmar_preu`.** Si s'hi afegís, el preu deixaria d'estar congelat i les famílies tindrien a casa un paper amb un import que ja no és el del sistema. Hi ha una prova que ho vigila.
- Enviar la circular exigeix que `preu_alumne` no sigui nul: una circular sense preu no té sentit.
- Qui pot enviar-la és `app_private.excursions_gestio()`. El document conté el preu, però el preu **és públic** (va a les famílies); el que no hi surt mai són els costos.
- Cap dada d'alumnat al document: es parla per grup i per preu.
- Valors per defecte (spec §6 i §8): circular **15 dies** abans · termini de pagament **8 dies** abans, mogut al dia lectiu **anterior** · resguard **l'endemà lectiu** del termini.

---

## Estructura de fitxers

| Fitxer | Responsabilitat |
|---|---|
| `src/utils/schoolCalendar.ts` | Hi entra `esDiaLectiu` (modificació) |
| `src/modules/excursions/datesCircular.ts` | Proposa les tres dates. Funcions pures |
| `src/modules/excursions/datesCircular.test.ts` | Les regles de dates, incloses les vores |
| `src/modules/excursions/circular/logo.ts` | El logo del centre en base64 |
| `src/modules/excursions/circular/dades.ts` | Munta les dades del document a partir de l'excursió |
| `src/modules/excursions/circular/dades.test.ts` | Format de preus i dates, frase de l'AMPA |
| `src/modules/excursions/circular/document.ts` | Construeix el `.docx`. Port del generador |
| `src/modules/excursions/circular/document.test.ts` | Genera el document i mira que el text hi sigui |
| `supabase/migrations/202609220001_circular.sql` | Columnes de dates i `enviar_circular` |
| `src/store/configStore.ts` | Claus noves (modificació) |
| `src/modules/configuracio/ConfiguracioPage.tsx` | Els textos de la circular (modificació) |
| `src/modules/excursions/CircularAccions.tsx` | El bloc de la circular dins la fitxa |
| `src/modules/excursions/ExcursioDetall.tsx` | Hi encaixa el bloc (modificació) |

`dades.ts` no sap res de `docx` i `document.ts` no sap res de l'excursió: entre els dos hi ha un objecte pla. Així el format —que és on es cometen els errors que es veuen— es prova sense construir cap document, i el document es prova sense muntar cap excursió.

---

### Task 1: Les tres dates

**Files:**
- Modify: `src/utils/schoolCalendar.ts`
- Create: `src/modules/excursions/datesCircular.ts`, `src/modules/excursions/datesCircular.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // schoolCalendar.ts
  export function esDiaLectiu(iso: string, diesNoLectius: string[]): boolean
  // datesCircular.ts
  export interface DatesCircular { circular: string; pagament: string; resguard: string }
  export function proposaDates(
    dataExcursio: string, diesNoLectius: string[],
    diesAbansCircular = 15, diesAbansTermini = 8,
  ): DatesCircular
  ```
  Totes les dates són `AAAA-MM-DD`.

- [ ] **Step 1: Escriure les proves**

```ts
import { describe, it, expect } from 'vitest'
import { esDiaLectiu } from '../../utils/schoolCalendar'
import { proposaDates } from './datesCircular'

// Dijous 20 d'octubre de 2026 no existeix com a festiu; el 2026-10-20 és dimarts.
const CAP_DE_FESTIUS: string[] = []

describe('dia lectiu', () => {
  it('els caps de setmana no ho són', () => {
    expect(esDiaLectiu('2026-09-19', CAP_DE_FESTIUS)).toBe(false)  // dissabte
    expect(esDiaLectiu('2026-09-20', CAP_DE_FESTIUS)).toBe(false)  // diumenge
    expect(esDiaLectiu('2026-09-21', CAP_DE_FESTIUS)).toBe(true)   // dilluns
  })
  it('ni els dies marcats a Configuració', () => {
    expect(esDiaLectiu('2026-09-21', ['2026-09-21'])).toBe(false)
  })
  it('una data que no s’entén no es dona per lectiva', () => {
    // Val més no proposar cap data que proposar-ne una inventada.
    expect(esDiaLectiu('ahir', CAP_DE_FESTIUS)).toBe(false)
  })
})

describe('proposar les dates de la circular', () => {
  it('la circular surt quinze dies abans', () => {
    // 2026-11-18 és dimecres; quinze dies abans és el 3 de novembre.
    expect(proposaDates('2026-11-18', CAP_DE_FESTIUS).circular).toBe('2026-11-03')
  })

  it('el termini de pagament, vuit dies abans si és lectiu', () => {
    expect(proposaDates('2026-11-18', CAP_DE_FESTIUS).pagament).toBe('2026-11-10')
  })

  it('i si cau en dissabte, es mou al dia lectiu anterior', () => {
    // 2026-11-21 és dissabte; vuit dies abans és el 13, divendres. Provem-ne
    // un que caigui malament: 2026-11-16 (dilluns) − 8 = 2026-11-08, diumenge.
    expect(proposaDates('2026-11-16', CAP_DE_FESTIUS).pagament).toBe('2026-11-06')
  })

  it('i si el dia lectiu anterior és festiu, segueix enrere', () => {
    expect(proposaDates('2026-11-16', ['2026-11-06', '2026-11-05']).pagament).toBe('2026-11-04')
  })

  it('el resguard és l’endemà lectiu del termini', () => {
    // El spec diu «l'endemà»; es pren com l'endemà **lectiu**, perquè el
    // resguard es lliura al tutor i en dissabte no hi ha ningú.
    const d = proposaDates('2026-11-16', CAP_DE_FESTIUS)
    expect(d.pagament).toBe('2026-11-06')   // divendres
    expect(d.resguard).toBe('2026-11-09')   // dilluns, no dissabte
  })

  it('els dies configurables es respecten', () => {
    const d = proposaDates('2026-11-18', CAP_DE_FESTIUS, 20, 10)
    expect(d.circular).toBe('2026-10-29')
    expect(d.pagament).toBe('2026-11-06')   // el 8 és diumenge → divendres 6
  })

  it('sense data d’excursió no s’inventa res', () => {
    expect(proposaDates('', CAP_DE_FESTIUS)).toEqual({ circular: '', pagament: '', resguard: '' })
  })
})
```

- [ ] **Step 2: Executar-les i veure-les fallar**

Run: `npx vitest run src/modules/excursions/datesCircular.test.ts`
Esperat: FAIL, «Failed to resolve import "./datesCircular"».

- [ ] **Step 3: Escriure-les**

A `src/utils/schoolCalendar.ts`, al final:

```ts
/**
 * Si un dia té classe. Fins ara cada pantalla s'ho mirava pel seu compte
 * (`ExcursioForm`, `AbsenciaForm`, el tauler); aquí queda en un sol lloc
 * perquè les dates de la circular hi depenen i no poden dir una cosa
 * diferent de la resta de l'aplicació.
 */
export function esDiaLectiu(iso: string, diesNoLectius: string[]): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const dia = new Date(`${iso}T00:00:00Z`).getUTCDay()
  if (Number.isNaN(dia)) return false
  if (dia === 0 || dia === 6) return false
  return !diesNoLectius.includes(iso)
}
```

```ts
// src/modules/excursions/datesCircular.ts
//
// Les tres dates que surten a la circular. Es proposen soles perquè ningú les
// hagi de comptar a mà cada vegada, però Gestió les pot canviar una a una:
// són una proposta, no una regla.
//
// A la plantilla antiga el pagament i el resguard compartien data i se'ls
// anomenava «dimarts» en un lloc i «dimecres» en un altre. Són dos dies
// diferents i aquí es calculen per separat.
import { esDiaLectiu } from '../../utils/schoolCalendar'

export interface DatesCircular {
  circular: string
  pagament: string
  resguard: string
}

function mou(iso: string, dies: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dies)
  return d.toISOString().slice(0, 10)
}

/** Recula (o avança) fins a trobar un dia amb classe. */
function fins_a_lectiu(iso: string, pas: -1 | 1, diesNoLectius: string[]): string {
  let d = iso
  // Un mes de marge: si en trenta intents no n'hi ha cap de lectiu, alguna
  // cosa està molt malament a la configuració i val més tornar el que hi ha
  // que girar per sempre.
  for (let i = 0; i < 30 && !esDiaLectiu(d, diesNoLectius); i++) d = mou(d, pas)
  return d
}

export function proposaDates(
  dataExcursio: string,
  diesNoLectius: string[],
  diesAbansCircular = 15,
  diesAbansTermini = 8,
): DatesCircular {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataExcursio)) return { circular: '', pagament: '', resguard: '' }

  const circular = mou(dataExcursio, -diesAbansCircular)
  // El termini es mou **enrere**: endarrerir-lo acostaria el cobrament al dia
  // de la sortida, que és el que no es vol.
  const pagament = fins_a_lectiu(mou(dataExcursio, -diesAbansTermini), -1, diesNoLectius)
  // El resguard es lliura al tutor, i en dissabte no hi ha ningú a qui donar-lo.
  const resguard = fins_a_lectiu(mou(pagament, 1), 1, diesNoLectius)

  return { circular, pagament, resguard }
}
```

- [ ] **Step 4: Executar-les i veure-les passar**

Run: `npx vitest run src/modules/excursions/datesCircular.test.ts`
Esperat: PASS. **Si alguna data no quadra, comprova el dia de la setmana amb un calendari abans de tocar res**: les proves porten el dia escrit al comentari i és el que mana.

- [ ] **Step 5: Commit**

```bash
git add src/utils/schoolCalendar.ts src/modules/excursions/datesCircular.ts src/modules/excursions/datesCircular.test.ts
git commit -m "feat(circular): proposar les tres dates, cadascuna la seva"
```

---

### Task 2: Enviar la circular és una transició

**Files:**
- Create: `supabase/migrations/202609220001_circular.sql`
- Modify: `tests/database.test.ts`

**Interfaces:**
- Produces: columnes `data_circular date`, `data_limit_pagament date`, `data_limit_resguard date`, `circular_enviada_per text`, `circular_enviada_el timestamptz`, `ampa_collabora boolean not null default false` a `public.excursions`, i
  `public.enviar_circular(p_id uuid, p_circular date, p_pagament date, p_resguard date)`.

**Per què cal `ampa_collabora`.** La circular ha de dir si l'AMPA hi col·labora, i es genera al navegador. Però l'aportació viu a `excursio_finances`, que **qui gestiona la circular pot no poder llegir**: `excursions_gestio()` inclou el docent amb la casella de logística, i aquell no veu diners. Sense aquest camp, o la frase de l'AMPA no sortiria mai per a aquestes persones, o caldria obrir-los els costos.

El camp és un **sí o no públic**, sense import, i el manté `confirmar_preu`, que és qui ja té els números a la mà. Una circular diu que l'AMPA col·labora; no diu amb quant.

- [ ] **Step 1: Escriure les proves**

Al final de `tests/database.test.ts`. Mira els `describe` veïns i segueix-ne l'estil (`asUser`, `reset role`, savepoints abans de cada sentència que hagi de fallar).

```ts
describe('enviar la circular', () => {
  async function ambPreu() {
    await asUser('admin@stjosep.org')
    const id = (await db.query<{id:string}>(`
      insert into public.excursions(etapa,lloc,activitat,data,hora_sortida,hora_tornada,transport)
      values('EP','Can Montcau','Visita','2026-11-18','09:00','13:00','autocar') returning id`)).rows[0].id
    await db.query(`insert into public.excursio_grups(excursio_id,grup,alumnes_previstos) values($1,'EP-1 A',25)`,[id])
    await db.query(`update public.excursions set estat='Proposada' where id=$1`,[id])
    await db.query(`update public.excursions set estat='Aprovada' where id=$1`,[id])
    await db.query(`insert into public.excursio_finances(excursio_id) values($1)`,[id])
    await db.query('select public.confirmar_preu($1,$2,$3,$4,$5)',[id,12.5,0.8,12,10])
    return id
  }

  it('desa les tres dates i deixa l’excursió en circular enviada', async () => {
    const id = await ambPreu()
    await db.query('select public.enviar_circular($1,$2,$3,$4)',[id,'2026-11-03','2026-11-06','2026-11-09'])
    const e = (await db.query<{estat:string;data_circular:string;data_limit_pagament:string;data_limit_resguard:string;circular_enviada_per:string}>(
      `select estat,data_circular,data_limit_pagament,data_limit_resguard,circular_enviada_per
         from public.excursions where id=$1`,[id])).rows[0]
    expect(e.estat).toBe('Circular enviada')
    expect(e.circular_enviada_per).toBe('admin@stjosep.org')
    expect(String(e.data_limit_pagament)).toContain('2026-11-06')
    expect(String(e.data_limit_resguard)).toContain('2026-11-09')
  })

  it('no es pot enviar sense preu confirmat', async () => {
    // Una circular sense import no serveix de res: és justament el número que
    // les famílies han de veure.
    await asUser('admin@stjosep.org')
    const id = (await db.query<{id:string}>(`
      insert into public.excursions(etapa,lloc,activitat,data,hora_sortida,hora_tornada,transport)
      values('EP','Prova','Prova','2026-11-18','09:00','13:00','autocar') returning id`)).rows[0].id
    await db.query(`insert into public.excursio_grups(excursio_id,grup,alumnes_previstos) values($1,'EP-1 A',25)`,[id])
    await db.query(`update public.excursions set estat='Proposada' where id=$1`,[id])
    await db.query(`update public.excursions set estat='Aprovada' where id=$1`,[id])
    await expect(db.query('select public.enviar_circular($1,$2,$3,$4)',[id,'2026-11-03','2026-11-06','2026-11-09']))
      .rejects.toThrow('preu')
  })

  it('un docent normal no la pot enviar', async () => {
    const id = await ambPreu()
    await asUser('teacher@stjosep.org')
    await expect(db.query('select public.enviar_circular($1,$2,$3,$4)',[id,'2026-11-03','2026-11-06','2026-11-09']))
      .rejects.toThrow('No autoritzat')
  })

  it('avisa qui la va proposar', async () => {
    const id = await ambPreu()
    await db.query('select public.enviar_circular($1,$2,$3,$4)',[id,'2026-11-03','2026-11-06','2026-11-09'])
    await db.exec('reset role')
    const n = (await db.query<{subject:string;body:string}>(
      `select subject,body from public.notifications where event_key like 'circular-enviada:%' limit 1`)).rows
    expect(n).toHaveLength(1)
    expect(n[0].body).toContain('Can Montcau')
  })

  it('marca si l’AMPA hi col·labora, sense dir quant', async () => {
    // Qui genera la circular pot ser un docent amb la casella de logística,
    // que no pot llegir els costos. El camp li diu que surti la frase; l'import
    // no li arriba mai.
    await asUser('admin@stjosep.org')
    const id = (await db.query<{id:string}>(`
      insert into public.excursions(etapa,lloc,activitat,data,hora_sortida,hora_tornada,transport)
      values('EP','Prova','Prova','2026-11-18','09:00','13:00','autocar') returning id`)).rows[0].id
    await db.query(`insert into public.excursio_grups(excursio_id,grup,alumnes_previstos) values($1,'EP-1 A',25)`,[id])
    await db.query(`update public.excursions set estat='Proposada' where id=$1`,[id])
    await db.query(`update public.excursions set estat='Aprovada' where id=$1`,[id])
    await db.query(`insert into public.excursio_finances(excursio_id,ampa_import) values($1,4)`,[id])
    await db.query('select public.confirmar_preu($1,$2,$3,$4,$5)',[id,12.5,0.8,12,10])
    expect((await db.query<{ampa_collabora:boolean}>(
      'select ampa_collabora from public.excursions where id=$1',[id])).rows[0].ampa_collabora).toBe(true)
  })

  it('i el deixa a fals quan l’AMPA no hi posa res', async () => {
    const id = await ambPreu()   // `ambPreu` crea les finances sense aportació
    expect((await db.query<{ampa_collabora:boolean}>(
      'select ampa_collabora from public.excursions where id=$1',[id])).rows[0].ampa_collabora).toBe(false)
  })

  // La guarda que més importa de tota la tasca.
  it('un cop enviada, el preu ja no es pot tornar a confirmar', async () => {
    // Les famílies tenen a casa un paper amb un import. Si el preu es pogués
    // canviar després, el paper i el sistema dirien coses diferents i ningú
    // se n'adonaria.
    const id = await ambPreu()
    await db.query('select public.enviar_circular($1,$2,$3,$4)',[id,'2026-11-03','2026-11-06','2026-11-09'])
    await expect(db.query('select public.confirmar_preu($1,$2,$3,$4,$5)',[id,99,0.8,12,10]))
      .rejects.toThrow('Només es confirma')
  })
})
```

- [ ] **Step 2: Executar-les i veure-les fallar**

Run: `npx vitest run tests/database.test.ts -t "enviar la circular"`
Esperat: FAIL, la funció no existeix.

- [ ] **Step 3: Escriure la migració**

```sql
begin;

-- Les tres dates viuen a `excursions` i no a les taules de costos: surten a
-- la circular, o sigui que són públiques. El que és privat és com s'ha
-- arribat al preu, no quan s'ha de pagar.
alter table public.excursions add column if not exists data_circular date;
alter table public.excursions add column if not exists data_limit_pagament date;
alter table public.excursions add column if not exists data_limit_resguard date;
alter table public.excursions add column if not exists circular_enviada_per text;
alter table public.excursions add column if not exists circular_enviada_el timestamptz;

-- Un sí o no públic, sense import. La circular ha de poder dir que l'AMPA hi
-- col·labora, i qui la genera pot ser un docent amb la casella de logística,
-- que **no pot llegir `excursio_finances`**. Amb aquest camp la frase surt
-- sense haver d'obrir-li els costos: diu que col·labora, no amb quant.
alter table public.excursions add column if not exists ampa_collabora boolean not null default false;

-- `confirmar_preu` és qui té els números a la mà, així que és qui manté el
-- camp. Es reemplaça sencera perquè les migracions no es toquen un cop
-- aplicades; la resta del cos és la de la migració anterior.
create or replace function public.confirmar_preu(
  p_id uuid, p_preu numeric, p_previsio numeric, p_marge_pct numeric, p_iva_pct numeric
) returns void
language plpgsql security definer set search_path = '' as $$
declare qui text := app_private.email(); actual text;
begin
  if not app_private.excursions_costos() then raise exception 'No autoritzat'; end if;
  if p_preu is null or p_preu < 0 then raise exception 'El preu no pot ser negatiu'; end if;

  select estat into actual from public.excursions where id = p_id;
  if actual is null then raise exception 'L''excursió no existeix'; end if;
  -- `Circular enviada` **no** hi és, i no s'hi ha d'afegir mai: és el moment a
  -- partir del qual les famílies tenen a casa un paper amb un import.
  if actual not in ('Aprovada','Reservada') then
    raise exception 'Només es confirma el preu d''una excursió aprovada (ara és %)', actual;
  end if;

  update public.excursions
     set preu_alumne = p_preu, preu_confirmat_per = qui, preu_confirmat_el = now(),
         ampa_collabora = coalesce(
           (select ampa_import > 0 or ampa_cobreix_activitat
              from public.excursio_finances where excursio_id = p_id), false)
   where id = p_id;

  update public.excursio_finances
     set previsio_usada = p_previsio, marge_pct_usat = p_marge_pct, iva_pct_usat = p_iva_pct
   where excursio_id = p_id;
end;
$$;

-- Enviar la circular és el pas que converteix un preu calculat en un import
-- que les famílies tenen a casa. Per això és una funció del servidor i no una
-- escriptura qualsevol, i per això exigeix que el preu ja estigui congelat.
--
-- **`Circular enviada` no s'afegeix a la llista de `confirmar_preu`.** Aquell
-- estat és precisament el moment a partir del qual el preu no es pot moure.
create or replace function public.enviar_circular(
  p_id uuid, p_circular date, p_pagament date, p_resguard date
) returns void
language plpgsql security definer set search_path = '' as $$
declare qui text := app_private.email(); e public.excursions; destinatari text;
begin
  if not app_private.excursions_gestio() then raise exception 'No autoritzat'; end if;

  select * into e from public.excursions where id = p_id;
  if e.id is null then raise exception 'L''excursió no existeix'; end if;
  if e.estat not in ('Aprovada','Reservada') then
    raise exception 'Només s''envia la circular d''una excursió aprovada (ara és %)', e.estat;
  end if;
  if e.preu_alumne is null then
    raise exception 'Cal confirmar el preu abans d''enviar la circular';
  end if;

  update public.excursions
     set estat = 'Circular enviada',
         data_circular = p_circular,
         data_limit_pagament = p_pagament,
         data_limit_resguard = p_resguard,
         circular_enviada_per = qui, circular_enviada_el = now()
   where id = p_id;

  for destinatari in
    select coalesce(e.proposada_per, e.creat_per)
    union
    select email from public.excursio_acompanyants where excursio_id = p_id
  loop
    if destinatari is not null then
      perform app_private.enqueue(destinatari,
        e.codi || ' · circular enviada · ' || e.lloc,
        'Bon dia,' || E'\n\n' ||
        'Ja ha sortit la circular d''aquesta excursió.' || E'\n\n' ||
        app_private.fitxa_excursio(e) || E'\n\n' ||
        'Data límit de pagament: ' || app_private.data_llarga(p_pagament) || E'\n' ||
        'Resguard al tutor: ' || app_private.data_llarga(p_resguard) ||
        E'\n\n' || app_private.enllac_excursions() || app_private.peu_correu(),
        'circular-enviada:' || p_id::text || ':' || destinatari);
    end if;
  end loop;
end;
$$;

revoke all on function public.enviar_circular(uuid, date, date, date) from public, anon, authenticated;
grant execute on function public.enviar_circular(uuid, date, date, date) to authenticated;

commit;
```

**Nota:** el disparador `validate_excursio` no cal tocar-lo. `enviar_circular` actualitza `estat` i el disparador hi passarà; comprova que la transició `Aprovada → Circular enviada` (i `Reservada → Circular enviada`) no caigui a la branca de «Transició no vàlida». **Si hi cau, cal afegir-la al disparador en aquesta mateixa migració**, i llavors la prova de l'Step 1 t'ho dirà. No ho donis per fet en cap dels dos sentits: mira el disparador abans.

- [ ] **Step 4: Executar-les i veure-les passar**

Run: `npx vitest run tests/database.test.ts`
Esperat: PASS, totes.

- [ ] **Step 5: Comprovar que les proves proven alguna cosa**

```bash
mv supabase/migrations/202609220001_circular.sql /tmp/ && npx vitest run tests/database.test.ts 2>&1 | grep -E "×|Tests "; mv /tmp/202609220001_circular.sql supabase/migrations/
```

Esperat: fallen les proves noves i **cap altra**.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202609220001_circular.sql tests/database.test.ts
git commit -m "feat(circular): enviar-la és una transició, i exigeix el preu congelat"
```

---

### Task 3: Els textos i els dies, a Configuració

**Files:**
- Modify: `src/store/configStore.ts`, `src/modules/configuracio/ConfiguracioPage.tsx`
- Create: `src/modules/excursions/circular/textos.ts`, `src/modules/excursions/circular/textos.test.ts`

**Interfaces:**
- Produces: claus noves i
  ```ts
  export interface TextosCircular {
    pagamentIntro: string; passosPagament: string[]; ampa: string
    devolucions: string; resguard: string
  }
  export function textosCircular(config: Record<string, string[]>): TextosCircular
  ```

- [ ] **Step 1: Escriure la prova**

```ts
import { describe, it, expect } from 'vitest'
import { CONFIG_DEFAULTS } from '../../../store/configStore'
import { textosCircular } from './textos'

describe('textos de la circular', () => {
  it('la devolució del 75 % parla de qui avisa tard, no de qui paga tard', () => {
    // La plantilla antiga ho lligava al pagament fora de termini i no
    // s'entenia. El centre va confirmar que és per a qui avisa a última hora
    // que no ve.
    expect(CONFIG_DEFAULTS['excursions.text-devolucions'][0]).toContain('no assisteix')
    expect(CONFIG_DEFAULTS['excursions.text-devolucions'][0]).toContain('75')
  })

  it('els passos del pagament són una llista, no un paràgraf', () => {
    expect(CONFIG_DEFAULTS['excursions.passos-pagament'].length).toBeGreaterThan(1)
  })

  it('els llegeix de la configuració quan n’hi ha', () => {
    const t = textosCircular({ 'excursions.text-ampa': ['L’AMPA hi col·labora amb 4 €.'] })
    expect(t.ampa).toBe('L’AMPA hi col·labora amb 4 €.')
  })

  it('i si no n’hi ha, fa servir els de sèrie', () => {
    const t = textosCircular({})
    expect(t.devolucions).toBe(CONFIG_DEFAULTS['excursions.text-devolucions'][0])
    expect(t.passosPagament.length).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Executar-la i veure-la fallar**

Run: `npx vitest run src/modules/excursions/circular/textos.test.ts`
Esperat: FAIL, el mòdul no existeix.

- [ ] **Step 3: Afegir les claus**

A `CONFIG_DEFAULTS`, al costat de les altres d'excursions:

```ts
  'excursions.dies-abans-circular': ['15'],
  'excursions.dies-abans-termini': ['8'],
  'excursions.text-pagament-intro': [
    'El pagament es fa amb el codi de barres que trobareu al final d’aquesta circular.',
  ],
  'excursions.passos-pagament': [
    'Imprimiu aquesta circular o porteu-ne el codi al mòbil.',
    'Passeu-lo pel caixer de l’entitat.',
    'Lliureu el resguard al tutor o tutora.',
  ],
  'excursions.text-ampa': ['L’AMPA col·labora en el finançament d’aquesta sortida.'],
  // El text antic lligava la devolució al pagament fora de termini i no
  // s'entenia. El centre va confirmar (2026-09-18) que és per a qui avisa a
  // última hora que no hi anirà.
  'excursions.text-devolucions': [
    'Si un alumne no assisteix i s’avisa fora de termini, es retornarà el 75 % de l’import; el 25 % restant cobreix despeses ja compromeses.',
  ],
  'excursions.text-resguard': ['Cal lliurar el resguard del pagament al tutor o tutora.'],
```

- [ ] **Step 4: Escriure `textos.ts`**

```ts
// src/modules/excursions/circular/textos.ts
//
// Els textos fixos de la circular. Són configurables perquè el que canvia
// d'un curs a l'altre és com es diu una cosa, no el disseny del document; i
// perquè si la intenció d'alguna frase era una altra, es canviï sense haver
// de tocar codi.
import { CONFIG_DEFAULTS } from '../../../store/configStore'

export interface TextosCircular {
  pagamentIntro: string
  passosPagament: string[]
  ampa: string
  devolucions: string
  resguard: string
}

function llista(config: Record<string, string[]>, clau: string): string[] {
  const desats = config[clau]
  return desats && desats.length ? desats : (CONFIG_DEFAULTS[clau] ?? [])
}
const primer = (config: Record<string, string[]>, clau: string) => llista(config, clau)[0] ?? ''

export function textosCircular(config: Record<string, string[]>): TextosCircular {
  return {
    pagamentIntro: primer(config, 'excursions.text-pagament-intro'),
    passosPagament: llista(config, 'excursions.passos-pagament'),
    ampa: primer(config, 'excursions.text-ampa'),
    devolucions: primer(config, 'excursions.text-devolucions'),
    resguard: primer(config, 'excursions.text-resguard'),
  }
}
```

- [ ] **Step 5: Executar-la i veure-la passar**

Run: `npx vitest run src/modules/excursions/circular/textos.test.ts`
Esperat: PASS.

- [ ] **Step 6: Posar-ho a la pantalla de Configuració**

A la secció d'Excursions que ja hi ha (la que va afegir la Fase B1, sota `potVeureCostos`). Els dos nombres de dies com els altres camps numèrics; els textos, com a camps de text llargs; `passos-pagament`, com a llista editable —mira com està feta `centre.dies-no-lectius`, que també és una llista.

**Els textos no són dades econòmiques:** han de sortir per a qui pot gestionar excursions (`potGestionar`), no només per a qui veu costos. Els dos nombres de dies, igual.

- [ ] **Step 7: Commit**

```bash
git add src/store/configStore.ts src/modules/excursions/circular/ src/modules/configuracio/ConfiguracioPage.tsx
git commit -m "feat(circular): els textos i els dies, configurables"
```

---

### Task 4: El logo

**Files:**
- Create: `src/modules/excursions/circular/logo.ts`

El logo del centre és dins la plantilla de Word antiga. Es guarda al projecte perquè el document el pugui incrustar sense dependre d'un fitxer que viu al escriptori d'una persona.

- [ ] **Step 1: Treure'l de la plantilla i escriure el mòdul**

```bash
cd /tmp && rm -rf plantilla && mkdir plantilla && cd plantilla
unzip -q "/Users/andresmorenoarroyo/Desktop/ClaudeProjectos/Coordinacion Digital/excursioplantilla4.dotx"
ls -la word/media/image1.jpeg    # ~22 KB
```

Genera el fitxer amb un script, no a mà:

```bash
cd <arrel del worktree>
node -e "
const fs = require('fs')
const b64 = fs.readFileSync('/tmp/plantilla/word/media/image1.jpeg').toString('base64')
fs.writeFileSync('src/modules/excursions/circular/logo.ts',
\`// El logo del centre, tret de la plantilla de Word antiga
// (\\\`excursioplantilla4.dotx\\\`, \\\`word/media/image1.jpeg\\\`).
//
// Va en base64 i no com a fitxer d'imatge perquè \\\`docx\\\` necessita els bytes,
// no una URL: amb un import normal de Vite caldria anar a buscar-la amb una
// petició, i seria una manera de fer fallar la generació del document quan
// justament no hi ha xarxa.
export const LOGO_BASE64 = '\${b64}'

export function logoBytes(): Uint8Array {
  const binari = atob(LOGO_BASE64)
  return Uint8Array.from(binari, (c) => c.charCodeAt(0))
}
\`)
console.log('escrit,', b64.length, 'caràcters')
"
```

- [ ] **Step 2: Comprovar que el que has escrit és un JPEG**

```bash
npx tsc --noEmit
grep -c "LOGO_BASE64 = '/9j/" src/modules/excursions/circular/logo.ts
```

Esperat: `tsc` net i el `grep` diu `1`. `/9j/` és com comença tot JPEG en base64; si no hi és, el que has guardat no és la imatge.

Que els bytes es puguin tornar a llegir es comprova a la Task 6, que és on es fan servir de debò: el document ha de pesar més de 10 KB, i això només passa si el logo hi ha entrat.

- [ ] **Step 3: Commit**

```bash
git add src/modules/excursions/circular/logo.ts
git commit -m "feat(circular): el logo del centre, dins el projecte"
```

---

### Task 5: Les dades del document

**Files:**
- Create: `src/modules/excursions/circular/dades.ts`, `src/modules/excursions/circular/dades.test.ts`

**Interfaces:**
- Consumes: `Excursio` (`../types`), `DatesCircular` (Task 1), `TextosCircular` (Task 3).
- Produces:
  ```ts
  export interface DadesCircular {
    curs: string; cursEscolar: string; lloc: string; poblacio: string; activitat: string
    dia: string; sortida: string; tornada: string; preu: string
    ampa: boolean; limitPagament: string; limitResguard: string; dataCircular: string
    nota: string; textos: TextosCircular
  }
  export function dataLlarga(iso: string): string
  export function dadesCircular(
    e: Excursio, dates: DatesCircular, textos: TextosCircular, nota: string,
  ): DadesCircular
  ```

**L'AMPA no és un paràmetre**: surt de `e.AmpaCollabora`, el camp públic que manté `confirmar_preu` (Task 2). Passar-lo a part seria una manera més de passar-lo malament.

Els noms dels camps són **els mateixos que fa servir el prototip** (`Circular excursió - generador.js`, objecte `d`), perquè portar-lo sigui una traducció i no una reescriptura.

- [ ] **Step 1: Escriure les proves**

```ts
import { describe, it, expect } from 'vitest'
import { dataLlarga, dadesCircular } from './dades'
import type { Excursio } from '../types'

const textos = { pagamentIntro: 'a', passosPagament: ['b'], ampa: 'c', devolucions: 'd', resguard: 'e' }
const excursio = {
  Codi: 'EXC-002', CursEscolar: '2026-2027', Etapa: 'EP', Lloc: 'Can Montcau',
  Poblacio: 'La Roca del Vallès', Activitat: 'Visita a la granja',
  Data: '2026-11-18', HoraSortida: '09:15', HoraTornada: '17:00',
  PreuAlumne: 31, AmpaCollabora: false, Grups: [{ id: 'g1', Grup: 'EP-1 A', AlumnesPrevistos: 25, AlumnesFinals: null }],
} as unknown as Excursio

describe('la data en format de circular', () => {
  it('va en català i apostrofada davant de vocal', () => {
    // «de octubre» en un paper que arriba a les famílies es llegeix com una
    // falta. El servidor ja ho fa així per als correus; aquí hi ha d'haver
    // el mateix criteri.
    expect(dataLlarga('2026-10-20')).toBe("Dimarts, 20 d'octubre de 2026")
    expect(dataLlarga('2026-11-18')).toBe('Dimecres, 18 de novembre de 2026')
  })
  it('no peta amb una data buida', () => {
    expect(dataLlarga('')).toBe('')
  })
})

describe('muntar les dades de la circular', () => {
  const dates = { circular: '2026-11-03', pagament: '2026-11-06', resguard: '2026-11-09' }

  it('el preu va amb coma i amb euro', () => {
    const d = dadesCircular(excursio, dates, textos, '')
    expect(d.preu).toBe('31,00 €')
  })

  it('les hores porten la h que la gent espera', () => {
    const d = dadesCircular(excursio, dates, textos, '')
    expect(d.sortida).toBe('9:15 h')
    expect(d.tornada).toBe('17:00 h')
  })

  it('el curs surt dels grups, no de l’etapa', () => {
    // L'etapa és «EP»; a la circular la família ha de llegir el curs del seu
    // fill, que és el que hi ha als grups.
    const d = dadesCircular(excursio, dates, textos, '')
    expect(d.curs).toBe('EP-1 A')
  })

  it('amb més d’un grup, els posa tots', () => {
    const e = { ...excursio, Grups: [
      { id:'g1', Grup:'EP-1 A', AlumnesPrevistos:25, AlumnesFinals:null },
      { id:'g2', Grup:'EP-1 B', AlumnesPrevistos:24, AlumnesFinals:null },
    ] } as unknown as Excursio
    expect(dadesCircular(e, dates, textos, '').curs).toBe('EP-1 A i EP-1 B')
  })

  it('la frase de l’AMPA només hi és si l’AMPA hi posa diners', () => {
    // A la plantilla antiga sortia sempre, també amb aportació zero.
    expect(dadesCircular(excursio, dates, textos, '').ampa).toBe(false)
    expect(dadesCircular({ ...excursio, AmpaCollabora: true } as unknown as Excursio, dates, textos, '').ampa).toBe(true)
  })

  it('sense preu confirmat, no s’inventa cap import', () => {
    const e = { ...excursio, PreuAlumne: null } as unknown as Excursio
    expect(dadesCircular(e, dates, textos, '').preu).toBe('')
  })

  it('porta la nota lliure de l’excursió', () => {
    expect(dadesCircular(excursio, dates, textos, 'Cal portar esmorzar.').nota)
      .toBe('Cal portar esmorzar.')
  })
})
```

- [ ] **Step 2: Executar-les i veure-les fallar**

Run: `npx vitest run src/modules/excursions/circular/dades.test.ts`
Esperat: FAIL, el mòdul no existeix.

- [ ] **Step 3: Escriure `dades.ts`**

Els noms dels mesos i la regla de l'apòstrof són els mateixos que fa servir `app_private.data_llarga` al servidor: **abril, agost i octubre porten `d'`**, la resta `de `.

```ts
// src/modules/excursions/circular/dades.ts
//
// D'una excursió desada al que necessita el document. Aquí no hi entra `docx`:
// el format —que és on es cometen els errors que després es veuen en paper— es
// pot provar sense construir cap document.
import type { Excursio } from '../types'
import type { DatesCircular } from '../datesCircular'
import type { TextosCircular } from './textos'

const DIES = ['Diumenge','Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte']
const MESOS = ['gener','febrer','març','abril','maig','juny','juliol','agost',
               'setembre','octubre','novembre','desembre']

/** «Dimecres, 18 de novembre de 2026». Amb apòstrof davant de vocal. */
export function dataLlarga(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const d = new Date(`${iso}T00:00:00Z`)
  const mes = d.getUTCMonth()                       // 0-11
  const prep = [3, 7, 9].includes(mes) ? "d'" : 'de '   // abril, agost, octubre
  return `${DIES[d.getUTCDay()]}, ${d.getUTCDate()} ${prep}${MESOS[mes]} de ${d.getUTCFullYear()}`
}

export interface DadesCircular {
  curs: string
  cursEscolar: string
  lloc: string
  poblacio: string
  activitat: string
  dia: string
  sortida: string
  tornada: string
  preu: string
  ampa: boolean
  limitPagament: string
  limitResguard: string
  dataCircular: string
  nota: string
  textos: TextosCircular
}

const hora = (h: string) => (h ? `${h.replace(/^0/, '')} h` : '')

export function dadesCircular(
  e: Excursio, dates: DatesCircular, textos: TextosCircular, nota: string,
): DadesCircular {
  return {
    // El curs, i no l'etapa: la família ha de llegir el curs del seu fill.
    curs: e.Grups.map((g) => g.Grup).join(' i '),
    cursEscolar: e.CursEscolar,
    lloc: e.Lloc,
    poblacio: e.Poblacio,
    activitat: e.Activitat,
    dia: dataLlarga(e.Data ?? ''),
    sortida: hora(e.HoraSortida),
    tornada: hora(e.HoraTornada),
    // Sense preu confirmat no s'escriu cap import: val més un buit que un
    // número que ningú ha aprovat.
    preu: e.PreuAlumne === null ? '' : `${e.PreuAlumne.toFixed(2).replace('.', ',')} €`,
    // Un sí o no que ve de l'excursió, no dels costos: qui genera la
    // circular pot no poder-los llegir.
    ampa: e.AmpaCollabora,
    limitPagament: dataLlarga(dates.pagament),
    limitResguard: dataLlarga(dates.resguard),
    dataCircular: dataLlarga(dates.circular),
    nota,
    textos,
  }
}
```

- [ ] **Step 4: Executar-les i veure-les passar**

Run: `npx vitest run src/modules/excursions/circular/dades.test.ts`
Esperat: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/excursions/circular/dades.ts src/modules/excursions/circular/dades.test.ts
git commit -m "feat(circular): les dades del document, separades del document"
```

---

### Task 6: El document

**Files:**
- Create: `src/modules/excursions/circular/document.ts`, `src/modules/excursions/circular/document.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `DadesCircular` (Task 5), `logoBytes` (Task 4).
- Produces: `export function circularDocx(d: DadesCircular): Document` i `export async function circularBlob(d: DadesCircular): Promise<Blob>`.

**Això és un port, no un disseny nou.** L'original és `~/Desktop/ClaudeProjectos/Coordinacion Digital/Circular excursió - generador.js` i el resultat aprovat és el `.pdf` del costat. Llegeix-los tots dos abans de començar.

Els canvis són tres i només tres:
1. `require('docx')` → `import { … } from 'docx'`.
2. `fs.readFileSync(process.argv[2])` → `logoBytes()` de la Task 4.
3. L'objecte d'exemple `d` → el paràmetre `d: DadesCircular`, i els textos fixos que ara són configurables (`d.textos.*`). **Els noms dels camps coincideixen a propòsit**, així que la resta del cos es copia tal qual.

No canviïs colors, mides, marges ni l'estructura de taules. Si alguna cosa del prototip no compila amb els tipus de `docx`, arregla el tipus, no el disseny.

- [ ] **Step 1: Afegir la dependència**

```bash
npm install docx
```

Comprova què ha passat al `package.json` i digues la versió al teu informe.

- [ ] **Step 2: Escriure la prova**

Un `.docx` és un zip amb XML a dins. No es pot mirar com queda des d'una prova, però sí comprovar que **el text hi és**: és el que atrapa una dada que no s'ha substituït o un camp que s'ha quedat buit.

```ts
import { describe, it, expect } from 'vitest'
import { Packer } from 'docx'
import { circularDocx } from './document'
import type { DadesCircular } from './dades'

const dades: DadesCircular = {
  curs: 'EP-1 A', cursEscolar: '2026-2027', lloc: 'Can Montcau',
  poblacio: 'La Roca del Vallès', activitat: 'Visita a la granja',
  dia: 'Dimecres, 18 de novembre de 2026', sortida: '9:15 h', tornada: '17:00 h',
  preu: '31,00 €', ampa: true,
  limitPagament: 'Divendres, 6 de novembre de 2026',
  limitResguard: 'Dilluns, 9 de novembre de 2026',
  dataCircular: 'Dimarts, 3 de novembre de 2026',
  nota: 'Cal portar esmorzar.',
  textos: {
    pagamentIntro: 'El pagament es fa amb el codi de barres.',
    passosPagament: ['Primer pas', 'Segon pas'],
    ampa: "L'AMPA hi col·labora.",
    devolucions: 'Si un alumne no assisteix…',
    resguard: 'Cal lliurar el resguard.',
  },
}

async function textDelDocument(d: DadesCircular): Promise<string> {
  const buffer = await Packer.toBuffer(circularDocx(d))
  // El document.xml va comprimit dins el zip; per a la prova n'hi ha prou amb
  // buscar el text pla al binari, que docx hi escriu sense comprimir prou com
  // per amagar-lo… si això falla, descomprimeix-lo amb una llibreria de zip.
  return Buffer.from(buffer).toString('latin1')
}

describe('la circular en Word', () => {
  it('porta les dades de l’excursió', async () => {
    const text = await textDelDocument(dades)
    for (const bocí of ['Can Montcau', 'Visita a la granja', '31,00', '9:15']) {
      expect(text, bocí).toContain(bocí)
    }
  })

  it('porta les tres dates i no les confon', async () => {
    // A la plantilla antiga el pagament i el resguard compartien data i se'ls
    // deia dies diferents. Han de sortir les dues, i diferents.
    const text = await textDelDocument(dades)
    expect(text).toContain('6 de novembre')
    expect(text).toContain('9 de novembre')
  })

  it('la frase de l’AMPA només hi surt si l’AMPA hi posa diners', async () => {
    expect(await textDelDocument(dades)).toContain("L'AMPA hi col")
    expect(await textDelDocument({ ...dades, ampa: false })).not.toContain("L'AMPA hi col")
  })

  it('genera un fitxer que s’obre', async () => {
    const buffer = await Packer.toBuffer(circularDocx(dades))
    // 'PK' és la signatura d'un zip, que és el que és un .docx per dins.
    expect(Buffer.from(buffer).subarray(0, 2).toString()).toBe('PK')
    expect(buffer.byteLength).toBeGreaterThan(10_000)   // amb el logo a dins
  })
})
```

- [ ] **Step 3: Executar-la i veure-la fallar**

Run: `npx vitest run src/modules/excursions/circular/document.test.ts`
Esperat: FAIL, el mòdul no existeix.

**Si un cop escrit el mòdul la primera prova falla perquè el text no es troba al binari**, no la rebaixis: descomprimeix el zip dins la prova (`fflate` ja pot estar al projecte; si no, mira-ho abans d'afegir cap dependència) i busca a `word/document.xml`. El que es comprova ha de continuar sent el mateix.

- [ ] **Step 4: Portar el generador**

Segueix els tres canvis de dalt. Afegeix, respecte del prototip:
- La **nota lliure** (`d.nota`), si n'hi ha, com un paràgraf al final del cos.
- Els textos configurables allà on el prototip els tenia escrits a dins.

- [ ] **Step 5: Executar-la i veure-la passar**

Run: `npx vitest run src/modules/excursions/circular/document.test.ts`
Esperat: PASS.

- [ ] **Step 6: Mirar-lo de debò**

Una prova diu que el text hi és, no que el document es vegi bé. Genera'n un i obre'l:

La manera més curta és una prova d'un sol ús que l'escrigui a disc. Crea
`src/modules/excursions/circular/mostra.test.ts`:

```ts
import { it } from 'vitest'
import { Packer } from 'docx'
import { writeFileSync } from 'node:fs'
import { circularDocx } from './document'
// Reaprofita l'objecte `dades` de document.test.ts: copia'l aquí.

it('escriu una mostra a /tmp', async () => {
  writeFileSync('/tmp/circular.docx', await Packer.toBuffer(circularDocx(dades)))
})
```

```bash
npx vitest run src/modules/excursions/circular/mostra.test.ts
open /tmp/circular.docx
rm src/modules/excursions/circular/mostra.test.ts
```

**Esborra el fitxer de mostra abans de fer el commit**: és una eina per mirar, no una prova.

Compara'l amb `Circular excursió - boceto.pdf`. **Han de ser el mateix document.** Si no ho són, digues en què es diferencien al teu informe en comptes d'arreglar-ho pel teu compte.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/modules/excursions/circular/document.ts src/modules/excursions/circular/document.test.ts
git commit -m "feat(circular): el document, portat del prototip aprovat"
```

---

### Task 7: A la pantalla

**Files:**
- Create: `src/modules/excursions/CircularAccions.tsx`
- Modify: `src/modules/excursions/ExcursioDetall.tsx`, `src/modules/excursions/useExcursions.ts`, `src/modules/excursions/types.ts`, `src/modules/excursions/excursions.utils.ts`

**Interfaces:**
- Consumes: tot l'anterior.
- Produces: a `Excursio`, els camps `DataCircular`, `DataLimitPagament`, `DataLimitResguard`, `CircularEnviadaPer` (tots `string | null`); i a l'store, `enviarCircular(id, dates)`.

- [ ] **Step 1: Portar els camps nous al tipus**

Com a la Fase B1: afegeix-los a `Excursio`, a `ExcursioRow` i a `rowToExcursio`. Són dates, no imports, així que no cal convertir-les a número; sí que cal deixar-les a `null` quan no hi són.

- [ ] **Step 2: Escriure el bloc de la circular**

`CircularAccions.tsx` rep l'excursió, les dates proposades i els permisos, i ensenya:

- **Les tres dates**, cadascuna en un camp editable, ja plenes amb la proposta. Sota cada camp, el dia de la setmana en lletra, perquè qui la canviï vegi de seguida si ha triat un dissabte.
- Un camp de **nota lliure** per a aquesta excursió.
- **Genera la circular** — construeix el `.docx` i el descarrega. Es pot fer tantes vegades com calgui, també abans d'enviar-la: és com es revisa.
- **Marca-la com a enviada** — crida `enviar_circular`, que desa les dates i canvia l'estat. **Aquest botó només surt si el preu està confirmat**, i si no ho està, digues per què en comptes d'amagar-lo sense explicació.

Si l'excursió ja està en `Circular enviada`, digues qui la va enviar i quan, i deixa que es torni a generar el document (Secretaria el pot necessitar una altra vegada) però no que es torni a enviar.

- [ ] **Step 3: Encaixar-ho a la fitxa**

A `ExcursioDetall.tsx`, per a qui compleixi `potGestionar`. Segueix el camí que ja fa servir el bloc econòmic per obtenir `config`, `rol` i `usuari`; no n'obris un de nou.

La descàrrega, amb `Packer.toBlob` i un `<a download>` temporal. **Carrega `docx` amb `import()` dinàmic dins la funció que genera**, no a dalt del fitxer: així la llibreria no entra al paquet de ningú que no generi cap circular.

- [ ] **Step 4: Passar totes les comprovacions**

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
```

Esperat: tot net. Mira quant ha crescut el paquet d'excursions i digues-ho a l'informe.

- [ ] **Step 5: Provar-ho al navegador**

```bash
npm run dev
```

Crea una excursió, aprova-la, confirma-li un preu i genera la circular. Obre el `.docx` i comprova que les dades són les de l'excursió i no les de cap exemple. Després marca-la com a enviada i mira que l'estat canviï i que el botó de confirmar preu ja no hi sigui.

- [ ] **Step 6: Commit**

```bash
git add src/modules/excursions/
git commit -m "feat(circular): generar-la i enviar-la des de la fitxa"
```

---

## Desplegament

Un cop fusionat, aplicar `202609220001_circular.sql` a producció i comprovar-ho amb una consulta, no només amb el «success»:

```sql
select column_name from information_schema.columns
 where table_name='excursions' and column_name like 'data_%' or column_name like 'circular_%';
select proname, pg_get_function_identity_arguments(oid)
  from pg_proc where proname='enviar_circular';
```

## Què queda per a la Fase B2b

La petició de pressupost als autocars: exportar l'Excel sense preus, tornar-lo a importar amb preus, la llista d'empreses a Configuració i el filtre de «pendents de pressupost» al pla del curs.
