# Base de Coneixement A — qui escriu i què hi ha dins

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Obrir la redacció d'articles a qui tingui una casella nova, deixant publicar només al coordinador, i distingir els quatre tipus de contingut amb caducitat obligatòria per als avisos.

**Architecture:** La regla «redacta però no publica» **no es pot fer amb una política de fila** —les de PostgreSQL són per fila, no per columna—, així que va amb privilegis per columna a les dues sentències (`insert` i `update`) més una funció `security definer` per publicar, i un disparador que hi torna a dir que no. Tota la lògica de llistar, agrupar i cercar viu en un mòdul pur; els components només el pinten.

**Tech Stack:** PostgreSQL 17 (Supabase), React 19 + TypeScript estricte, Zustand, Vitest amb PGlite per a les proves de base de dades.

**Spec:** `docs/superpowers/specs/2026-09-24-base-coneixement-design.md`

> **Abast:** aquest pla és la part **A** de tres. El Markdown (B) i les imatges (C) van a part i **no entren aquí**. El contingut continua sent text pla; com que el Markdown és text pla, res del que s'escrigui ara es perdrà.

## Global Constraints

- **Tot en català**: noms, comentaris, missatges i textos de pantalla.
- **Apòstrof tipogràfic `’` a tot el text de cara a l'usuari** —missatges, etiquetes, títols de prova— i **mai un apòstrof recte tancant una cadena de cometes simples**, que ja ha trencat la compilació dues vegades en aquest projecte. **Als comentaris de codi, l'apòstrof recte és la convenció del repositori** (`preu.ts` i `balanc.ts` en tenen) i **no és un defecte**: allà no hi ha cap cadena que es pugui tancar sense voler.
- **TypeScript estricte** (`verbatimModuleSyntax`, `noUnusedLocals`); tipus amb `import type`.
- **No hi ha proves de components**: Vitest corre amb `environment: 'node'`, sense DOM. Tota lògica provable viu en un mòdul pur, mai dins un `.tsx`.
- **`supabase/schema.sql` no es toca.** Els canvis d'esquema van en una migració nova.
- **`npx tsc --noEmit` compila zero fitxers** en aquest projecte: el `tsconfig.json` de l'arrel és només referències. La comprovació real és `npm run typecheck`.
- **Cap dada d'alumnat** entra enlloc.
- Mai `text-gray-400` per a text que s'hagi de llegir; text secundari, `text-gray-500`.

## Estructura de fitxers

| Fitxer | Responsabilitat |
|---|---|
| `supabase/migrations/202609240001_coneixement_redaccio.sql` **(nou)** | La casella, els tipus, la caducitat, els privilegis per columna, el disparador i la funció de publicar. |
| `tests/database.test.ts` **(modificar)** | Les proves de tot això contra PGlite. |
| `src/modules/coneixement/articles.ts` **(nou)** | Mòdul pur: vigents contra caducats, agrupació per tipus, cerca. |
| `src/modules/coneixement/articles.test.ts` **(nou)** | |
| `src/modules/coneixement/types.ts` **(modificar)** | `Tipus` i `CaducaEl`. |
| `src/modules/coneixement/useConeixement.ts` **(modificar)** | Llegir i escriure els camps nous; publicar per RPC. |
| `src/store/usuarisStore.ts` **(modificar)** | `PotRedactarConeixement` i el seu mètode. |
| `src/modules/usuaris/types.ts` **(modificar)** | El camp nou a `Usuari`. |
| `src/modules/configuracio/ConfiguracioPage.tsx` **(modificar)** | La casella a la fitxa de cada usuari. |
| `src/modules/coneixement/ConeixementForm.tsx` **(modificar)** | Triar tipus i data de caducitat. |
| `src/modules/coneixement/ConeixementPage.tsx` **(modificar)** | Filtre per tipus, entrada agrupada, botó de publicar. |

---

### Task 1: La migració i les seves proves

**Files:**
- Create: `supabase/migrations/202609240001_coneixement_redaccio.sql`
- Modify: `tests/database.test.ts` (afegir un `describe` al final)

**Interfaces:**
- Consumes: `app_private.email()`, `app_private.admin()`, `app_private.module_visible()`, que ja existeixen.
- Produces: la columna `usuaris.pot_redactar_coneixement`; `app_private.coneixement_redactor()`; les columnes `coneixement.tipus` i `coneixement.caduca_el`; la funció `public.publica_article(p_id uuid, p_publicat boolean)`.

**Context que et cal i que no pots endevinar:**

- Les polítiques d'avui es creen en un bucle a `supabase/migrations/202609130002_access.sql:75-89`, i per a `coneixement` totes quatre demanen `app_private.admin()`, que és exactament `rol = 'coordinador'`. La de lectura es torna a definir a la línia 92 com a `admin() or publicat`.
- **Substituir una política és `drop policy` i tornar-la a crear**, amb el mateix nom (`module_read`, `module_insert`, `module_update`, `module_delete`).
- El patró d'un ajudant que llegeix una casella d'`usuaris` és a `202609190001_excursions.sql:10-20`: `security definer`, `set search_path = ''`, i `coalesce((select … from public.usuaris where lower(email) = app_private.email()), false)`.
- **`module_visible` s'ha de redefinir**, com ja es va fer per a excursions a la mateixa migració: si no, algú amb la casella marcada però un rol sense visibilitat del mòdul no hi entraria.
- La taula ja té el disparador d'auditoria (`202609130002_access.sql:141`), que és per taula i agafa les columnes noves sol.
- Les proves de base de dades són a `tests/database.test.ts`, que carrega `supabase/schema.sql` i totes les migracions per ordre alfabètic a una PGlite. Mira com el fitxer fa `asUser(...)` i els `savepoint` abans d'escriure'n de noves.

