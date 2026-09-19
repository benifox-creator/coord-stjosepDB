begin;

-- Dos permisos i no un: amb un de sol no es podria distingir Secretaria, que
-- negocia amb les empreses i ha de veure els costos, d'un docent a qui
-- s'activi la gestió per ajudar a organitzar, que no els ha de veure.
alter table public.usuaris add column if not exists pot_gestionar_excursions boolean not null default false;
alter table public.usuaris add column if not exists pot_gestionar_costos_excursions boolean not null default false;

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

-- Sense aquesta redefinició, `excursions` cauria al valor per defecte genèric,
-- que inclou el convidat. I qui tingui les caselles de gestió ha de veure el
-- mòdul encara que el seu rol no hi doni accés: Secretaria no és professorat.
create or replace function app_private.module_visible(module_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare permissions jsonb; user_role text := app_private.role();
begin
  if user_role is null then return false; end if;
  if user_role = 'coordinador' then return true; end if;
  if module_name = 'material-infantil' and exists(select 1 from public.usuaris where lower(email)=app_private.email() and pot_gestionar_material) then return true; end if;
  if module_name = 'excursions' and exists(select 1 from public.usuaris where lower(email)=app_private.email()
    and (pot_gestionar_excursions or pot_gestionar_costos_excursions)) then return true; end if;
  select valors into permissions from public.config where clau = 'visibilitat.' || module_name;
  if permissions is null then
    permissions := case module_name
      when 'material-infantil' then '["direccio","titular","cap_estudis"]'::jsonb
      when 'horaris' then '["direccio","titular","cap_estudis","professorat"]'::jsonb
      when 'excursions' then '["direccio","titular","cap_estudis","professorat"]'::jsonb
      else '["direccio","titular","cap_estudis","professorat","convidat"]'::jsonb end;
  end if;
  return permissions ? user_role;
end;
$$;

create sequence if not exists public.excursions_codi_seq;

create table if not exists public.excursions (
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
create index if not exists excursions_curs_idx on public.excursions(curs_escolar, data);

create table if not exists public.excursio_grups (
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

create table if not exists public.excursio_acompanyants (
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
-- El `using` diu quines files pot tocar (només els seus esborranys) i el
-- `with check` com poden quedar: cal que hi càpiga 'Proposada', o enviar la
-- proposta seria rebutjat per la mateixa política que l'ha de permetre.
-- Que la transició sigui legítima ja ho comprova el disparador.
create policy excursions_propi on public.excursions for all to authenticated
using (app_private.module_visible('excursions') and app_private.creator()
  and creat_per = app_private.email() and estat = 'Esborrany')
with check (app_private.module_visible('excursions') and app_private.creator()
  and creat_per = app_private.email() and estat in ('Esborrany','Proposada'));

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

-- La màquina d'estats i els camps d'auditoria els imposa un disparador i no el
-- client: així la regla es compleix encara que algú escrigui directament contra
-- l'API, i no només quan passa per la interfície. És el mateix que fa
-- `app_private.validate_schedule()` a Horaris.
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
      -- Una sola clau per aprovador i dia: el resum diari surt d'aquí. Amb 50
      -- propostes en una setmana de setembre, cadascú rep un correu al dia.
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

-- Avís de cancel·lació a part, perquè ha de llegir una taula filla.
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

commit;
