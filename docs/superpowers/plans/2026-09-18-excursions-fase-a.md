# Excursions — Fase A (el circuit) — Pla d'implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el professorat proposi les excursions del curs en un sol lloc, que Direcció les aprovi i que tothom en vegi l'estat, sense tocar diners.

**Architecture:** Una taula `excursions` amb dues filles (grups i acompanyants). La màquina d'estats i els camps d'auditoria els imposa **un disparador de base de dades**, no el client: així la regla es compleix encara que algú escrigui directament contra l'API. És el mateix patró que `app_private.validate_schedule()` a Horaris. El client és una pantalla de llista, un formulari i una fitxa, amb un store de Zustand com els altres mòduls.

**Tech Stack:** PostgreSQL (Supabase) amb RLS · React 19 + TypeScript estricte · Zustand · Tailwind · Vitest + PGlite.

**Spec:** `docs/superpowers/specs/2026-09-18-excursions-design.md`

## Global Constraints

- **Idioma:** tot el text visible i els comentaris, en **català**. Els missatges d'error també.
- **TypeScript estricte** amb `verbatimModuleSyntax` (els tipus s'importen amb `import type`), `noUnusedLocals` i `noUnusedParameters`.
- **Cap lògica de permisos només al client.** Tota regla ha de quedar imposada per RLS o pel disparador; el client només evita oferir accions que el servidor rebutjaria.
- **Etapes** (valors exactes): `EI`, `EP`, `ESO 1r-2n`, `ESO 3r-4t`, `BATX`, `GM`.
- **Estats** (valors exactes): `Esborrany`, `Proposada`, `Aprovada`, `Reservada`, `Circular enviada`, `Cancel·lada`. La Fase A implementa fins a `Reservada`; `Circular enviada` és de la Fase B i el seu valor ja existeix a la restricció perquè després no calgui alterar-la.
- **Transport** (valors exactes): `autocar`, `altres`.
- **Res de diners en aquesta fase.** Cap camp de cost, preu, AMPA ni marge. Les taules `excursio_finances` i `excursio_autocars` són de la Fase B.
- **Ordre dels fitxers de migració:** el següent lliure és `202609190001_excursions.sql`.
- Abans de cada `commit`: `npm run lint` i `npm test` han de passar.

---

### Task 1: Taules, permisos i RLS

**Files:**
- Create: `supabase/migrations/202609190001_excursions.sql`
- Modify: `supabase/schema.sql` (afegir les taules noves al final, perquè serveixi per a una base nova)
- Test: `tests/database.test.ts`

**Interfaces:**
- Consumes: `app_private.email()`, `app_private.creator()`, `app_private.approver()`, `app_private.module_visible()`, `app_private.school_year()`, `public.format_code()` — ja existeixen.
- Produces: taules `public.excursions`, `public.excursio_grups`, `public.excursio_acompanyants`; funcions `app_private.excursions_costos()` i `app_private.excursions_gestio()`; columnes `usuaris.pot_gestionar_excursions` i `usuaris.pot_gestionar_costos_excursions`.

- [ ] **Step 1: Escriu la migració**

Crea `supabase/migrations/202609190001_excursions.sql`:

```sql
begin;

-- Dos permisos i no un: amb un de sol no es podria distingir Secretaria, que
-- negocia amb les empreses i ha de veure els costos, d'un docent a qui
-- s'activi la gestió per ajudar a organitzar, que no els ha de veure.
alter table public.usuaris add column pot_gestionar_excursions boolean not null default false;
alter table public.usuaris add column pot_gestionar_costos_excursions boolean not null default false;

create or replace function app_private.excursions_costos() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select rol in ('coordinador','direccio','titular') or pot_gestionar_costos_excursions
    from public.usuaris where lower(email) = app_private.email()), false);
$$;

create or replace function app_private.excursions_gestio() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select rol in ('coordinador','direccio','titular')
      or pot_gestionar_costos_excursions or pot_gestionar_excursions
    from public.usuaris where lower(email) = app_private.email()), false);
$$;

create sequence public.excursions_codi_seq;

create table public.excursions (
  id uuid primary key default gen_random_uuid(),
  codi text not null unique default public.format_code('EXC', nextval('public.excursions_codi_seq')),
  curs_escolar text not null default app_private.school_year(current_date),
  estat text not null default 'Esborrany'
    check (estat in ('Esborrany','Proposada','Aprovada','Reservada','Circular enviada','Cancel·lada')),
  etapa text not null check (etapa in ('EI','EP','ESO 1r-2n','ESO 3r-4t','BATX','GM')),
  lloc text not null default '',
  poblacio text not null default '',
  activitat text not null default '',
  data date,
  hora_sortida text not null default '',
  hora_tornada text not null default '',
  transport text not null default 'autocar' check (transport in ('autocar','altres')),
  transport_detall text not null default '',
  acompanyants_externs integer not null default 0 check (acompanyants_externs >= 0),
  observacions text not null default '',
  responsable text not null default '',
  proposada_per text, proposada_el timestamptz,
  aprovada_per text, aprovada_el timestamptz, motiu_rebuig text,
  reservada_per text, reservada_el timestamptz,
  cancellada_per text, cancellada_el timestamptz, motiu_cancellacio text,
  creat_el timestamptz not null default now(),
  creat_per text not null default ''
);
create index excursions_curs_idx on public.excursions(curs_escolar, data);

create table public.excursio_grups (
  id uuid primary key default gen_random_uuid(),
  excursio_id uuid not null references public.excursions(id) on delete cascade,
  grup text not null,
  alumnes_previstos integer not null default 0 check (alumnes_previstos >= 0),
  alumnes_finals integer check (alumnes_finals is null or alumnes_finals >= 0),
  unique (excursio_id, grup)
);
-- `alumnes_finals` es crea ara però **a la Fase A no l'edita ningú**: serveix per al
-- control d'aforo i el tancament, que són de la Fase B. Es deixa feta la columna
-- per no haver de migrar la taula més endavant.

create table public.excursio_acompanyants (
  id uuid primary key default gen_random_uuid(),
  excursio_id uuid not null references public.excursions(id) on delete cascade,
  email text not null,
  unique (excursio_id, email)
);

alter table public.excursions enable row level security;
alter table public.excursio_grups enable row level security;
alter table public.excursio_acompanyants enable row level security;

-- Tothom qui veu el mòdul veu tot el pla: la transparència és precisament la
-- solució al problema de "ningú sap en quin estat està".
create policy excursions_read on public.excursions for select to authenticated
using (app_private.module_visible('excursions'));

-- Qui proposa pot editar la seva excursió només mentre és un esborrany.
create policy excursions_propi on public.excursions for all to authenticated
using (app_private.module_visible('excursions') and app_private.creator()
  and creat_per = app_private.email() and estat = 'Esborrany')
with check (app_private.module_visible('excursions') and app_private.creator()
  and creat_per = app_private.email() and estat = 'Esborrany');

create policy excursions_gestio on public.excursions for all to authenticated
using (app_private.module_visible('excursions') and app_private.excursions_gestio())
with check (app_private.module_visible('excursions') and app_private.excursions_gestio());

-- Les filles hereten qui les pot tocar de l'excursió a què pertanyen.
create policy excursio_grups_read on public.excursio_grups for select to authenticated
using (app_private.module_visible('excursions'));
create policy excursio_grups_write on public.excursio_grups for all to authenticated
using (exists(select 1 from public.excursions e where e.id = excursio_id
  and app_private.module_visible('excursions')
  and (app_private.excursions_gestio()
    or (app_private.creator() and e.creat_per = app_private.email() and e.estat = 'Esborrany'))))
with check (exists(select 1 from public.excursions e where e.id = excursio_id
  and app_private.module_visible('excursions')
  and (app_private.excursions_gestio()
    or (app_private.creator() and e.creat_per = app_private.email() and e.estat = 'Esborrany'))));

create policy excursio_acompanyants_read on public.excursio_acompanyants for select to authenticated
using (app_private.module_visible('excursions'));
create policy excursio_acompanyants_write on public.excursio_acompanyants for all to authenticated
using (exists(select 1 from public.excursions e where e.id = excursio_id
  and app_private.module_visible('excursions')
  and (app_private.excursions_gestio()
    or (app_private.creator() and e.creat_per = app_private.email() and e.estat = 'Esborrany'))))
with check (exists(select 1 from public.excursions e where e.id = excursio_id
  and app_private.module_visible('excursions')
  and (app_private.excursions_gestio()
    or (app_private.creator() and e.creat_per = app_private.email() and e.estat = 'Esborrany'))));

-- Les polítiques filtren files, però no donen permís sobre la taula: són dues
-- coses diferents i totes dues calen. Es fa com a la migració d'accés.
do $$ declare t text; begin
  foreach t in array array['excursions','excursio_grups','excursio_acompanyants'] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function app_private.audit_change()', t);
  end loop;
end $$;
-- El `grant on all sequences` de la migració d'accés ja s'havia executat quan
-- aquesta seqüència no existia, així que li cal el seu.
grant usage, select on sequence public.excursions_codi_seq to authenticated;

commit;
```

**Cal redefinir `app_private.module_visible`** dins d'aquesta mateixa migració, afegint-hi dues coses: un valor per defecte per a `excursions` sense el convidat (si no, cau al genèric, que sí l'inclou), i que qui tingui qualsevol de les dues caselles vegi el mòdul encara que el seu rol no li hi doni accés, perquè **Secretaria no és professorat**. Copia la funció de `supabase/migrations/202609130002_access.sql` i afegeix-hi:

