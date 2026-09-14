begin;
alter table public.incidencies drop constraint incidencies_notificat_check;
alter table public.incidencies add constraint incidencies_notificat_check check(notificat in ('false','pending','true','queued'));
create or replace function app_private.operational_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target text;
begin
  if tg_op='INSERT' and tg_table_name in ('incidencies','manteniment') then
    new.reporter:=app_private.email();
  elsif tg_op='UPDATE' and tg_table_name='incidencies' then
    -- El reporter és qui va crear la incidència; no es pot canviar en una actualització
    -- (evita que qui la tanca desviï la notificació de resolució a una adreça arbitrària).
    new.reporter:=old.reporter;
  end if;
  if tg_table_name='incidencies' and tg_op='UPDATE' then
    if new.estat='Tancada' and old.estat<>'Tancada' and new.reporter<>'' then
      perform app_private.enqueue(new.reporter,'Incidència '||new.codi||' resolta',
        'La incidència '||new.codi||' s’ha tancat. Accedeix a SJO Hub per consultar la resolució.');
      new.notificat:='queued';
    end if;
  elsif tg_table_name='manteniment' and tg_op='INSERT' then
    select valors->>0 into target from public.config where clau='manteniment.email';
    if coalesce(target,'')<>'' then
      perform app_private.enqueue(target,'Manteniment: '||new.titol,
        new.codi||' · '||new.localitzacio||E'\n'||new.descripcio,'maintenance:'||new.id);
    end if;
  elsif tg_table_name='reserves' and new.estat='Pendent' then
    for target in select email from public.usuaris where rol='coordinador' loop
      perform app_private.enqueue(target,'Reserva pendent: '||new.espai,
        new.data||' · '||new.hora_inici||'–'||new.hora_fi||E'\nAccedeix a SJO Hub per revisar-la.',
        'reservation:'||new.id||':'||target);
    end loop;
  end if;
  return new;
end;
$$;
create trigger operational_notification before insert or update on public.incidencies for each row execute function app_private.operational_notification();
create trigger operational_notification before insert on public.manteniment for each row execute function app_private.operational_notification();
-- AFTER: validation may force a staff reservation to Pendent.
create trigger operational_notification after insert on public.reserves for each row execute function app_private.operational_notification();
revoke all on function app_private.operational_notification() from public;

create or replace function app_private.validate_configuration() returns trigger
language plpgsql set search_path = '' as $$
declare value text;
begin
  if jsonb_typeof(new.valors)<>'array' then raise exception 'La configuració ha de ser una llista'; end if;
  if exists(select 1 from jsonb_array_elements(new.valors) v where jsonb_typeof(v)<>'string') then
    raise exception 'Cada valor de configuració ha de ser text';
  end if;
  if new.clau='centre.dies-no-lectius' then
    for value in select jsonb_array_elements_text(new.valors) loop
      if value !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Data no lectiva invàlida'; end if;
      perform value::date;
    end loop;
  end if;
  if new.clau ~ '^material-infantil\.(alumnes-|marge-seguretat-pct|pressupost-objectiu)' then
    if jsonb_array_length(new.valors)<>1 or (new.valors->>0)::numeric<0 then raise exception 'Cal un valor numèric no negatiu'; end if;
  end if;
  if new.clau='material-infantil.curs-actiu' and
    (jsonb_array_length(new.valors)<>1 or (new.valors->>0) !~ '^\d{4}-\d{4}$'
      or right(new.valors->>0,4)::integer<>left(new.valors->>0,4)::integer+1) then
    raise exception 'Curs escolar invàlid';
  end if;
  return new;
end;
$$;
create trigger validate_configuration before insert or update on public.config for each row execute function app_private.validate_configuration();
revoke all on function app_private.validate_configuration() from public;
commit;