- [ ] **Step 1: Escriu la migració**

Crea `supabase/migrations/202609240001_coneixement_redaccio.sql`:

```sql
begin;

-- Qui pot redactar articles. Es tria per persona i no per rol: qui sap
-- explicar una cosa no coincideix amb cap organigrama. Mateixa idea que
-- `pot_gestionar_excursions`.
alter table public.usuaris add column if not exists pot_redactar_coneixement boolean not null default false;

create or replace function app_private.coneixement_redactor() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select rol = 'coordinador' or pot_redactar_coneixement
    from public.usuaris where lower(email) = app_private.email()), false);
$$;

-- Sense això, algú amb la casella marcada però un rol que no veu el mòdul no
-- hi podria entrar a escriure. Mateix motiu que la redefinició d'excursions.
create or replace function app_private.module_visible(module_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare permissions jsonb; user_role text := app_private.role();
begin
  if user_role is null then return false; end if;
  if user_role = 'coordinador' then return true; end if;
  if module_name = 'material-infantil' and exists(select 1 from public.usuaris where lower(email)=app_private.email() and pot_gestionar_material) then return true; end if;
  if module_name = 'excursions' and exists(select 1 from public.usuaris where lower(email)=app_private.email()
    and (pot_gestionar_excursions or pot_gestionar_costos_excursions)) then return true; end if;
  if module_name = 'coneixement' and exists(select 1 from public.usuaris where lower(email)=app_private.email()
    and pot_redactar_coneixement) then return true; end if;
  select valors into permissions from public.config where clau = 'visibilitat.' || module_name;
  if permissions is null then
    permissions := case module_name
      when 'material-infantil' then '["coordinador"]'::jsonb
      else '["direccio","titular","cap_estudis","professorat","convidat"]'::jsonb end;
  end if;
  return permissions ? user_role;
end $$;

-- Els quatre tipus. El que hi va a dins no és tot la mateixa cosa, i
-- barrejar-ho és com moren aquestes bases.
alter table public.coneixement add column if not exists tipus text not null default 'pregunta';
alter table public.coneixement drop constraint if exists coneixement_tipus_check;
alter table public.coneixement add constraint coneixement_tipus_check
  check (tipus in ('pregunta','procediment','document','avis'));

-- `date` i no `text`: les dues dates que ja té la taula són text —ve de la
-- migració del full de càlcul— i comparar-hi és comparar cadenes. Amb això,
-- «ha caducat?» torna a ser una pregunta que la base de dades sap respondre.
alter table public.coneixement add column if not exists caduca_el date;

-- Un avís sense data seguiria al mig de la llista al juny; una pregunta amb
-- data caducaria sense motiu. Les dues coses alhora, en una sola regla.
alter table public.coneixement drop constraint if exists coneixement_caducitat_check;
alter table public.coneixement add constraint coneixement_caducitat_check
  check ((tipus = 'avis') = (caduca_el is not null));

-- Les quatre polítiques passen d'`admin()` a `coneixement_redactor()`, tret
-- d'esborrar: un redactor pot esborrar el que encara no s'ha publicat, i res més.
drop policy module_read on public.coneixement;
create policy module_read on public.coneixement for select to authenticated
using (app_private.module_visible('coneixement') and (app_private.coneixement_redactor() or publicat));

drop policy module_insert on public.coneixement;
create policy module_insert on public.coneixement for insert to authenticated
with check (app_private.module_visible('coneixement') and app_private.coneixement_redactor());

drop policy module_update on public.coneixement;
create policy module_update on public.coneixement for update to authenticated
using (app_private.module_visible('coneixement') and app_private.coneixement_redactor())
with check (app_private.module_visible('coneixement') and app_private.coneixement_redactor());

drop policy module_delete on public.coneixement;
create policy module_delete on public.coneixement for delete to authenticated
using (app_private.module_visible('coneixement')
  and (app_private.admin() or (app_private.coneixement_redactor() and not publicat)));

-- **Aquí és on es fa complir «redacta però no publica».** Les polítiques de
-- PostgreSQL són per fila: la de sobre deixa fer `update` a un redactor, i
-- amb això podria posar-se `publicat = true` ell mateix. I un privilegi
-- d'`insert` per taula cobreix **totes** les columnes, així que podria crear
-- l'article ja publicat — que és literalment el forat que es va trobar al
-- control de pagaments el 2026-09-23. Per això les **dues** sentències.
revoke insert, update on public.coneixement from authenticated;
grant insert (titol, tipus, categoria, contingut, tags, links, caduca_el) on public.coneixement to authenticated;
grant update (titol, tipus, categoria, contingut, tags, links, caduca_el) on public.coneixement to authenticated;

-- `autor`, `creat_el` i `actualitzat_el` els posa la base de dades: si els
-- escrivís el client, un redactor podria signar un article amb el nom d'un
-- altre. I `publicat` només es mou si qui escriu és el coordinador, que és la
-- segona tanca després dels privilegis per columna.
create or replace function app_private.coneixement_segell() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.autor := app_private.email();
    new.creat_el := to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD');
    if not app_private.admin() then new.publicat := false; end if;
  else
    new.autor := old.autor;
    new.creat_el := old.creat_el;
    if not app_private.admin() then new.publicat := old.publicat; end if;
  end if;
  new.actualitzat_el := to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD');
  return new;
end $$;

drop trigger if exists coneixement_segell on public.coneixement;
create trigger coneixement_segell before insert or update on public.coneixement
for each row execute function app_private.coneixement_segell();

-- Publicar és un acte a part, i només del coordinador.
create or replace function public.publica_article(p_id uuid, p_publicat boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (app_private.module_visible('coneixement') and app_private.admin()) then
    raise exception 'No autoritzat';
  end if;
  update public.coneixement set publicat = p_publicat, actualitzat_el = to_char(now() at time zone 'Europe/Madrid','YYYY-MM-DD')
   where id = p_id;
  if not found then raise exception 'Aquest article no existeix'; end if;
end;
$$;

revoke all on function public.publica_article(uuid, boolean) from public, anon, authenticated;
grant execute on function public.publica_article(uuid, boolean) to authenticated;

commit;
```