```sql
  if module_name = 'excursions' and exists(select 1 from public.usuaris where lower(email)=app_private.email()
    and (pot_gestionar_excursions or pot_gestionar_costos_excursions)) then return true; end if;
```

i al `case`:

```sql
      when 'excursions' then '["direccio","titular","cap_estudis","professorat"]'::jsonb
```

- [ ] **Step 2: NO toquis `schema.sql`**

La primera versió d'aquest pla deia de copiar-hi les taules. **És un error** i es va descobrir executant-lo:

- `schema.sql` s'executa **abans** que les migracions, i `public.format_code` i `app_private.school_year` es creen a les migracions 003 i 004. Els `default` que les fan servir encara no existirien.
- I si les taules es creessin a tots dos llocs, la migració petaria amb "la relació ja existeix".

Les crea només la migració. Perquè sigui segura si s'executa dues vegades, porta `if not exists` a la seqüència, a les taules, a l'índex i a les columnes noves d'`usuaris`.

- [ ] **Step 3: Escriu els tests de permisos**

A `tests/database.test.ts`, afegeix un bloc nou al final del fitxer:

```ts
describe('excursions', () => {
  async function excursio(estat = 'Esborrany', autor = 'teacher@stjosep.org') {
    await asUser(autor)
    const id = (await db.query<{id:string}>(`insert into public.excursions(etapa,lloc,activitat,data,hora_sortida,hora_tornada,creat_per)
      values('EP','Can Montcau','La Castanyada','2026-10-17','9:00','17:00',$1) returning id`,[autor])).rows[0].id
    if (estat !== 'Esborrany') await db.query('update public.excursions set estat=$1 where id=$2',[estat,id])
    return id
  }

  it('deixa que tothom vegi el pla sencer', async () => {
    await excursio()
    await asUser('other@stjosep.org')
    expect((await db.query('select * from public.excursions')).rows).toHaveLength(1)
  })

  it('no deixa que un altre docent editi una proposta que no és seva', async () => {
    const id = await excursio()
    await asUser('other@stjosep.org')
    expect((await db.query("update public.excursions set lloc='Un altre' where id=$1 returning id",[id])).rows).toHaveLength(0)
  })

  it('no deixa editar la pròpia excursió quan ja no és un esborrany', async () => {
    const id = await excursio('Aprovada')
    await asUser('teacher@stjosep.org')
    expect((await db.query("update public.excursions set lloc='Un altre' where id=$1 returning id",[id])).rows).toHaveLength(0)
  })

  it('dona accés de gestió amb la casella, sense canviar el rol', async () => {
    const id = await excursio()
    await asUser('admin@stjosep.org')
    await db.query("update public.usuaris set pot_gestionar_excursions=true where email='other@stjosep.org'")
    await asUser('other@stjosep.org')
    expect((await db.query("update public.excursions set lloc='Corregit' where id=$1 returning id",[id])).rows).toHaveLength(1)
  })

  it('nega qualsevol accés al convidat', async () => {
    await excursio()
    await asUser('guest@stjosep.org')
    expect((await db.query('select * from public.excursions')).rows).toHaveLength(0)
  })

  it('assigna un codi llegible', async () => {
    const id = await excursio()
    expect((await db.query<{codi:string}>('select codi from public.excursions where id=$1',[id])).rows[0].codi).toMatch(/^EXC-\d{3,}$/)
  })
})
```

- [ ] **Step 4: Executa els tests i comprova que fallen**

Run: `npx vitest run tests/database.test.ts -t excursions`
Expected: FAIL, amb un error de PostgreSQL dient que `public.excursions` no existeix.

- [ ] **Step 5: Executa els tests i comprova que passen**

Run: `npx vitest run tests/database.test.ts -t excursions`
Expected: PASS, 6 proves.

Si `nega qualsevol accés al convidat` falla, comprova que `visibilitat.excursions` no existeix encara a `config`: `module_visible` cau als valors per defecte i el convidat no hi ha de ser.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202609190001_excursions.sql tests/database.test.ts
git commit -m "feat(excursions): taules, permisos i RLS del mòdul"
```

---

### Task 2: La màquina d'estats i els avisos

**Files:**
- Modify: `supabase/migrations/202609190001_excursions.sql` (afegir el disparador abans del `commit;`)
- Test: `tests/database.test.ts`

**Interfaces:**
- Consumes: taules de la Task 1; `app_private.enqueue(recipient, subject, body, event_key)`; `app_private.minutes(text)`.
- Produces: `app_private.validate_excursio()` — disparador `before insert or update` sobre `public.excursions`.

**Per què un disparador i no funcions RPC:** el disseny deia RPC, però un disparador imposa la regla **encara que algú escrigui directament contra l'API**, i no només quan passa per la funció. És el mateix que fa `app_private.validate_schedule()` a Horaris.

**El truc del resum diari:** `public.notifications.event_key` és **únic** i `app_private.enqueue` fa `on conflict(event_key) do nothing`. Si la clau porta el correu de l'aprovador i la data, **només s'encua el primer avís de cada dia**. Amb 50 propostes en una setmana de setembre, cada aprovador rep un correu al dia i no cinquanta.

- [ ] **Step 1: Escriu els tests dels estats**

Afegeix dins del `describe('excursions', ...)` de la Task 1:

```ts
  async function completa(autor = 'teacher@stjosep.org') {
    const id = await excursio('Esborrany', autor)
    await db.query(`insert into public.excursio_grups(excursio_id,grup,alumnes_previstos) values($1,'EP-1r A',25)`,[id])
    return id
  }

  it('no deixa proposar una excursió a mitges', async () => {
    await asUser('teacher@stjosep.org')
    const id = (await db.query<{id:string}>(`insert into public.excursions(etapa,creat_per)
      values('EP','teacher@stjosep.org') returning id`)).rows[0].id
    await expect(db.query("update public.excursions set estat='Proposada' where id=$1",[id]))
      .rejects.toThrow('Falten dades')
  })

  it('no deixa proposar una excursió en un dia no lectiu', async () => {
    await asUser('admin@stjosep.org')
    await db.query(`insert into public.config values('centre.dies-no-lectius','["2026-10-17"]')`)
    const id = await completa()
    await asUser('teacher@stjosep.org')
    await expect(db.query("update public.excursions set estat='Proposada' where id=$1",[id]))
      .rejects.toThrow('no és lectiu')
  })

  it('segella qui proposa i quan, sense fiar-se del client', async () => {
    const id = await completa()
    await asUser('teacher@stjosep.org')
    await db.query("update public.excursions set estat='Proposada', proposada_per='altre@stjosep.org' where id=$1",[id])
    const row = (await db.query<{proposada_per:string;proposada_el:string}>('select proposada_per,proposada_el from public.excursions where id=$1',[id])).rows[0]
    expect(row.proposada_per).toBe('teacher@stjosep.org')
    expect(row.proposada_el).not.toBeNull()
  })

  it('no deixa que un docent aprovi la seva pròpia excursió', async () => {
    const id = await completa()
    await asUser('teacher@stjosep.org')
    await db.query("update public.excursions set estat='Proposada' where id=$1",[id])
    await expect(db.query("update public.excursions set estat='Aprovada' where id=$1",[id]))
      .rejects.toThrow('No autoritzat')
  })

  it('avisa els aprovadors una sola vegada al dia', async () => {
    const a = await completa(), b = await completa('other@stjosep.org')
    await asUser('teacher@stjosep.org')
    await db.query("update public.excursions set estat='Proposada' where id=$1",[a])
    await asUser('other@stjosep.org')
    await db.query("update public.excursions set estat='Proposada' where id=$1",[b])
    const avisos = (await db.query<{recipient:string}>("select recipient from public.notifications where event_key like 'excursions-pendents:%'")).rows
    expect(avisos.map(x=>x.recipient).sort()).toEqual(['admin@stjosep.org','director@stjosep.org'])
  })

  it('avisa qui la va proposar quan es resol, i desa el motiu del rebuig', async () => {
    const id = await completa()
    await asUser('teacher@stjosep.org')
    await db.query("update public.excursions set estat='Proposada' where id=$1",[id])
    await asUser('admin@stjosep.org')
    await db.query("update public.excursions set estat='Esborrany', motiu_rebuig='Falta el pressupost' where id=$1",[id])
    const n = (await db.query<{recipient:string;subject:string}>("select recipient,subject from public.notifications where event_key like 'excursio-resolta:%'")).rows
    expect(n).toHaveLength(1)
    expect(n[0].recipient).toBe('teacher@stjosep.org')
  })

  it('rebutja una transició que no existeix', async () => {
    const id = await completa()
    await asUser('admin@stjosep.org')
    await expect(db.query("update public.excursions set estat='Reservada' where id=$1",[id]))
      .rejects.toThrow('Transició no vàlida')
  })

  it('deixa cancel·lar en qualsevol moment i avisa els acompanyants', async () => {
    const id = await completa()
    await db.query(`insert into public.excursio_acompanyants(excursio_id,email) values($1,'other@stjosep.org')`,[id])
    await asUser('admin@stjosep.org')
    await db.query("update public.excursions set estat='Cancel·lada', motiu_cancellacio='Pluja' where id=$1",[id])
    const n = (await db.query<{recipient:string}>("select recipient from public.notifications where event_key like 'excursio-cancellada:%'")).rows
    expect(n.map(x=>x.recipient).sort()).toEqual(['other@stjosep.org','teacher@stjosep.org'])
  })
