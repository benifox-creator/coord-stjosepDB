-- Correu de tancament d'incidència més complet i formal: salutació, dades de
-- la incidència, la resolució (camp comentaris) i signatura de Coordinació
-- Digital. Abans només deia que s'havia tancat.
-- La resta de la funció és la de 202611060001_avis_incidencia_nova.sql.
begin;
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
  if tg_table_name='incidencies' and tg_op='INSERT' then
    select valors->>0 into target from public.config where clau='incidencies.email';
    if coalesce(target,'')<>'' and lower(target)<>lower(coalesce(new.reporter,'')) then
      perform app_private.enqueue(target,'Nova incidència '||new.codi||' · '||new.prioritat,
        'Tipus: '||new.tipus_problema||E'\n'||
        'Localització: '||new.localitzacio||E'\n'||
        'Reportada per: '||coalesce(new.reporter,'')||E'\n\n'||
        new.descripcio_detallada||E'\n\nAccedeix a SJO Hub per gestionar-la.',
        'incident-created:'||new.id);
    end if;
  elsif tg_table_name='incidencies' and tg_op='UPDATE' then
    if new.estat='Tancada' and old.estat<>'Tancada' and new.reporter<>'' then
      perform app_private.enqueue(new.reporter,'Incidència '||new.codi||' resolta',
        E'Bon dia,\n\n'||
        'Us informem que la incidència '||new.codi||' que vau comunicar ha quedat resolta.'||E'\n\n'||
        'Tipus: '||coalesce(nullif(new.tipus_problema,''),'—')||E'\n'||
        'Localització: '||coalesce(nullif(new.localitzacio,''),'—')||E'\n'||
        case when coalesce(new.dispositiu,'')<>'' then 'Dispositiu: '||new.dispositiu||E'\n' else '' end||
        'Data de resolució: '||coalesce(nullif(new.data_resolucio,''),to_char(now() at time zone 'Europe/Madrid','DD/MM/YYYY'))||E'\n\n'||
        E'Descripció de la incidència:\n'||coalesce(nullif(new.descripcio_detallada,''),'—')||E'\n\n'||
        E'Resolució:\n'||coalesce(nullif(new.comentaris,''),'No s’hi han afegit observacions.')||E'\n\n'||
        'Si el problema persisteix o torna a aparèixer, podeu comunicar-ho registrant una incidència nova a SJO Hub: https://benifox-creator.github.io/coord-stjosepDB/'||E'\n\n'||
        E'Gràcies per la vostra col·laboració.\n\n'||
        E'Coordinació Digital\nEscola Sant Josep Obrer');
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
revoke all on function app_private.operational_notification() from public;
commit;