- [ ] **Step 2: Escriu les proves**

Afegeix al final de `tests/database.test.ts`. Mira abans com el fitxer defineix `asUser` i com dona d'alta usuaris de prova, i reaprofita'n el muntatge: hi ha d'haver un `redactor@stjosep.org` amb `pot_redactar_coneixement = true` i rol `professorat`.

```ts
describe('redactar la base de coneixement', () => {
  async function unArticle(publicat = false) {
    await asUser('admin@stjosep.org')
    const id = (await db.query<{id:string}>(`
      insert into public.coneixement(titol, tipus, categoria, contingut)
      values('Com es reserva el carro','procediment','Procediments','Primer...') returning id`)).rows[0].id
    if (publicat) await db.query('select public.publica_article($1, true)', [id])
    await db.exec('reset role')
    return id
  }
  const article = async (id: string) => (await db.query<{publicat:boolean; autor:string; tipus:string}>(
    'select publicat, autor, tipus from public.coneixement where id=$1', [id])).rows[0]

  it('un redactor pot crear un article', async () => {
    await asUser('redactor@stjosep.org')
    const id = (await db.query<{id:string}>(`
      insert into public.coneixement(titol, tipus, categoria, contingut)
      values('Qui obre el gimnàs','pregunta','Administratiu','El conserge.') returning id`)).rows[0].id
    expect((await article(id)).tipus).toBe('pregunta')
  })

  it('i li surt com a esborrany, encara que digui el contrari', async () => {
    // La prova que sosté tota la tasca: la política és per fila i el
    // deixaria escriure la columna sencera si no fos pels privilegis.
    await asUser('redactor@stjosep.org')
    await db.exec('savepoint intent')
    await expect(db.query(`
      insert into public.coneixement(titol, tipus, categoria, contingut, publicat)
      values('Trampa','pregunta','Administratiu','x', true)`)).rejects.toThrow('permission denied')
    await db.exec('rollback to savepoint intent')
    await db.exec('reset role')
  })

  it('ni tocant-ho després', async () => {
    const id = await unArticle()
    await asUser('redactor@stjosep.org')
    await db.exec('savepoint intent2')
    await expect(db.query('update public.coneixement set publicat=true where id=$1', [id]))
      .rejects.toThrow('permission denied')
    await db.exec('rollback to savepoint intent2')
    await db.exec('reset role')
    expect((await article(id)).publicat).toBe(false)
  })

  it('pot editar el text d’un article', async () => {
    const id = await unArticle()
    await asUser('redactor@stjosep.org')
    await db.query('update public.coneixement set contingut=$2 where id=$1', [id, 'Ara millor'])
    await db.exec('reset role')
    expect((await db.query<{contingut:string}>('select contingut from public.coneixement where id=$1',[id]))
      .rows[0].contingut).toBe('Ara millor')
  })

  it('l’autor el posa la base de dades, no qui escriu', async () => {
    await asUser('redactor@stjosep.org')
    const id = (await db.query<{id:string}>(`
      insert into public.coneixement(titol, tipus, categoria, contingut)
      values('Meu','pregunta','Administratiu','x') returning id`)).rows[0].id
    await db.exec('reset role')
    expect((await article(id)).autor).toBe('redactor@stjosep.org')
  })

  it('publicar és només del coordinador', async () => {
    const id = await unArticle()
    await asUser('redactor@stjosep.org')
    await expect(db.query('select public.publica_article($1, true)', [id])).rejects.toThrow('No autoritzat')
    await db.exec('reset role')
  })

  it('el coordinador sí', async () => {
    const id = await unArticle()
    await asUser('admin@stjosep.org')
    await db.query('select public.publica_article($1, true)', [id])
    await db.exec('reset role')
    expect((await article(id)).publicat).toBe(true)
  })

  it('un docent corrent només veu els publicats', async () => {
    const esborrany = await unArticle(false)
    const publicat = await unArticle(true)
    await asUser('teacher@stjosep.org')
    const vistos = (await db.query<{id:string}>('select id from public.coneixement')).rows.map((r) => r.id)
    await db.exec('reset role')
    expect(vistos).toContain(publicat)
    expect(vistos).not.toContain(esborrany)
  })

  it('i el redactor veu també els esborranys', async () => {
    const esborrany = await unArticle(false)
    await asUser('redactor@stjosep.org')
    const vistos = (await db.query<{id:string}>('select id from public.coneixement')).rows.map((r) => r.id)
    await db.exec('reset role')
    expect(vistos).toContain(esborrany)
  })

  it('un redactor pot esborrar un esborrany però no un article publicat', async () => {
    const esborrany = await unArticle(false)
    const publicat = await unArticle(true)
    await asUser('redactor@stjosep.org')
    expect((await db.query('delete from public.coneixement where id=$1 returning id',[esborrany])).rows)
      .toHaveLength(1)
    expect((await db.query('delete from public.coneixement where id=$1 returning id',[publicat])).rows)
      .toHaveLength(0)
    await db.exec('reset role')
  })

  it('un avís sense data de caducitat no s’hi pot desar', async () => {
    // Sense això, l'avís del gener continua al mig de la llista al juny.
    await asUser('admin@stjosep.org')
    await db.exec('savepoint intent3')
    await expect(db.query(`
      insert into public.coneixement(titol, tipus, categoria, contingut)
      values('Novetat','avis','Administratiu','x')`)).rejects.toThrow()
    await db.exec('rollback to savepoint intent3')
    await db.exec('reset role')
  })

  it('i una pregunta amb data, tampoc', async () => {
    await asUser('admin@stjosep.org')
    await db.exec('savepoint intent4')
    await expect(db.query(`
      insert into public.coneixement(titol, tipus, categoria, contingut, caduca_el)
      values('Pregunta','pregunta','Administratiu','x','2027-01-01')`)).rejects.toThrow()
    await db.exec('rollback to savepoint intent4')
    await db.exec('reset role')
  })

  it('un tipus que no existeix es rebutja', async () => {
    await asUser('admin@stjosep.org')
    await db.exec('savepoint intent5')
    await expect(db.query(`
      insert into public.coneixement(titol, tipus, categoria, contingut)
      values('X','apunt','Administratiu','x')`)).rejects.toThrow()
    await db.exec('rollback to savepoint intent5')
    await db.exec('reset role')
  })

  it('qui té la casella veu el mòdul encara que el seu rol no li’n doni', async () => {
    await db.query(`update public.config set valors='["coordinador"]'::jsonb where clau='visibilitat.coneixement'`)
    await asUser('redactor@stjosep.org')
    const visible = (await db.query<{v:boolean}>(`select app_private.module_visible('coneixement') as v`)).rows[0].v
    await db.exec('reset role')
    expect(visible).toBe(true)
  })
})
```