```

- [ ] **Step 2: Executa els tests i comprova que fallen**

Run: `npx vitest run tests/database.test.ts -t excursions`
Expected: FAIL. Les proves noves passen per alt qualsevol validació perquè encara no hi ha disparador.

- [ ] **Step 3: Escriu el disparador**

Afegeix a `supabase/migrations/202609190001_excursions.sql`, just abans del `commit;`:

```sql
create or replace function app_private.validate_excursio() returns trigger
language plpgsql security definer set search_path = '' as $$
declare qui text := app_private.email(); destinatari text; total integer;
begin
  if tg_op = 'INSERT' then
    new.creat_per := qui;
    if new.estat <> 'Esborrany' then raise exception 'Una excursió neix com a esborrany'; end if;
    if coalesce(trim(new.responsable),'') = '' then new.responsable := qui; end if;
    return new;
  end if;

  -- Les hores es validen sempre que hi siguin, estigui en l'estat que estigui.
  if new.hora_sortida <> '' then perform app_private.minutes(new.hora_sortida); end if;
  if new.hora_tornada <> '' then perform app_private.minutes(new.hora_tornada); end if;

  if new.estat = old.estat then return new; end if;

  -- Transicions permeses i qui les pot fer
  if new.estat = 'Cancel·lada' then
    if not app_private.excursions_gestio() then raise exception 'No autoritzat'; end if;
    new.cancellada_per := qui; new.cancellada_el := now();

  elsif old.estat = 'Esborrany' and new.estat = 'Proposada' then
    if not (app_private.creator() and (old.creat_per = qui or app_private.excursions_gestio())) then
      raise exception 'No autoritzat';
    end if;
    if coalesce(trim(new.lloc),'') = '' or coalesce(trim(new.activitat),'') = ''
      or new.data is null or new.hora_sortida = '' or new.hora_tornada = ''
      or (new.transport = 'altres' and coalesce(trim(new.transport_detall),'') = '') then
      raise exception 'Falten dades per enviar la proposta';
    end if;
    select coalesce(sum(alumnes_previstos),0) into total from public.excursio_grups where excursio_id = new.id;
    if total = 0 then raise exception 'Falten dades: cal almenys un grup amb alumnes'; end if;
    if extract(isodow from new.data) >= 6
      or exists(select 1 from public.config where clau = 'centre.dies-no-lectius' and valors ? new.data::text) then
      raise exception 'El dia % no és lectiu', to_char(new.data,'DD/MM/YYYY');
    end if;
    new.proposada_per := qui; new.proposada_el := now();
    for destinatari in select email from public.usuaris where rol in ('coordinador','direccio','titular') loop
      -- Una sola clau per aprovador i dia: el resum diari surt d'aquí.
      perform app_private.enqueue(destinatari, 'Excursions pendents d''aprovar',
        'Tens excursions pendents de revisar al pla del curs.',
        'excursions-pendents:' || destinatari || ':' || current_date::text);
    end loop;

  elsif old.estat = 'Proposada' and new.estat in ('Aprovada','Esborrany') then
    if not app_private.approver() then raise exception 'No autoritzat'; end if;
    if new.estat = 'Aprovada' then
      new.aprovada_per := qui; new.aprovada_el := now(); new.motiu_rebuig := null;
    elsif coalesce(trim(new.motiu_rebuig),'') = '' then
      raise exception 'Cal dir per què es rebutja';
    end if;
    perform app_private.enqueue(old.proposada_per,
      'La teva excursió ' || old.codi || ': ' || new.estat,
      coalesce(new.motiu_rebuig, 'Aprovada.'),
      'excursio-resolta:' || old.id::text || ':' || new.estat);

  elsif old.estat = 'Aprovada' and new.estat = 'Reservada' then
    if not app_private.excursions_gestio() then raise exception 'No autoritzat'; end if;
    new.reservada_per := qui; new.reservada_el := now();

  else
    raise exception 'Transició no vàlida: % → %', old.estat, new.estat;
  end if;

  return new;
end;
$$;
create trigger validate_excursio before insert or update on public.excursions
for each row execute function app_private.validate_excursio();
```

Avisa els acompanyants d'una cancel·lació amb un segon disparador, perquè llegeix una taula filla:

```sql
create or replace function app_private.notify_excursio_cancellada() returns trigger
language plpgsql security definer set search_path = '' as $$
declare destinatari text;
begin
  for destinatari in
    select coalesce(new.proposada_per, new.creat_per)
    union
    select email from public.excursio_acompanyants where excursio_id = new.id
  loop
    if destinatari is not null then
      perform app_private.enqueue(destinatari,
        'Excursió ' || new.codi || ' cancel·lada',
        coalesce(new.motiu_cancellacio, 'Sense motiu indicat.'),
        'excursio-cancellada:' || new.id::text || ':' || destinatari);
    end if;
  end loop;
  return null;
end;
$$;
create trigger notify_excursio_cancellada after update on public.excursions
for each row when (new.estat = 'Cancel·lada' and old.estat <> 'Cancel·lada')
execute function app_private.notify_excursio_cancellada();
```

- [ ] **Step 4: Executa els tests i comprova que passen**

Run: `npx vitest run tests/database.test.ts -t excursions`
Expected: PASS, 14 proves (6 de la Task 1 + 8 d'aquesta).

- [ ] **Step 5: Comprova que la resta de la suite segueix verda**

Run: `npm test`
Expected: PASS. Si falla `authenticated_security_definer_function_executable` o alguna prova d'auditoria, revisa que els disparadors nous no s'hagin afegit dues vegades.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202609190001_excursions.sql tests/database.test.ts
git commit -m "feat(excursions): màquina d'estats i avisos al servidor"
```

---

### Task 3: Tipus i validació al client

**Files:**
- Create: `src/modules/excursions/types.ts`
- Create: `src/modules/excursions/excursions.utils.ts`
- Test: `src/modules/excursions/excursions.utils.test.ts`

**Interfaces:**
- Consumes: `EtapaSubstitucio` i `ETAPES_SUBSTITUCIO` de `src/modules/substitucions/types.ts`.
- Produces: `Excursio`, `ExcursioGrup`, `EstatExcursio`, `ESTATS_EXCURSIO`, `TRANSPORTS`, `rowToExcursio`, `excursioToInsert`, `campsQueFalten`, `esDiaLectiu`, `ESTAT_COLORS`.

- [ ] **Step 1: Escriu els tipus**

Crea `src/modules/excursions/types.ts`:

```ts
import { ETAPES_SUBSTITUCIO, type EtapaSubstitucio } from '../substitucions/types'

export type { EtapaSubstitucio }
export const ETAPES_EXCURSIO = ETAPES_SUBSTITUCIO

export const ESTATS_EXCURSIO = ['Esborrany', 'Proposada', 'Aprovada', 'Reservada', 'Circular enviada', 'Cancel·lada'] as const
export type EstatExcursio = typeof ESTATS_EXCURSIO[number]

export const TRANSPORTS = ['autocar', 'altres'] as const
export type Transport = typeof TRANSPORTS[number]

export const TRANSPORT_LABELS: Record<Transport, string> = {
  autocar: 'Autocar',
  altres: 'Altres (metro, tren, FGC, a peu…)',
}

export const ESTAT_COLORS: Record<EstatExcursio, string> = {
  'Esborrany': 'bg-gray-100 text-gray-600',
  'Proposada': 'bg-amber-100 text-amber-800',
  'Aprovada': 'bg-green-100 text-green-800',
  'Reservada': 'bg-blue-100 text-blue-800',
  'Circular enviada': 'bg-violet-100 text-violet-800',
  'Cancel·lada': 'bg-red-100 text-red-700',
}

export interface ExcursioGrup {
  id: string
  Grup: string
  AlumnesPrevistos: number
  AlumnesFinals: number | null
}

export interface Excursio {
  id: string
  Codi: string
  CursEscolar: string
  Estat: EstatExcursio
  Etapa: EtapaSubstitucio
  Lloc: string
  Poblacio: string
  Activitat: string
  Data: string | null
  HoraSortida: string
  HoraTornada: string
  Transport: Transport
  TransportDetall: string
  AcompanyantsExterns: number
  Observacions: string
  Responsable: string
  MotiuRebuig: string | null
  MotiuCancellacio: string | null
  ProposadaPer: string | null
  Creat_per: string
  Grups: ExcursioGrup[]
  Acompanyants: string[]
}

export interface ExcursioFormData {
  Etapa: EtapaSubstitucio
  Lloc: string
  Poblacio: string
  Activitat: string
  Data: string
  HoraSortida: string
  HoraTornada: string
  Transport: Transport
  TransportDetall: string
  AcompanyantsExterns: number
  Observacions: string
  Responsable: string
  Grups: { Grup: string; AlumnesPrevistos: number }[]
  Acompanyants: string[]
}
```

- [ ] **Step 2: Escriu les proves de validació**

Crea `src/modules/excursions/excursions.utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { campsQueFalten, esDiaLectiu } from './excursions.utils'
import type { ExcursioFormData } from './types'

const completa: ExcursioFormData = {
  Etapa: 'EP', Lloc: 'Can Montcau', Poblacio: 'La Roca', Activitat: 'La Castanyada',
  Data: '2026-10-19', HoraSortida: '9:00', HoraTornada: '17:00',
  Transport: 'autocar', TransportDetall: '', AcompanyantsExterns: 0,
  Observacions: '', Responsable: 'teacher@stjosep.org',
  Grups: [{ Grup: 'EP-1r A', AlumnesPrevistos: 25 }], Acompanyants: [],
}

describe('què falta per enviar una proposta', () => {
  it('no troba res a faltar en una proposta completa', () => {
    expect(campsQueFalten(completa)).toEqual([])
  })

  it('reclama els camps buits pel seu nom', () => {
    const falten = campsQueFalten({ ...completa, Lloc: '  ', Activitat: '', Data: '' })
    expect(falten).toContain('el lloc')
    expect(falten).toContain("l'activitat")
    expect(falten).toContain('la data')
  })

  it('reclama almenys un grup amb alumnes', () => {
    expect(campsQueFalten({ ...completa, Grups: [] })).toContain('almenys un grup amb alumnes')
    expect(campsQueFalten({ ...completa, Grups: [{ Grup: 'EP-1r A', AlumnesPrevistos: 0 }] }))
      .toContain('almenys un grup amb alumnes')
  })

  it('només reclama el detall del transport quan no és autocar', () => {
    expect(campsQueFalten({ ...completa, Transport: 'autocar', TransportDetall: '' })).toEqual([])
    expect(campsQueFalten({ ...completa, Transport: 'altres', TransportDetall: '' }))
      .toContain('com s’hi va')
  })
})

describe('dia lectiu', () => {
  it('descarta els caps de setmana', () => {
    expect(esDiaLectiu('2026-10-17', [])).toBe(false)   // dissabte
    expect(esDiaLectiu('2026-10-18', [])).toBe(false)   // diumenge
    expect(esDiaLectiu('2026-10-19', [])).toBe(true)    // dilluns
  })

  it('descarta els dies marcats com a no lectius', () => {
    expect(esDiaLectiu('2026-10-19', ['2026-10-19'])).toBe(false)
  })

  it('no s’equivoca de dia per la zona horària', () => {
    expect(esDiaLectiu('2026-01-05', [])).toBe(true)    // dilluns
  })
})
```

- [ ] **Step 3: Executa les proves i comprova que fallen**

Run: `npx vitest run src/modules/excursions/excursions.utils.test.ts`
Expected: FAIL, el mòdul `./excursions.utils` no existeix.

- [ ] **Step 4: Escriu les utilitats**

Crea `src/modules/excursions/excursions.utils.ts`:

```ts
import type { Excursio, ExcursioFormData, EstatExcursio, Transport } from './types'
import type { EtapaSubstitucio } from '../substitucions/types'

export const TAULA_EXCURSIONS = 'excursions'

export interface ExcursioRow {
  id: string
  codi: string
  curs_escolar: string
  estat: string
  etapa: string
  lloc: string
  poblacio: string
  activitat: string
  data: string | null
  hora_sortida: string
  hora_tornada: string
  transport: string
  transport_detall: string
  acompanyants_externs: number
  observacions: string
  responsable: string
  motiu_rebuig: string | null
  motiu_cancellacio: string | null
  proposada_per: string | null
  creat_per: string
}

export function rowToExcursio(row: ExcursioRow): Excursio {
  return {
    id: row.id, Codi: row.codi, CursEscolar: row.curs_escolar,
    Estat: row.estat as EstatExcursio, Etapa: row.etapa as EtapaSubstitucio,
    Lloc: row.lloc, Poblacio: row.poblacio, Activitat: row.activitat,
    Data: row.data, HoraSortida: row.hora_sortida, HoraTornada: row.hora_tornada,
    Transport: row.transport as Transport, TransportDetall: row.transport_detall,
    AcompanyantsExterns: row.acompanyants_externs, Observacions: row.observacions,
    Responsable: row.responsable, MotiuRebuig: row.motiu_rebuig,
    MotiuCancellacio: row.motiu_cancellacio, ProposadaPer: row.proposada_per,
    Creat_per: row.creat_per, Grups: [], Acompanyants: [],
  }
}

export function excursioToInsert(d: ExcursioFormData): Record<string, unknown> {
  return {
    etapa: d.Etapa, lloc: d.Lloc.trim(), poblacio: d.Poblacio.trim(),
    activitat: d.Activitat.trim(), data: d.Data || null,
    hora_sortida: d.HoraSortida, hora_tornada: d.HoraTornada,
    transport: d.Transport, transport_detall: d.TransportDetall.trim(),
    acompanyants_externs: d.AcompanyantsExterns,
    observacions: d.Observacions.trim(), responsable: d.Responsable,
  }
}

/** Els noms surten tal com s'han d'ensenyar dins d'una frase: "Falten el lloc i la data." */
export function campsQueFalten(d: ExcursioFormData): string[] {
  const falten: string[] = []
  if (!d.Lloc.trim()) falten.push('el lloc')
  if (!d.Activitat.trim()) falten.push("l'activitat")
  if (!d.Data) falten.push('la data')
  if (!d.HoraSortida) falten.push("l'hora de sortida")
  if (!d.HoraTornada) falten.push('l’hora de tornada')
  if (d.Transport === 'altres' && !d.TransportDetall.trim()) falten.push('com s’hi va')
  if (!d.Grups.some((g) => g.AlumnesPrevistos > 0)) falten.push('almenys un grup amb alumnes')
  return falten
}

export function esDiaLectiu(data: string, diesNoLectius: string[]): boolean {
  if (!data) return false
  // Amb T12:00:00 el dia no canvia per la zona horària, com a la resta de l'app.
  const dow = new Date(data + 'T12:00:00').getDay()
  if (dow === 0 || dow === 6) return false
  return !diesNoLectius.includes(data)
}
```

- [ ] **Step 5: Executa les proves i comprova que passen**

Run: `npx vitest run src/modules/excursions/excursions.utils.test.ts`
Expected: PASS, 7 proves.

- [ ] **Step 6: Commit**

```bash
npm run lint && npm test
git add src/modules/excursions/
git commit -m "feat(excursions): tipus i validació de propostes"
```

---

### Task 4: Store

**Files:**
- Create: `src/modules/excursions/useExcursions.ts`
- Test: `src/modules/excursions/useExcursions.test.ts`

