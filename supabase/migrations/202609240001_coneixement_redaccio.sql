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
      when 'material-infantil' then '["direccio","titular","cap_estudis"]'::jsonb
      when 'horaris' then '["direccio","titular","cap_estudis","professorat"]'::jsonb
      when 'excursions' then '["direccio","titular","cap_estudis","professorat"]'::jsonb
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
    -- Fora d'una sessió amb JWT (l'editor SQL, `service_role`, un seed, un
    -- backfill) `app_private.email()` torna nul: no és cap sessió d'usuari,
    -- és una càrrega feta des de fora. `autor` no admet nuls, així que hi
    -- cau un valor buit en comptes de fer petar la càrrega.
    new.autor := coalesce(app_private.email(), '');
    new.creat_el := to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD');
    if not app_private.admin() then new.publicat := false; end if;
  else
    -- Mateix motiu: si mai hi hagués una fila amb `autor` nul (una càrrega
    -- feta abans d'aquest `coalesce`), una actualització posterior sense
    -- sessió no pot tornar a fer petar el not-null.
    new.autor := coalesce(old.autor, '');
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