- [ ] **Step 3: Executa-les**

Run: `npx vitest run tests/database.test.ts`
Expected: PASS. Si `asUser` o el muntatge dels usuaris de prova no encaixen, adapta't al que hi hagi al fitxer — **no canviïs el que les proves afirmen**.

- [ ] **Step 4: Comprova amb dues mutacions que les proves proven alguna cosa**

1. Treu del `grant insert (...)` la llista de columnes i posa-hi `grant insert on public.coneixement to authenticated`. Ha de fallar «i li surt com a esborrany, encara que digui el contrari». Desfés-ho.
2. Treu el `coneixement_caducitat_check`. Han de fallar les dues proves dels avisos. Desfés-ho.

Digues a l'informe què va passar exactament a cadascuna.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609240001_coneixement_redaccio.sql tests/database.test.ts
git commit -m "feat(coneixement): qui redacta, qui publica, i els quatre tipus"
```

---

### Task 2: El mòdul pur que decideix què es veu

**Files:**
- Create: `src/modules/coneixement/articles.ts`
- Test: `src/modules/coneixement/articles.test.ts`

**Interfaces:**
- Consumes: res del projecte. Defineix les seves pròpies entrades, com fan `preu.ts` i `balanc.ts`.
- Produces: `TipusArticle`, `ArticleLlista`, `ArticleDesat`, `esVigent(a, avui): boolean`, `agrupaPerTipus(articles, avui): GrupsArticles`, `cerca(articles, text): ArticleLlista[]`, `aLlista(a: ArticleDesat): ArticleLlista`.

**Restriccions:**

- **No importa res del projecte.** És on es decideix què veu el claustre i s'ha de poder provar sense pantalla ni base de dades.
- **Cap funció mira el rellotge**: `avui` entra sempre com a argument (ISO `YYYY-MM-DD`).

- [ ] **Step 1: Escriu les proves que fallen**

Crea `src/modules/coneixement/articles.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { esVigent, agrupaPerTipus, cerca, type ArticleLlista } from './articles'