**Interfaces:**
- Consumes: `getAll`, `insertRow`, `updateRowById`, `deleteRowById` de `src/services/db.ts`; `schoolYear()` de `src/utils/schoolCalendar.ts`; utilitats de la Task 3.
- Produces: `useExcursions` amb `{ excursions, loading, error, load(curs?), crear(data), editar(id, data), eliminar(id), canviarEstat(id, estat, motiu?) }`.

- [ ] **Step 1: Escriu les proves del store**

Crea `src/modules/excursions/useExcursions.test.ts`. Segueix el patró de `src/modules/horaris/useHoraris.test.ts` per a la simulació de `services/db`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getAll = vi.fn()
const insertRow = vi.fn()
const updateRowById = vi.fn()
const deleteRowById = vi.fn()
vi.mock('../../services/db', () => ({ getAll, insertRow, updateRowById, deleteRowById }))

const { useExcursions } = await import('./useExcursions')

const fila = {
  id: '1', codi: 'EXC-001', curs_escolar: '2026-2027', estat: 'Esborrany', etapa: 'EP',
  lloc: 'Can Montcau', poblacio: 'La Roca', activitat: 'Castanyada', data: '2026-10-19',
  hora_sortida: '9:00', hora_tornada: '17:00', transport: 'autocar', transport_detall: '',
  acompanyants_externs: 0, observacions: '', responsable: 'a@stjosep.org',
  motiu_rebuig: null, motiu_cancellacio: null, proposada_per: null, creat_per: 'a@stjosep.org',
}

beforeEach(() => {
  vi.clearAllMocks()
  useExcursions.setState({ excursions: [], loading: false, error: null })
})

describe('store d’excursions', () => {
  it('carrega les excursions d’un curs amb els seus grups i acompanyants', async () => {
    getAll.mockImplementation((taula: string) => {
      if (taula === 'excursions') return Promise.resolve([fila])
      if (taula === 'excursio_grups') return Promise.resolve([{ id: 'g1', excursio_id: '1', grup: 'EP-1r A', alumnes_previstos: 25, alumnes_finals: null }])
      return Promise.resolve([{ id: 'a1', excursio_id: '1', email: 'b@stjosep.org' }])
    })
    await useExcursions.getState().load('2026-2027')
    const [e] = useExcursions.getState().excursions
    expect(e.Codi).toBe('EXC-001')
    expect(e.Grups).toHaveLength(1)
    expect(e.Acompanyants).toEqual(['b@stjosep.org'])
  })

  it('deixa l’error a la vista i no llança, perquè la pantalla el pugui ensenyar', async () => {
    getAll.mockRejectedValue(new Error('sense connexió'))
    await useExcursions.getState().load('2026-2027')
    expect(useExcursions.getState().error).toBe('sense connexió')
    expect(useExcursions.getState().loading).toBe(false)
  })

  it('envia el motiu quan es rebutja', async () => {
    useExcursions.setState({ excursions: [{ ...(await import('./excursions.utils')).rowToExcursio(fila) }] })
    updateRowById.mockResolvedValue({ ...fila, estat: 'Esborrany', motiu_rebuig: 'Falta data' })
    await useExcursions.getState().canviarEstat('1', 'Esborrany', 'Falta data')
    expect(updateRowById).toHaveBeenCalledWith('excursions', '1', { estat: 'Esborrany', motiu_rebuig: 'Falta data' })
  })
})
```

- [ ] **Step 2: Executa les proves i comprova que fallen**

Run: `npx vitest run src/modules/excursions/useExcursions.test.ts`
Expected: FAIL, `./useExcursions` no existeix.

- [ ] **Step 3: Escriu el store**

Crea `src/modules/excursions/useExcursions.ts`:

```ts
import { create } from 'zustand'
import { getAll, insertRow, updateRowById, deleteRowById } from '../../services/db'
import { schoolYear } from '../../utils/schoolCalendar'
import type { Excursio, ExcursioFormData, EstatExcursio } from './types'
import { TAULA_EXCURSIONS, rowToExcursio, excursioToInsert, type ExcursioRow } from './excursions.utils'

interface GrupRow { id: string; excursio_id: string; grup: string; alumnes_previstos: number; alumnes_finals: number | null }
interface AcompanyantRow { id: string; excursio_id: string; email: string }

interface ExcursionsState {
  excursions: Excursio[]
  loading: boolean
  error: string | null
  load: (curs?: string) => Promise<void>
  crear: (data: ExcursioFormData) => Promise<Excursio>
  editar: (id: string, data: ExcursioFormData) => Promise<void>
  eliminar: (id: string) => Promise<void>
  canviarEstat: (id: string, estat: EstatExcursio, motiu?: string) => Promise<void>
}

let generacio = 0

export const useExcursions = create<ExcursionsState>((set, get) => ({
  excursions: [],
  loading: false,
  error: null,

  async load(curs = schoolYear()) {
    const meva = ++generacio
    set({ loading: true, error: null })
    try {
      const [files, grups, acompanyants] = await Promise.all([
        getAll<ExcursioRow>(TAULA_EXCURSIONS, 'data', { curs_escolar: curs }),
        getAll<GrupRow>('excursio_grups', 'grup'),
        getAll<AcompanyantRow>('excursio_acompanyants', 'email'),
      ])
      if (meva !== generacio) return
      set({ excursions: files.map((f) => ({
        ...rowToExcursio(f),
        Grups: grups.filter((g) => g.excursio_id === f.id)
          .map((g) => ({ id: g.id, Grup: g.grup, AlumnesPrevistos: g.alumnes_previstos, AlumnesFinals: g.alumnes_finals })),
        Acompanyants: acompanyants.filter((a) => a.excursio_id === f.id).map((a) => a.email),
      })) })
    } catch (err) {
      if (meva === generacio) set({ error: err instanceof Error ? err.message : 'Error carregant les excursions' })
    } finally {
      if (meva === generacio) set({ loading: false })
    }
  },

  async crear(data) {
    const fila = await insertRow<ExcursioRow>(TAULA_EXCURSIONS, { ...excursioToInsert(data), curs_escolar: schoolYear() })
    await desaFilles(fila.id, data)
    const excursio = { ...rowToExcursio(fila), Grups: [], Acompanyants: [] }
    set((s) => ({ excursions: [...s.excursions, excursio] }))
    await get().load(fila.curs_escolar)
    return excursio
  },

  async editar(id, data) {
    await updateRowById<ExcursioRow>(TAULA_EXCURSIONS, id, excursioToInsert(data))
    await esborraFilles(id)
    await desaFilles(id, data)
    await get().load()
  },

  async eliminar(id) {
    await deleteRowById(TAULA_EXCURSIONS, id)
    set((s) => ({ excursions: s.excursions.filter((e) => e.id !== id) }))
  },

  async canviarEstat(id, estat, motiu) {
    const camps: Record<string, unknown> = { estat }
    if (estat === 'Esborrany') camps.motiu_rebuig = motiu ?? ''
    if (estat === 'Cancel·lada') camps.motiu_cancellacio = motiu ?? ''
    const fila = await updateRowById<ExcursioRow>(TAULA_EXCURSIONS, id, camps)
    set((s) => ({ excursions: s.excursions.map((e) => (e.id === id ? { ...e, ...rowToExcursio(fila), Grups: e.Grups, Acompanyants: e.Acompanyants } : e)) }))
  },
}))

// Els grups i els acompanyants es reescriuen sencers en desar: són poques files
// i evita haver de comparar què s'ha afegit o tret.
async function desaFilles(excursioId: string, data: ExcursioFormData) {
  for (const g of data.Grups.filter((g) => g.Grup)) {
    await insertRow('excursio_grups', { excursio_id: excursioId, grup: g.Grup, alumnes_previstos: g.AlumnesPrevistos })
  }
  for (const email of data.Acompanyants) {
    await insertRow('excursio_acompanyants', { excursio_id: excursioId, email })
  }
}

