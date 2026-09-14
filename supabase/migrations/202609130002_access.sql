begin;

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create or replace function app_private.email() returns text
language sql stable set search_path = '' as $$
  select case when auth.jwt()->>'email_verified' = 'true'
    and lower(auth.jwt()->>'email') like '%@stjosep.org'
    then lower(auth.jwt()->>'email') else null end;
$$;

create or replace function app_private.role() returns text
language sql stable security definer set search_path = '' as $$
  select rol from public.usuaris where lower(email) = app_private.email();
$$;
create or replace function app_private.manager() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(app_private.role() in ('coordinador','direccio','titular','cap_estudis'), false);
$$;
create or replace function app_private.admin() returns boolean
language sql stable set search_path = '' as $$ select coalesce(app_private.role() = 'coordinador', false); $$;
create or replace function app_private.creator() returns boolean
language sql stable set search_path = '' as $$ select coalesce(app_private.role() <> 'convidat', false); $$;
create or replace function app_private.approver() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(app_private.role() in ('coordinador','direccio','titular'), false);
$$;
create or replace function app_private.infantil_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select rol in ('coordinador','direccio','titular') or pot_gestionar_material
    from public.usuaris where lower(email) = app_private.email()), false);
$$;
create or replace function app_private.module_visible(module_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare permissions jsonb; user_role text := app_private.role();
begin
  if user_role is null then return false; end if;
  if user_role = 'coordinador' then return true; end if;
  if module_name = 'material-infantil' and exists(select 1 from public.usuaris where lower(email)=app_private.email() and pot_gestionar_material) then return true; end if;
  select valors into permissions from public.config where clau = 'visibilitat.' || module_name;
  if permissions is null then
    permissions := case module_name
      when 'material-infantil' then '["direccio","titular","cap_estudis"]'::jsonb
      when 'horaris' then '["direccio","titular","cap_estudis","professorat"]'::jsonb
      else '["direccio","titular","cap_estudis","professorat","convidat"]'::jsonb end;
  end if;
  return permissions ? user_role;
end;
$$;

-- Remove the permissive legacy policies, including installations that used another name.
do $$ declare p record; t text; begin
  for p in select tablename, policyname from pg_policies where schemaname='public'
    and tablename in ('usuaris','config','incidencies','inventari','material','prestecs','prestec_items','reserves',
    'substitucions','absencies','horaris','absencia_periodes','coneixement','projectes','tasques','manteniment',
    'materials_infantil','proveidors_infantil','comandes_infantil')
  loop execute format('drop policy %I on public.%I',p.policyname,p.tablename); end loop;
  foreach t in array array['usuaris','config','incidencies','inventari','material','prestecs','prestec_items','reserves',
    'substitucions','absencies','horaris','absencia_periodes','coneixement','projectes','tasques','manteniment',
    'materials_infantil','proveidors_infantil','comandes_infantil'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon',t);
    execute format('grant select, insert, update, delete on public.%I to authenticated',t);
  end loop;
end $$;

create policy read_registered on public.usuaris for select to authenticated using (app_private.role() is not null);
create policy admin_users on public.usuaris for all to authenticated using (app_private.admin()) with check (app_private.admin());
create policy read_config on public.config for select to authenticated using (app_private.role() is not null);
create policy admin_config on public.config for all to authenticated using (app_private.admin()) with check (app_private.admin());

do $$ declare t text; m text; begin
  foreach t in array array['inventari','material','prestecs','prestec_items','reserves','incidencies','manteniment','coneixement','projectes','tasques','materials_infantil','proveidors_infantil','comandes_infantil'] loop
    m := case when t in ('projectes','tasques') then 'pla-accio'
      when t in ('materials_infantil','proveidors_infantil','comandes_infantil') then 'material-infantil'
      when t='prestec_items' then 'prestecs' else t end;
    execute format('create policy module_read on public.%I for select to authenticated using (app_private.module_visible(%L))',t,m);
    if t not in ('prestecs','prestec_items') then
      execute format('create policy module_insert on public.%I for insert to authenticated with check (app_private.module_visible(%L) and %s)',t,m,
        case when t in ('inventari','coneixement') then 'app_private.admin()' when m='material-infantil' then 'app_private.infantil_manager()' else 'app_private.creator()' end);
      execute format('create policy module_update on public.%I for update to authenticated using (app_private.module_visible(%L) and %s) with check (app_private.module_visible(%L) and %s)',t,m,
        case when t in ('inventari','coneixement') then 'app_private.admin()' when m='material-infantil' then 'app_private.infantil_manager()' else 'app_private.manager()' end,m,
        case when t in ('inventari','coneixement') then 'app_private.admin()' when m='material-infantil' then 'app_private.infantil_manager()' else 'app_private.manager()' end);
      execute format('create policy module_delete on public.%I for delete to authenticated using (app_private.module_visible(%L) and %s)',t,m,
        case when m='material-infantil' then 'app_private.infantil_manager()' else 'app_private.admin()' end);
    end if;
  end loop;
end $$;

drop policy module_read on public.coneixement;
create policy module_read on public.coneixement for select to authenticated
using(app_private.module_visible('coneixement') and (app_private.admin() or publicat));

-- Existing departmental configuration powers; no access to centre-wide settings.
create policy infantil_config on public.config for all to authenticated
using (app_private.module_visible('material-infantil') and app_private.infantil_manager() and clau ~ '^material-infantil\.(curs-actiu|alumnes-i[345](\.[0-9]{4}-[0-9]{4})?|marge-seguretat-pct|pressupost-objectiu)$')
with check (app_private.module_visible('material-infantil') and app_private.infantil_manager() and clau ~ '^material-infantil\.(curs-actiu|alumnes-i[345](\.[0-9]{4}-[0-9]{4})?|marge-seguretat-pct|pressupost-objectiu)$');

create policy absence_read on public.absencies for select to authenticated
using (app_private.module_visible('substitucions') and (app_private.manager() or professor=app_private.email()));
create policy absence_delete on public.absencies for delete to authenticated using (app_private.admin());
create policy periods_read on public.absencia_periodes for select to authenticated
using (exists(select 1 from public.absencies a where a.id=absencia_id));
create policy schedule_read on public.horaris for select to authenticated
using (app_private.module_visible('horaris') and (app_private.manager() or professor=app_private.email()));
create policy own_schedule on public.horaris for all to authenticated
using (app_private.module_visible('horaris') and app_private.creator() and professor=app_private.email())
with check (app_private.module_visible('horaris') and app_private.creator() and professor=app_private.email());
create policy substitution_read on public.substitucions for select to authenticated
using (app_private.module_visible('substitucions') and (app_private.manager() or professor_substitut=app_private.email() or professor_absent=app_private.email()));
create policy substitution_insert on public.substitucions for insert to authenticated
with check (app_private.module_visible('substitucions') and app_private.manager() and creat_per=app_private.email());
create policy substitution_delete on public.substitucions for delete to authenticated using (app_private.admin());
create policy loan_notes on public.prestecs for update to authenticated using (app_private.module_visible('prestecs') and app_private.manager());
revoke update on public.prestecs from authenticated;
grant update(notes) on public.prestecs to authenticated;

-- Audit history is separate from editable operational records.
create table public.audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor text, table_name text not null, operation text not null,
  record_id text, before_row jsonb, after_row jsonb
);
alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;
create policy audit_admin on public.audit_events for select to authenticated using (app_private.admin());
create or replace function app_private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events(actor,table_name,operation,record_id,before_row,after_row)
  values (app_private.email(),tg_table_name,tg_op,coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id',to_jsonb(new)->>'clau',to_jsonb(old)->>'clau'),
    case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
  return coalesce(new,old);
end;
$$;
do $$ declare t text; begin
  foreach t in array array['usuaris','config','absencies','absencia_periodes','substitucions','horaris','prestecs','prestec_items','material','reserves','materials_infantil','comandes_infantil','inventari','incidencies','manteniment','coneixement','projectes','tasques','proveidors_infantil'] loop
    execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function app_private.audit_change()',t);
  end loop;
end $$;

revoke all on all functions in schema app_private from public;
grant execute on all functions in schema app_private to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke execute on function public.adjust_material_stock(uuid,integer) from public, anon, authenticated;
commit;