const AVUI = '2026-09-24'

function art(canvis: Partial<ArticleLlista> = {}): ArticleLlista {
  return {
    id: 'a1', titol: 'Com es reserva el carro', tipus: 'procediment',
    categoria: 'Procediments', contingut: 'Primer entres a Reserves.',
    tags: ['carro', 'portàtils'], caducaEl: null, publicat: true,
    ...canvis,
  }
}

describe('si un article encara val', () => {
  it('el que no caduca, sempre', () => {
    expect(esVigent(art(), AVUI)).toBe(true)
  })

  it('un avís amb la data per venir, sí', () => {
    expect(esVigent(art({ tipus: 'avis', caducaEl: '2026-12-31' }), AVUI)).toBe(true)
  })

  it('un avís que caduca avui encara val', () => {
    // El dia que caduca és l'últim que serveix, no el primer que no.
    expect(esVigent(art({ tipus: 'avis', caducaEl: AVUI }), AVUI)).toBe(true)
  })

  it('un avís d’ahir, no', () => {
    expect(esVigent(art({ tipus: 'avis', caducaEl: '2026-09-23' }), AVUI)).toBe(false)
  })
})

describe('agrupar per a la pantalla', () => {
  const tots = [
    art({ id: 'p1', tipus: 'pregunta', titol: 'Qui obre el gimnàs' }),
    art({ id: 'pr1', tipus: 'procediment' }),
    art({ id: 'd1', tipus: 'document', titol: 'Protocol d’absentisme' }),
    art({ id: 'av1', tipus: 'avis', titol: 'Novetat', caducaEl: '2026-12-31' }),
    art({ id: 'av2', tipus: 'avis', titol: 'Vella', caducaEl: '2026-01-01' }),
  ]

  it('cada tipus al seu lloc', () => {
    const g = agrupaPerTipus(tots, AVUI)
    expect(g.preguntes.map((a) => a.id)).toEqual(['p1'])
    expect(g.procediments.map((a) => a.id)).toEqual(['pr1'])
    expect(g.documents.map((a) => a.id)).toEqual(['d1'])
  })

  it('els avisos vigents van a part dels caducats', () => {
    const g = agrupaPerTipus(tots, AVUI)
    expect(g.avisos.map((a) => a.id)).toEqual(['av1'])
    expect(g.caducats.map((a) => a.id)).toEqual(['av2'])
  })

  it('un avís caducat no surt entre els vigents encara que hi hagi molts', () => {
    const g = agrupaPerTipus([art({ id: 'x', tipus: 'avis', caducaEl: '2020-01-01' })], AVUI)
    expect(g.avisos).toEqual([])
    expect(g.caducats.map((a) => a.id)).toEqual(['x'])
  })

  it('cap article es perd pel camí', () => {
    const g = agrupaPerTipus(tots, AVUI)
    const total = g.preguntes.length + g.procediments.length + g.documents.length
      + g.avisos.length + g.caducats.length
    expect(total).toBe(tots.length)
  })
})

describe('cercar', () => {
  const tots = [
    art({ id: 'a', titol: 'Com es reserva el carro', contingut: 'Primer entres a Reserves.', tags: ['carro'] }),
    art({ id: 'b', titol: 'Qui obre el gimnàs', contingut: 'El conserge, a les vuit.', tags: ['gimnàs'] }),
  ]

  it('sense text, tots', () => {
    expect(cerca(tots, '').map((a) => a.id)).toEqual(['a', 'b'])
  })

  it('pel títol', () => {
    expect(cerca(tots, 'gimnàs').map((a) => a.id)).toEqual(['b'])
  })

  it('per l’etiqueta', () => {
    expect(cerca(tots, 'carro').map((a) => a.id)).toEqual(['a'])
  })

  it('i **pel contingut**, que és el que ara no fa', () => {
    // Quan busques, el que recordes sol ser una paraula de dins, no el títol.
    expect(cerca(tots, 'conserge').map((a) => a.id)).toEqual(['b'])
  })

  it('sense accents i sense majúscules', () => {
    expect(cerca(tots, 'GIMNAS').map((a) => a.id)).toEqual(['b'])
  })

  it('el que no hi és, no hi surt', () => {
    expect(cerca(tots, 'piscina')).toEqual([])
  })
})
```

- [ ] **Step 2: Executa-les i comprova que fallen**

Run: `npx vitest run src/modules/coneixement/articles.test.ts`
Expected: FAIL — el mòdul `./articles` no existeix.

- [ ] **Step 3: Escriu `articles.ts`**

```ts
// src/modules/coneixement/articles.ts
//
// Què veu el claustre i en quin ordre. Aïllat de tota la resta a propòsit:
// és la part que decideix si una cosa es troba o no, i s'ha de poder provar
// sense muntar ni pantalla ni base de dades.

export type TipusArticle = 'pregunta' | 'procediment' | 'document' | 'avis'

export interface ArticleLlista {
  id: string
  titol: string
  tipus: TipusArticle
  categoria: string
  contingut: string
  tags: string[]
  /** Només els avisos en tenen. ISO `YYYY-MM-DD`. */
  caducaEl: string | null
  publicat: boolean
}