async function esborraFilles(excursioId: string) {
  const [grups, acompanyants] = await Promise.all([
    getAll<GrupRow>('excursio_grups', 'grup'),
    getAll<AcompanyantRow>('excursio_acompanyants', 'email'),
  ])
  for (const g of grups.filter((g) => g.excursio_id === excursioId)) await deleteRowById('excursio_grups', g.id)
  for (const a of acompanyants.filter((a) => a.excursio_id === excursioId)) await deleteRowById('excursio_acompanyants', a.id)
}
```

- [ ] **Step 4: Executa les proves i comprova que passen**

Run: `npx vitest run src/modules/excursions/useExcursions.test.ts`
Expected: PASS, 3 proves.

- [ ] **Step 5: Commit**

```bash
npm run lint && npm test
git add src/modules/excursions/
git commit -m "feat(excursions): store del mòdul"
```

---

### Task 5: Pantalla del pla del curs

**Files:**
- Create: `src/modules/excursions/ExcursionsPage.tsx`
- Create: `src/app/routes/ExcursionsWrapper.tsx`
- Modify: `src/App.tsx` (import mandrós + ruta `/excursions`)
- Modify: `src/components/Layout.tsx` (entrada al menú)
- Modify: `src/store/configStore.ts` (`MODULS_VISIBILITAT` i `visibilitat.excursions`)

**Interfaces:**
- Consumes: `useExcursions` (Task 4), `ESTAT_COLORS` i `ESTATS_EXCURSIO` (Task 3), `useConfigStore`, `useUsuarisStore`.
- Produces: la pàgina, que rep per props `onNova`, `onObrir` i `onAprovarSeleccionades`.

- [ ] **Step 1: Registra el mòdul**

A `src/store/configStore.ts`, afegeix a `MODULS_VISIBILITAT`:

```ts
  { key: 'excursions', label: 'Excursions' },
```

i a `CONFIG_DEFAULTS`:

```ts
  'visibilitat.excursions': ['direccio', 'titular', 'cap_estudis', 'professorat'],
```

(El convidat no hi és: no ha de veure el pla.)

A `src/components/Layout.tsx`, afegeix a `NAV_ITEMS` **just després de `/horaris`**, no al final de la llista: és un mòdul del dia a dia. (La reordenació del menú en blocs és una feina a part i encara no està feta; quan es faci, aquesta entrada anirà al bloc "Dia a dia".)

```ts
  { to: '/excursions', label: 'Excursions', icon: MapPin, visKey: 'excursions' },
```

i afegeix `MapPin` a l'import de `lucide-react`.

A `src/App.tsx`:

```ts
const ExcursionsWrapper = lazy(() => import('./app/routes/ExcursionsWrapper'))
```

i la ruta, al costat de les altres:

```tsx
<Route path="/excursions" element={<ExcursionsWrapper />} />
```

- [ ] **Step 2: Escriu la pantalla**

Crea `src/modules/excursions/ExcursionsPage.tsx`. Per a l'estructura visual (capçalera, estats de càrrega, taula) segueix `src/modules/reserves/ReservesPage.tsx`, que és el mòdul de llista més semblant.

```tsx
import { useMemo, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import type { Excursio } from './types'
import { ESTATS_EXCURSIO, ESTAT_COLORS, ETAPES_EXCURSIO } from './types'

interface Props {
  excursions: Excursio[]
  loading: boolean
  error: string | null
  potAprovar: boolean
  onNova: () => void
  onObrir: (e: Excursio) => void
  onRefresh: () => void
  onAprovar: (ids: string[]) => Promise<void>
}

export function ExcursionsPage({ excursions, loading, error, potAprovar, onNova, onObrir, onRefresh, onAprovar }: Props) {
  const [etapa, setEtapa] = useState('')
  const [estat, setEstat] = useState('')
  const [mes, setMes] = useState('')
  const [seleccio, setSeleccio] = useState<string[]>([])

  const visibles = useMemo(() => excursions.filter((e) =>
    (!etapa || e.Etapa === etapa) &&
    (!estat || e.Estat === estat) &&
    (!mes || (e.Data ?? '').slice(5, 7) === mes)
  ), [excursions, etapa, estat, mes])

  const pendents = excursions.filter((e) => e.Estat === 'Proposada').length
  const seleccionadesProposades = visibles.filter((e) => seleccio.includes(e.id) && e.Estat === 'Proposada')

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-text-main">Excursions</h1>
            {pendents > 0 && (
              <p className="text-xs text-amber-700 mt-0.5">
                {pendents} {pendents === 1 ? 'proposta pendent' : 'propostes pendents'} d’aprovar
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onRefresh} className="p-2 text-gray-400 hover:text-gray-600" aria-label="Actualitza">
              <RefreshCw size={16} />
            </button>
            <button onClick={onNova} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg" style={{ backgroundColor: '#861414' }}>
              <Plus size={15} /> Nova excursió
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <select value={etapa} onChange={(e) => setEtapa(e.target.value)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg">
            <option value="">Totes les etapes</option>
            {ETAPES_EXCURSIO.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select value={estat} onChange={(e) => setEstat(e.target.value)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg">
            <option value="">Tots els estats</option>
            {ESTATS_EXCURSIO.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select value={mes} onChange={(e) => setMes(e.target.value)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg">
            <option value="">Tot el curs</option>
            {['09','10','11','12','01','02','03','04','05','06'].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {potAprovar && seleccionadesProposades.length > 0 && (
            <button
              onClick={() => onAprovar(seleccionadesProposades.map((e) => e.id)).then(() => setSeleccio([]))}
              className="px-3 py-1.5 text-xs font-medium text-green-800 bg-green-100 rounded-lg"
            >
              Aprova {seleccionadesProposades.length}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading && <p className="text-xs text-gray-400">Carregant…</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
        {!loading && visibles.length === 0 && (
          <p className="text-sm text-gray-400 italic">Cap excursió amb aquests filtres.</p>
        )}
        {visibles.length > 0 && (
          <table className="w-full text-xs bg-white border border-gray-200 rounded-xl overflow-hidden">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                {potAprovar && <th className="px-3 py-2 w-8"></th>}
                <th className="px-3 py-2 font-medium">Codi</th>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Etapa</th>
                <th className="px-3 py-2 font-medium">Activitat</th>
                <th className="px-3 py-2 font-medium">Lloc</th>
                <th className="px-3 py-2 font-medium">Alumnes</th>
                <th className="px-3 py-2 font-medium">Estat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibles.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  {potAprovar && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Selecciona ${e.Codi}`}
                        checked={seleccio.includes(e.id)}
                        onChange={(ev) => setSeleccio((s) => ev.target.checked ? [...s, e.id] : s.filter((x) => x !== e.id))}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2 text-gray-400">
                    <button type="button" onClick={() => onObrir(e)} className="underline">{e.Codi}</button>
                  </td>
                  <td className="px-3 py-2">{e.Data ?? '—'}</td>
                  <td className="px-3 py-2">{e.Etapa}</td>
                  <td className="px-3 py-2 text-text-main">{e.Activitat}</td>
                  <td className="px-3 py-2">{e.Lloc}</td>
                  <td className="px-3 py-2">{e.Grups.reduce((s, g) => s + g.AlumnesPrevistos, 0)}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full ${ESTAT_COLORS[e.Estat]}`}>{e.Estat}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Escriu el wrapper**

Crea `src/app/routes/ExcursionsWrapper.tsx` seguint `src/app/routes/ReservesWrapper.tsx`. De moment, `onNova` i `onObrir` poden deixar l'estat preparat però sense formulari (arriba a les tasques 6 i 7):

```tsx
import { useEffect } from 'react'
import { ExcursionsPage } from '../../modules/excursions/ExcursionsPage'
import { useExcursions } from '../../modules/excursions/useExcursions'
import { useUsuarisStore } from '../../store/usuarisStore'

export default function ExcursionsWrapper() {
  const { excursions, loading, error, load, canviarEstat } = useExcursions()
  const rol = useUsuarisStore((s) => s.rol)
  const potAprovar = rol === 'coordinador' || rol === 'direccio' || rol === 'titular'

  useEffect(() => { void load() }, [load])

  return (
    <ExcursionsPage
      excursions={excursions}
      loading={loading}
      error={error}
      potAprovar={potAprovar}
      onNova={() => {}}
      onObrir={() => {}}
      onRefresh={() => void load()}
      onAprovar={async (ids) => { for (const id of ids) await canviarEstat(id, 'Aprovada') }}
    />
  )
}
```

- [ ] **Step 4: Comprova-ho a mà**

Run: `npm run dev`
Obre `/excursions` amb el teu compte de coordinador. Ha de sortir l'entrada al menú, la pantalla buida i els filtres. Amb un compte de professorat ha de sortir igual però sense caselles ni botó d'aprovar.

- [ ] **Step 5: Commit**

```bash
npm run lint && npm test && npm run build
git add src/ && git commit -m "feat(excursions): pantalla del pla del curs"
```

---

### Task 6: Formulari de proposta

**Files:**
- Create: `src/modules/excursions/ExcursioForm.tsx`
- Modify: `src/app/routes/ExcursionsWrapper.tsx`

**Interfaces:**
- Consumes: `ExcursioFormData`, `campsQueFalten`, `esDiaLectiu`, `TRANSPORTS`, `TRANSPORT_LABELS`; `useConfigStore` per a `substitucions.grups` i `centre.dies-no-lectius`; `useUsuarisStore` per a la llista d'usuaris.
- Produces: `ExcursioForm` amb props `{ inicial?: Excursio; onDesar(data, enviar): Promise<void>; onClose(): void }`.

- [ ] **Step 1: Escriu el formulari**

Crea `src/modules/excursions/ExcursioForm.tsx`. Per a l'estructura del diàleg, segueix `src/modules/horaris/HorariSlotForm.tsx`.

Punts que no es poden perdre:

```tsx
// Dins del component:
const grups = useConfigStore((s) => s.getValues('substitucions.grups'))
const diesNoLectius = useConfigStore((s) => s.getValues('centre.dies-no-lectius'))
const usuaris = useUsuarisStore((s) => s.usuaris)

const falten = campsQueFalten(dades)
const dataNoLectiva = dades.Data !== '' && !esDiaLectiu(dades.Data, diesNoLectius)

// Desar l'esborrany sempre és possible; enviar-lo, només si no falta res.
<button type="button" onClick={() => onDesar(dades, false)}>Desa l'esborrany</button>
<button
  type="button"
  disabled={falten.length > 0 || dataNoLectiva}
  onClick={() => onDesar(dades, true)}
>
  Envia la proposta
</button>

{falten.length > 0 && (
  <p className="text-xs text-amber-700">
    Per enviar-la falten: {falten.join(', ')}.
  </p>
)}
{dataNoLectiva && (
  <p className="text-xs text-red-600">Aquell dia no és lectiu.</p>
)}
```

**Camps del formulari, en aquest ordre:**

| Camp | Control | Obligatori per enviar |
|---|---|---|
| Etapa | desplegable amb `ETAPES_EXCURSIO` | sí (ja té valor per defecte) |
| Activitat | text | sí |
| Lloc | text | sí |
| Població | text | no |
| Data | `<input type="date">` | sí, i ha de ser lectiva |
| Hora de sortida / de tornada | text `H:MM` | sí |
| Transport | desplegable amb `TRANSPORTS` i `TRANSPORT_LABELS` | sí |
| Com s'hi va | text, **només visible si el transport és `altres`** | sí en aquest cas |
| Grups | files de desplegable (`grups` de config) + nombre d'alumnes, amb botons d'afegir i treure | almenys un amb alumnes > 0 |
| Acompanyants | selecció múltiple d'`usuaris` amb `Rol !== 'convidat'` | **no** |
| Acompanyants externs | nombre | no |
| Responsable | desplegable d'`usuaris`, per defecte qui omple | no |
| Observacions | àrea de text | no |

- [ ] **Step 2: Connecta'l al wrapper**

A `ExcursionsWrapper.tsx`, afegeix l'estat del formulari i la lògica de desar:

```tsx
const [formObert, setFormObert] = useState(false)
const [editant, setEditant] = useState<Excursio | null>(null)

async function handleDesar(data: ExcursioFormData, enviar: boolean) {
  const excursio = editant ? (await editar(editant.id, data), editant) : await crear(data)
  if (enviar) await canviarEstat(excursio.id, 'Proposada')
  setFormObert(false); setEditant(null)
}
```

- [ ] **Step 3: Comprova-ho a mà**

Run: `npm run dev`

1. Crea una excursió a mitges i desa-la com a esborrany: ha de sortir a la llista com a `Esborrany`.
2. Amb camps buits, el botó d'enviar ha d'estar apagat i el llistat del que falta ha de créixer i minvar mentre escrius.
3. Posa-hi un dissabte: ha de dir que no és lectiu i no deixar enviar.
4. Omple-ho tot i envia-la: ha de passar a `Proposada`.

- [ ] **Step 4: Comprova que el servidor també ho rebutja**

Això és el que demostra que la validació no és només decorativa. A la consola del navegador, amb sessió iniciada:

```js
const { supabase } = await import('/src/services/db.ts')
// Posa-hi l'id d'un esborrany incomplet
await supabase.from('excursions').update({ estat: 'Proposada' }).eq('id', '<ID>')
```

Expected: error del servidor amb "Falten dades per enviar la proposta".

- [ ] **Step 5: Commit**

```bash
npm run lint && npm test && npm run build
git add src/ && git commit -m "feat(excursions): formulari de proposta amb validació"
```

---

### Task 7: Fitxa, accions d'estat i caselles de permisos

**Files:**
- Create: `src/modules/excursions/ExcursioDetall.tsx`
- Modify: `src/app/routes/ExcursionsWrapper.tsx`
- Modify: `src/modules/configuracio/ConfiguracioPage.tsx` (les dues caselles a la fitxa d'usuari)

**Interfaces:**
- Consumes: `canviarEstat` del store; `useUsuarisStore` per al rol i les capacitats.
- Produces: `ExcursioDetall` amb props `{ excursio; potAprovar; potGestionar; onCanviarEstat(estat, motiu?); onEditar(); onClose() }`.

- [ ] **Step 1: Escriu la fitxa**

Crea `src/modules/excursions/ExcursioDetall.tsx` seguint `src/modules/reserves/ReservaDetall.tsx`. Ha de mostrar totes les dades, els grups amb els seus alumnes, els acompanyants, i **l'historial de qui ha fet què**: proposada per, aprovada per, reservada per, i el motiu de rebuig o de cancel·lació si n'hi ha.

Les accions surten segons l'estat i el permís:

```tsx
{excursio.Estat === 'Proposada' && potAprovar && (
  <>
    <button onClick={() => onCanviarEstat('Aprovada')}>Aprova</button>
    <button onClick={() => {
      const motiu = window.prompt('Per què es rebutja?')
      if (motiu?.trim()) onCanviarEstat('Esborrany', motiu.trim())
    }}>Rebutja</button>
  </>
)}
{excursio.Estat === 'Aprovada' && potGestionar && (
  <button onClick={() => onCanviarEstat('Reservada')}>Marca com a reservada</button>
)}
{excursio.Estat !== 'Cancel·lada' && potGestionar && (
  <button onClick={() => {
    const motiu = window.prompt('Per què es cancel·la?')
    if (motiu?.trim()) onCanviarEstat('Cancel·lada', motiu.trim())
  }}>Cancel·la</button>
)}
```

Quan l'excursió estigui cancel·lada **i ja s'hagi enviat la circular**, ensenya l'avís que la devolució no la gestiona encara l'aplicació:

```tsx
{excursio.Estat === 'Cancel·lada' && (
  <p className="text-xs text-amber-700">
    Si ja s’havia enviat la circular, la devolució dels diners s’ha de gestionar fora de l’aplicació.
  </p>
)}
```

- [ ] **Step 2: Afegeix les caselles de permisos**

A `src/modules/configuracio/ConfiguracioPage.tsx`, al component que pinta una fila d'usuari (`UsuariRow`), al costat de la casella de material infantil que ja hi ha, afegeix-ne dues més amb el mateix patró: `pot_gestionar_excursions` ("Pot gestionar excursions") i `pot_gestionar_costos_excursions` ("Pot veure i editar els costos"). Afegeix al store `usuarisStore` els mètodes `updatePotGestionarExcursions` i `updatePotGestionarCostosExcursions`, copiant `updatePotGestionarMaterial`.

- [ ] **Step 3: Comprova-ho a mà**

Run: `npm run dev`

1. Com a coordinador, aprova una proposta: ha de passar a `Aprovada` i el professor ha de rebre un avís (mira `notifications` al SQL Editor).
2. Rebutja'n una altra amb motiu: ha de tornar a `Esborrany` i el motiu ha de sortir a la fitxa.
3. Marca'n una com a reservada.
4. Amb un compte de professorat, obre una proposta d'un altre: **no ha de sortir cap botó d'acció**.
5. Dona-li la casella de gestió a aquest professor: ha de poder marcar reservada, però **no ha de veure enlloc cap cost** (a la Fase A encara no n'hi ha cap).

- [ ] **Step 4: Commit**

```bash
npm run lint && npm test && npm run build
git add src/ && git commit -m "feat(excursions): fitxa, accions d'estat i permisos per usuari"
```

---

### Task 8: Copiar del curs anterior

**Files:**
- Create: `src/modules/excursions/CopiarCursAnterior.tsx`
- Modify: `src/modules/excursions/useExcursions.ts` (mètode `copiarDelCurs`)
- Modify: `src/app/routes/ExcursionsWrapper.tsx`
- Test: `src/modules/excursions/excursions.utils.test.ts` (dates traslladades)

**Interfaces:**
- Consumes: `useExcursions`, `schoolYear()`.
- Produces: `dataTrasladada(data, cursOrigen, cursDesti)` a `excursions.utils.ts`; `copiarDelCurs(cursOrigen, ids)` al store.

**Per què existeix:** al setembre es planifica tot el curs i les sortides es repeteixen any rere any. Aquesta és **la porta d'entrada del setembre**, no un botó secundari.

- [ ] **Step 1: Escriu la prova del trasllat de dates**

Afegeix a `src/modules/excursions/excursions.utils.test.ts`:

```ts
import { dataTrasladada } from './excursions.utils'

describe('traslladar una data al curs nou', () => {
  it('suma un any als mesos de tardor i als de primavera', () => {
    expect(dataTrasladada('2025-10-17', '2025-2026', '2026-2027')).toBe('2026-10-17')
    expect(dataTrasladada('2026-03-05', '2025-2026', '2026-2027')).toBe('2027-03-05')
  })

  it('deixa la data buida si no n’hi havia', () => {
    expect(dataTrasladada(null, '2025-2026', '2026-2027')).toBeNull()
  })

  it('no inventa un 29 de febrer', () => {
    expect(dataTrasladada('2024-02-29', '2023-2024', '2024-2025')).toBe('2025-02-28')
  })
})
```

- [ ] **Step 2: Executa la prova i comprova que falla**

Run: `npx vitest run src/modules/excursions/excursions.utils.test.ts -t traslladar`
Expected: FAIL, `dataTrasladada` no existeix.

- [ ] **Step 3: Escriu la funció**

Afegeix a `src/modules/excursions/excursions.utils.ts`:

```ts
/**
 * Passa una data d'un curs escolar al següent conservant dia i mes. El curs va
 * de setembre a agost, així que als mesos de tardor i als de primavera se'ls
 * suma el mateix nombre d'anys de diferència entre els dos cursos.
 */
export function dataTrasladada(data: string | null, cursOrigen: string, cursDesti: string): string | null {
  if (!data) return null
  const salt = Number(cursDesti.slice(0, 4)) - Number(cursOrigen.slice(0, 4))
  const [any, mes, dia] = data.split('-').map(Number)
  const nouAny = any + salt
  // El 29 de febrer no existeix cada any: es queda al 28.
  const ultimDia = new Date(nouAny, mes, 0).getDate()
  const nouDia = Math.min(dia, ultimDia)
  return `${nouAny}-${String(mes).padStart(2, '0')}-${String(nouDia).padStart(2, '0')}`
}
```

- [ ] **Step 4: Executa la prova i comprova que passa**

Run: `npx vitest run src/modules/excursions/excursions.utils.test.ts`
Expected: PASS, 10 proves.

- [ ] **Step 5: Escriu el diàleg i el mètode del store**

Afegeix a `useExcursions.ts`:

```ts
  copiarDelCurs: async (cursOrigen: string, ids: string[]) => {
    const desti = schoolYear()
    const files = await getAll<ExcursioRow>(TAULA_EXCURSIONS, 'data', { curs_escolar: cursOrigen })
    const grups = await getAll<GrupRow>('excursio_grups', 'grup')
    for (const f of files.filter((f) => ids.includes(f.id))) {
      const nova = await insertRow<ExcursioRow>(TAULA_EXCURSIONS, {
        etapa: f.etapa, lloc: f.lloc, poblacio: f.poblacio, activitat: f.activitat,
        data: dataTrasladada(f.data, cursOrigen, desti),
        hora_sortida: f.hora_sortida, hora_tornada: f.hora_tornada,
        transport: f.transport, transport_detall: f.transport_detall,
        observacions: f.observacions, curs_escolar: desti,
      })
      for (const g of grups.filter((g) => g.excursio_id === f.id)) {
        await insertRow('excursio_grups', { excursio_id: nova.id, grup: g.grup, alumnes_previstos: g.alumnes_previstos })
      }
    }
    await get().load(desti)
  },
```

Afegeix `copiarDelCurs: (cursOrigen: string, ids: string[]) => Promise<void>` a la interfície `ExcursionsState` i importa `dataTrasladada`.

Crea `src/modules/excursions/CopiarCursAnterior.tsx`. **Les còpies neixen com a esborranys** i **sense acompanyants**, perquè les persones canvien d'any:

```tsx
import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { getAll } from '../../services/db'
import { dataTrasladada, TAULA_EXCURSIONS, type ExcursioRow } from './excursions.utils'

interface Props {
  cursOrigen: string
  cursDesti: string
  onCopiar: (cursOrigen: string, ids: string[]) => Promise<void>
  onClose: () => void
}

export function CopiarCursAnterior({ cursOrigen, cursDesti, onCopiar, onClose }: Props) {
  const [files, setFiles] = useState<ExcursioRow[] | null>(null)
  const [triades, setTriades] = useState<string[]>([])
  const [copiant, setCopiant] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getAll<ExcursioRow>(TAULA_EXCURSIONS, 'data', { curs_escolar: cursOrigen })
      .then((f) => {
        // Les cancel·lades no es repeteixen: si es va anul·lar, no és un patró a copiar.
        const utils = f.filter((x) => x.estat !== 'Cancel·lada')
        setFiles(utils)
        setTriades(utils.map((x) => x.id))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error carregant el curs anterior'))
  }, [cursOrigen])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-text-main">Copia les excursions del curs {cursOrigen}</h2>
          <button onClick={onClose} disabled={copiant} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && <p className="text-xs text-red-600">{error}</p>}
          {!files && !error && <p className="text-xs text-gray-400">Carregant…</p>}
          {files?.length === 0 && <p className="text-sm text-gray-400 italic">El curs {cursOrigen} no té excursions.</p>}
          {files && files.length > 0 && (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Es crearan com a esborranys al curs {cursDesti}, amb les dates un any més tard i els mateixos grups.
                Els acompanyants no es copien.
              </p>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {files.map((f) => (
                  <label key={f.id} className="flex items-center gap-3 px-3 py-2 text-xs cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={triades.includes(f.id)}
                      onChange={(e) => setTriades((s) => e.target.checked ? [...s, f.id] : s.filter((x) => x !== f.id))}
                    />
                    <span className="text-gray-400 w-16">{dataTrasladada(f.data, cursOrigen, cursDesti) ?? 'sense data'}</span>
                    <span className="w-20">{f.etapa}</span>
                    <span className="flex-1 text-text-main">{f.activitat || f.lloc}</span>
                    <span className="text-gray-400">{f.lloc}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} disabled={copiant} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancel·la
          </button>
          <button
            disabled={copiant || triades.length === 0}
            onClick={async () => {
              setCopiant(true)
              try { await onCopiar(cursOrigen, triades); onClose() }
              catch (err) { setError(err instanceof Error ? err.message : 'Error copiant'); setCopiant(false) }
            }}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
            style={{ backgroundColor: '#861414' }}
          >
            {copiant && <Loader2 size={15} className="animate-spin" />}
            Copia {triades.length > 0 ? triades.length : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
```

Perquè el diàleg pugui importar `ExcursioRow` com a tipus, exporta'l des de `excursions.utils.ts` (ja ho està) i afegeix-hi també `TAULA_EXCURSIONS` a l'import.

Al wrapper, ensenya el botó **"Copiar del curs anterior"** de manera destacada **quan el curs actual encara no tingui cap excursió**, que és la situació de setembre.

- [ ] **Step 6: Comprova-ho a mà**

Run: `npm run dev`
Amb excursions del curs anterior a la base, obre el mòdul en un curs buit: ha de proposar copiar-les. Copia'n dues i comprova que surten com a esborranys amb les dates un any més tard i amb els seus grups.

- [ ] **Step 7: Commit**

```bash
npm run lint && npm test && npm run build
git add src/ && git commit -m "feat(excursions): copiar el pla del curs anterior"
```

---

## Quan estigui tot

Abans d'obrir el Pull Request:

- [ ] `npm run lint`, `npm test` i `npm run build` en verd.
- [ ] Afegeix a `docs/verificacio-manual.md` una fase nova per a Excursions amb, com a mínim: que un professor no pugui editar la proposta d'un altre; que el servidor rebutgi una proposta incompleta encara que es forci des de la consola; que els aprovadors rebin **un sol correu al dia**; i que un compte amb la casella de gestió **no vegi cap dada econòmica** (a la Fase B això serà el punt important).
- [ ] La migració `202609190001_excursions.sql` s'aplica a producció **després** de desplegar el frontend, com es va fer amb Horaris: amb el frontend nou i la base antiga el mòdul no apareix, mentre que a l'inrevés apareixeria trencat.