export interface GrupsArticles {
  avisos: ArticleLlista[]
  preguntes: ArticleLlista[]
  procediments: ArticleLlista[]
  documents: ArticleLlista[]
  /** Els avisos que ja han passat. No s'esborren: deixen d'ocupar el lloc. */
  caducats: ArticleLlista[]
}

/**
 * El dia que caduca encara val: és l'últim dia que serveix, no el primer que
 * no. Les dates són ISO, així que comparar-les com a cadenes és correcte.
 */
export function esVigent(a: ArticleLlista, avui: string): boolean {
  return a.caducaEl === null || a.caducaEl >= avui
}

export function agrupaPerTipus(articles: ArticleLlista[], avui: string): GrupsArticles {
  const g: GrupsArticles = { avisos: [], preguntes: [], procediments: [], documents: [], caducats: [] }
  for (const a of articles) {
    if (a.tipus === 'avis') {
      // Un avís del gener al mig de la llista al juny fa que algú s'hi fiï i
      // que a partir d'aquell dia no torni. Per això surt de la llista, però
      // no s'esborra: va passar, i de vegades cal recordar quan.
      (esVigent(a, avui) ? g.avisos : g.caducats).push(a)
      continue
    }
    if (a.tipus === 'pregunta') g.preguntes.push(a)
    else if (a.tipus === 'procediment') g.procediments.push(a)
    else g.documents.push(a)
  }
  return g
}

/** Sense accents i sense majúscules: qui busca no els encerta. */
function clau(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

export function cerca(articles: ArticleLlista[], text: string): ArticleLlista[] {
  const q = clau(text.trim())
  if (q === '') return articles
  // També dins el contingut: quan busques, el que recordes sol ser una
  // paraula de dins i no pas el títol, que és el que fins ara es mirava.
  return articles.filter((a) =>
    clau(a.titol).includes(q) || clau(a.contingut).includes(q) ||
    a.tags.some((t) => clau(t).includes(q)))
}
```

- [ ] **Step 4: El pas de l'article desat a l'article de la llista**

El hook torna articles amb **la forma heretada del full de càlcul** —`Tags` és una cadena separada per comes, `Publicat` és `'true'` en text— i `ArticleLlista` no. Aquesta conversió és lògica, i per tant no pot viure al component.

Va aquí, i **sense importar res**: TypeScript és estructural, així que declarar la forma d'entrada en local n'hi ha prou perquè hi encaixi el que el hook dona.

```ts
/** La forma que té un article tal com el torna el hook, heretada del full de càlcul. */
export interface ArticleDesat {
  id: string
  Titol: string
  Tipus: TipusArticle
  Categoria: string
  Contingut: string
  /** Separades per comes. */
  Tags: string
  CaducaEl: string | null
  /** `'true'` o `'false'`, en text. */
  Publicat: string
}

export function aLlista(a: ArticleDesat): ArticleLlista {
  return {
    id: a.id, titol: a.Titol, tipus: a.Tipus, categoria: a.Categoria,
    contingut: a.Contingut,
    tags: a.Tags.split(',').map((t) => t.trim()).filter(Boolean),
    caducaEl: a.CaducaEl,
    publicat: a.Publicat === 'true',
  }
}
```

Amb les seves proves, al mateix fitxer:

```ts
describe('passar de l’article desat al de la llista', () => {
  const desat = {
    id: 'a1', Titol: 'Com es reserva el carro', Tipus: 'procediment' as const,
    Categoria: 'Procediments', Contingut: 'Primer...', Tags: 'carro, portàtils',
    CaducaEl: null, Publicat: 'true',
  }

  it('les etiquetes passen de cadena a llista', () => {
    expect(aLlista(desat).tags).toEqual(['carro', 'portàtils'])
  })

  it('sense etiquetes, una llista buida i no una amb una cadena buida', () => {
    expect(aLlista({ ...desat, Tags: '' }).tags).toEqual([])
  })

  it('el publicat passa de text a booleà', () => {
    expect(aLlista(desat).publicat).toBe(true)
    expect(aLlista({ ...desat, Publicat: 'false' }).publicat).toBe(false)
  })
})
```

Recorda afegir `aLlista` i `ArticleDesat` a l'`import` del capçal del fitxer de proves.

- [ ] **Step 5: Executa i comprova que passen**

Run: `npx vitest run src/modules/coneixement/articles.test.ts`
Expected: PASS, 17 proves.

- [ ] **Step 6: Comprova amb una mutació**

Fes que `esVigent` torni sempre `true`. Han de fallar les proves dels avisos caducats. Desfés-ho i digues què va passar.

- [ ] **Step 7: Commit**

```bash
git add src/modules/coneixement/articles.ts src/modules/coneixement/articles.test.ts
git commit -m "feat(coneixement): què es veu, agrupat per tipus i amb els avisos que caduquen"
```

---

### Task 3: La casella a la fitxa de l'usuari

**Files:**
- Modify: `src/modules/usuaris/types.ts`
- Modify: `src/store/usuarisStore.ts`
- Modify: `src/modules/configuracio/ConfiguracioPage.tsx`
- Modify: `src/modules/usuaris/excelImport.utils.test.ts` (si construeix `Usuari` sencers)

**Interfaces:**
- Consumes: la columna `usuaris.pot_redactar_coneixement` de la Task 1.
- Produces: `Usuari.PotRedactarConeixement: boolean` i `useUsuarisStore().updatePotRedactarConeixement(usuari, valor)`.

**Context que et cal:**

- El patró sencer ja existeix per a `pot_gestionar_excursions`. Segueix-lo als quatre llocs: el camp a `Usuari` (`src/modules/usuaris/types.ts:14`), el mapatge de la fila a `src/store/usuarisStore.ts:44`, el mètode a `src/store/usuarisStore.ts:176`, i la casella a la fitxa dins `ConeixementRow`… **no**: el component es diu `UsuariRow` i és a `src/modules/configuracio/ConfiguracioPage.tsx:252`.
- **Comprova si alguna prova construeix un `Usuari` sencer** abans de començar: `src/modules/usuaris/excelImport.utils.test.ts:16` en construeix, i afegir un camp obligatori la trencaria.
- L'etiqueta de la casella: **«Pot redactar la Base de Coneixement»**, i a sota, en petit, «Escriu esborranys; publicar-los continua sent del coordinador.»

- [ ] **Step 1: Afegeix el camp i el mètode**

A `src/modules/usuaris/types.ts`, al costat de `PotGestionarExcursions`:

```ts
  PotRedactarConeixement: boolean
```

A `src/store/usuarisStore.ts`, al mapatge de la fila:

```ts
    PotRedactarConeixement: row.pot_redactar_coneixement ?? false,
```

I el mètode, a joc amb `updatePotGestionarExcursions`:

```ts
  async updatePotRedactarConeixement(usuari, valor) {
    await updateRowById(TABLE, usuari.id, { pot_redactar_coneixement: valor })
    set((s) => ({
      usuaris: s.usuaris.map((u) => (u.id === usuari.id ? { ...u, PotRedactarConeixement: valor } : u)),
    }))
  },
```

més la seva línia a la interfície de l'estat.

- [ ] **Step 2: La casella a la pantalla**

A `UsuariRow` de `src/modules/configuracio/ConfiguracioPage.tsx`, al costat de les caselles d'excursions i seguint-ne exactament l'estructura (el seu propi indicador de desat, com fa `savingExcursions`).

- [ ] **Step 3: Portes**

Run: `npm run lint && npm run typecheck && npm test`
Expected: tot verd. Informa del nombre de **fitxers** de prova, no només del de proves.

- [ ] **Step 4: Commit**

```bash
git add src/modules/usuaris/types.ts src/store/usuarisStore.ts src/modules/configuracio/ConfiguracioPage.tsx src/modules/usuaris/excelImport.utils.test.ts
git commit -m "feat(coneixement): la casella de qui pot redactar"
```

---

### Task 4: Els camps nous al formulari i al client

**Files:**
- Modify: `src/modules/coneixement/types.ts`
- Modify: `src/modules/coneixement/useConeixement.ts`
- Modify: `src/modules/coneixement/ConeixementForm.tsx`

**Interfaces:**
- Consumes: `TipusArticle` de `./articles` (Task 2); `publica_article` de la Task 1.
- Produces: `Article.Tipus: TipusArticle`, `Article.CaducaEl: string | null`, i `publica(id: string, publicat: boolean): Promise<void>` al hook.

**Context que et cal i que no pots endevinar:**

- `useConeixement` **no és un store de Zustand**: és un hook amb `useState`/`useEffect`. No el converteixis; només afegeix-hi el que cal.
- Els tipus d'aquest mòdul són **estranys i heretats** del full de càlcul: `Tags` és una cadena separada per comes, `Links` és JSON en una cadena, i `Publicat` és `'true' | 'false'` en text. **No els arreglis en aquesta tasca**: és un canvi transversal que mereix la seva pròpia, i barrejar-lo aquí faria irrevisable el que sí que importa. Afegeix `Tipus` i `CaducaEl` com a camps normals i prou.
- **El client ja no pot escriure `publicat`, `autor`, `creat_el` ni `actualitzat_el`**: la Task 1 n'ha retirat el privilegi i els posa un disparador. Si el hook els envia en un `insert` o un `update`, el servidor el rebutjarà amb «permission denied». Treu-los de tots dos camins.
- Per publicar, `callRpc` de `src/services/db.ts`, amb `{ p_id, p_publicat }`.

- [ ] **Step 1: Els tipus**

A `src/modules/coneixement/types.ts`, a `Article` i a `ArticleFormData`:

```ts
  Tipus: TipusArticle
  /** Només els avisos. ISO `YYYY-MM-DD`. */
  CaducaEl: string | null
```

`ArticleFormData` **perd `Publicat`**: el formulari ja no el decideix.

- [ ] **Step 2: El hook**

Llegir els dos camps nous a `rowToArticle`, enviar-los a crear i a editar, treure'n els quatre que ja no es poden escriure, i afegir-hi:

```ts
  const publica = useCallback(async (id: string, publicat: boolean) => {
    await callRpc('publica_article', { p_id: id, p_publicat: publicat })
    await carrega()
  }, [carrega])
```

(el nom real de la funció de recàrrega el veuràs al fitxer; fes servir el que hi hagi).

- [ ] **Step 3: El formulari**

- Un selector de **tipus** amb les quatre etiquetes en català: «Pregunta», «Com es fa», «Document» i «Avís».
- Un camp de **data de caducitat** que **només surt quan el tipus és avís**, i que és **obligatori** en aquell cas. Si es canvia el tipus d'avís a un altre, la data s'ha de buidar, o la base de dades rebutjarà el desat per la regla `(tipus = 'avis') = (caduca_el is not null)`.
- Treu del formulari la casella de publicar, si n'hi ha cap.

- [ ] **Step 4: Portes**

Run: `npm run lint && npm run typecheck && npm test`

- [ ] **Step 5: Commit**

```bash
git add src/modules/coneixement/
git commit -m "feat(coneixement): triar el tipus i la caducitat dels avisos"
```

---

### Task 5: La pantalla

**Files:**
- Modify: `src/modules/coneixement/ConeixementPage.tsx`

**Interfaces:**
- Consumes: `agrupaPerTipus`, `cerca`, `aLlista`, `TipusArticle` de `./articles`; `publica` del hook (Task 4). **El pas de la forma heretada a `ArticleLlista` el fa `aLlista`, no el component.**

**Restriccions:**

- **Cap lògica nova dins el `.tsx`.** Agrupar, filtrar i cercar ja viuen a `articles.ts`. Si et sembla que en cal una de nova, **atura't i digues-m'ho**.
- `avui` es calcula **al component** i entra com a argument: cap funció d'`articles.ts` mira el rellotge.

- [ ] **Step 1: L'entrada agrupada**

De dalt a baix: **els avisos vigents**, després **les preguntes en llista desplegable** (vint preguntes en targetes no es llegeixen; en llista, sí), després **els procediments en targetes** com ara, i després **els documents**. Els **caducats** al final, plegats, sota una línia que digui quants n'hi ha.

- [ ] **Step 2: El filtre i el cercador**

Un filtre per tipus al costat del cercador que ja hi ha, i que el cercador passi per `cerca(...)`, que ara també mira dins el contingut.

- [ ] **Step 3: Publicar**

A la targeta o a la fitxa d'un esborrany, un botó **«Publica»** visible **només per al coordinador**, que crida `publica(id, true)`. I a un de publicat, «Retira», que crida `publica(id, false)`. Qui redacta sense ser coordinador ha de veure l'estiqueta d'esborrany però **cap dels dos botons**.

- [ ] **Step 4: Portes senceres**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Informa del nombre de **fitxers** de prova.

- [ ] **Step 5: Commit**

```bash
git add src/modules/coneixement/ConeixementPage.tsx
git commit -m "feat(coneixement): l'entrada per tipus, el filtre i publicar"
```

---

## Desplegament

Cal aplicar `202609240001_coneixement_redaccio.sql` a producció i comprovar-ho amb consultes, no amb el «success». **La clausura té dues meitats i mirar-ne una sola diria que tot va bé amb l'altra oberta** — és el mateix error que va deixar obert el forat del control de pagaments:

```sql
select privilege_type, string_agg(column_name, ', ' order by column_name) as columnes
  from information_schema.column_privileges
 where table_name='coneixement' and grantee='authenticated'
   and privilege_type in ('INSERT','UPDATE')
 group by privilege_type;
```

Esperat: a totes dues, `caduca_el, categoria, contingut, links, tags, tipus, titol`. **A cap de les dues hi ha de sortir `publicat`**, ni `autor`, ni `creat_el`, ni `actualitzat_el`, ni `codi`.

I que el privilegi de taula hagi desaparegut, que és el que les cobria totes:

```sql
select privilege_type from information_schema.role_table_grants
 where table_name='coneixement' and grantee='authenticated' order by 1;
```

Esperat: només `DELETE` i `SELECT`.

## Comprovació manual abans de fusionar

1. Marca la casella a una persona que **no** sigui coordinadora i entra-hi: ha de poder crear un article i veure'l com a esborrany, **sense cap botó de publicar**.
2. Amb aquella sessió, prova de publicar-lo des de la consola del navegador amb un `update` directe: ha de fallar.
3. Com a coordinador, publica'l, i comprova amb un tercer compte sense la casella que ara sí que el veu.
4. Crea un avís amb data d'ahir: ha de sortir a l'apartat de caducats i no a la llista.
5. Busca una paraula que només surti **dins** d'un article: ha de trobar-lo.

## Després d'això

**Repensar les categories** (`coneixement.categories` a Configuració). Les d'avui —Procediments, Infraestructura, Dispositius, Incidències freqüents, Administratiu— són d'una base de coneixement de TIC, que és per al que es va construir el mòdul. Si ara hi busca el claustre, no encaixen, i tot acabarà a «Administratiu». Les posa el centre, no el codi.

I la reordenació pendent del menú lateral ha de posar **Base Coneixement a «Dia a dia»**, no a «Gestió TIC».

## Què no entra

El Markdown (part B); les imatges i el bucket de Storage (part C); que el claustre pregunti o comenti; historial de versions; i arreglar els tipus heretats del full de càlcul (`Tags` com a cadena, `Links` com a JSON en text, `Publicat` com a `'true'`).
