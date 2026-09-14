begin;
create or replace function app_private.school_year(d date) returns text
language sql immutable set search_path = '' as $$
  select (extract(year from d)::integer - case when extract(month from d)<9 then 1 else 0 end)::text || '-' ||
    (extract(year from d)::integer + case when extract(month from d)>=9 then 1 else 0 end)::text;
$$;
alter table public.horaris add column curs_escolar text not null default app_private.school_year(current_date);
alter table public.horaris add column vigent_desde date;
alter table public.horaris add column vigent_fins date;
alter table public.horaris add column necessita_cobertura boolean not null default false;
update public.horaris set vigent_desde=(left(curs_escolar,4)||'-09-01')::date,
  vigent_fins=(right(curs_escolar,4)||'-08-31')::date, necessita_cobertura=(tipus='Lectiva' or materia in ('Pati','Guàrdia'));
alter table public.horaris alter column vigent_desde set not null;
alter table public.horaris alter column vigent_fins set not null;
alter table public.horaris drop constraint if exists horaris_professor_dia_etapa_franja_key;
create index horaris_professor_vigencia_idx on public.horaris(professor,vigent_desde,vigent_fins);
alter table public.absencia_periodes add column necessita_cobertura boolean not null default true;
alter table public.substitucions add column periode_absencia_id uuid unique references public.absencia_periodes(id);
alter table public.absencies add column request_id uuid unique;
alter table public.absencies add column te_periodes boolean not null default false;

create or replace function app_private.validate_schedule() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='DELETE' then
    perform pg_advisory_xact_lock(hashtextextended('schedule:'||old.professor,0));
    return old;
  end if;
  if tg_op='UPDATE' and new.professor<>old.professor then raise exception 'No es pot canviar el titular de l’horari'; end if;
  if tg_op='INSERT' then new.creat_per:=app_private.email(); end if;
  if new.vigent_fins<new.vigent_desde or app_private.school_year(new.vigent_desde)<>new.curs_escolar or app_private.school_year(new.vigent_fins)<>new.curs_escolar then
    raise exception 'La vigència ha de pertànyer al curs escolar';
  end if;
  if trim(new.materia)='' or (new.tipus='Lectiva' and trim(new.grup)='') then raise exception 'Cal indicar matèria i grup per a una classe'; end if;
  perform app_private.slot(new.franja);
  perform pg_advisory_xact_lock(hashtextextended('schedule:'||new.professor,0));
  if exists(select 1 from public.horaris h where h.id<>new.id and h.professor=new.professor and h.dia_setmana=new.dia_setmana
      and daterange(h.vigent_desde,h.vigent_fins,'[]') && daterange(new.vigent_desde,new.vigent_fins,'[]')
      and app_private.slot(h.franja) && app_private.slot(new.franja)) then
    raise exception 'Aquest professor ja té un període que se solapa, també entre etapes';
  end if;
  if (new.tipus='Lectiva' or new.materia='Pati') and exists(
    select 1 from public.substitucions s where s.professor_substitut=new.professor and s.estat<>'Cancel·lada'
    and s.data between new.vigent_desde and new.vigent_fins
    and (array['Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte','Diumenge'])[extract(isodow from s.data)::integer]=new.dia_setmana
    and app_private.slot(s.franja)&&app_private.slot(new.franja)
  ) then raise exception 'El període se solapa amb una substitució assignada'; end if;
  return new;
end;
$$;
create trigger validate_schedule before insert or update or delete on public.horaris for each row execute function app_private.validate_schedule();

create or replace function public.create_absence(p_data jsonb,p_periode_ids uuid[],p_request_id uuid) returns public.absencies
language plpgsql security definer set search_path = '' as $$
declare result public.absencies; d date; n integer; total integer; nonteaching integer; first_hour text; last_hour text; weekday text;
begin
  if not(app_private.module_visible('substitucions') and app_private.creator()) then raise exception 'No autoritzat'; end if;
  if p_request_id is null then raise exception 'Cal identificar la petició'; end if;
  perform pg_advisory_xact_lock(hashtextextended('absence:'||p_request_id::text,0));
  select * into result from public.absencies where request_id=p_request_id;
  if found then
    if result.professor<>app_private.email() then raise exception 'No autoritzat'; end if;
    return result;
  end if;
  d:=(p_data->>'data')::date;
  if d is null or coalesce(trim(p_data->>'motiu'),'')='' then raise exception 'Cal indicar data i motiu'; end if;
  if cardinality(p_periode_ids)>0 then
    perform pg_advisory_xact_lock(hashtextextended('schedule:'||app_private.email(),0));
    if exists(select 1 from public.config where clau='centre.dies-no-lectius' and valors ? d::text) then raise exception 'És un dia no lectiu. Revisa la data o utilitza l’entrada manual.'; end if;
    weekday:=(array['Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte','Diumenge'])[extract(isodow from d)::integer];
    select count(*),sum(upper(app_private.slot(franja))-lower(app_private.slot(franja))),
      coalesce(sum(upper(app_private.slot(franja))-lower(app_private.slot(franja))) filter(where tipus='No lectiva'),0),
      to_char(time '00:00'+min(lower(app_private.slot(franja)))*interval '1 minute','HH24:MI'),
      to_char(time '00:00'+max(upper(app_private.slot(franja)))*interval '1 minute','HH24:MI')
    into n,total,nonteaching,first_hour,last_hour from public.horaris
    where id=any(p_periode_ids) and professor=app_private.email() and dia_setmana=weekday and d between vigent_desde and vigent_fins;
    if n<>cardinality(p_periode_ids) then raise exception 'L’horari ha canviat o els períodes no corresponen al professor i la data'; end if;
  else
    first_hour:=p_data->>'hora_inici'; last_hour:=p_data->>'hora_fi';
    total:=upper(app_private.slot(first_hour||'-'||last_hour))-lower(app_private.slot(first_hour||'-'||last_hour));
    nonteaching:=round(coalesce((p_data->>'hores_no_lectives')::numeric,0)*60);
    if total is null or nonteaching<0 or nonteaching>total then raise exception 'Hores invàlides'; end if;
  end if;
  insert into public.absencies(professor,data,hora_inici,hora_fi,hores,hores_no_lectives,motiu,notes,creat_per,request_id,te_periodes)
  values(app_private.email(),d,first_hour,last_hour,round(total/60.0,2),round(nonteaching/60.0,2),p_data->>'motiu',coalesce(p_data->>'notes',''),app_private.email(),p_request_id,coalesce(cardinality(p_periode_ids)>0,false)) returning * into result;
  insert into public.absencia_periodes(absencia_id,franja,etapa,tipus,grup,materia,necessita_cobertura)
  select result.id,franja,etapa,tipus,grup,materia,necessita_cobertura from public.horaris where id=any(p_periode_ids);
  return result;
end;
$$;

create or replace function public.review_absence(p_id uuid,p_approve boolean,p_reason text default '') returns public.absencies
language plpgsql security definer set search_path = '' as $$
declare result public.absencies; target_state text:=case when p_approve then 'Aprovada' else 'Rebutjada' end;
begin
  if not(app_private.module_visible('substitucions') and app_private.approver()) then raise exception 'No autoritzat'; end if;
  select * into strict result from public.absencies where id=p_id for update;
  if result.estat=target_state then return result; end if;
  if result.estat<>'Pendent revisió' then raise exception 'Aquesta absència ja ha estat revisada'; end if;
  perform pg_advisory_xact_lock(hashtextextended('schedule:'||result.professor,0));
  update public.absencies set estat=target_state,revisat_per=app_private.email(),revisat_el=now()::text,motiu_rebuig=case when p_approve then '' else p_reason end where id=p_id returning * into result;
  if p_approve then
    -- An approved absence makes existing cover assignments unavailable as well.
    update public.substitucions s set professor_substitut=''
    where s.professor_substitut=result.professor and s.data=result.data and s.estat='Pendent'
      and ((not result.te_periodes and app_private.slot(result.hora_inici||'-'||result.hora_fi)&&app_private.slot(s.franja))
        or exists(select 1 from public.absencia_periodes p where p.absencia_id=result.id and app_private.slot(p.franja)&&app_private.slot(s.franja)));
    insert into public.substitucions(data,etapa,franja,tipus,professor_absent,professor_substitut,grup,materia,notes,creat_per,absencia_id,periode_absencia_id)
    select result.data,p.etapa,p.franja,case when p.materia='Pati' then 'Pati' else 'Classe' end,
      result.professor,'',p.grup,p.materia,result.notes,app_private.email(),result.id,p.id
    from public.absencia_periodes p where p.absencia_id=p_id and p.necessita_cobertura
    on conflict (periode_absencia_id) do nothing;
  end if;
  return result;
end;
$$;

create or replace function app_private.validate_substitution() returns trigger
language plpgsql security definer set search_path = '' as $$
declare weekday text;
begin
  perform app_private.slot(new.franja);
  if new.absencia_id is not null and not exists(select 1 from public.absencies a where a.id=new.absencia_id and a.estat='Aprovada' and a.professor=new.professor_absent and a.data=new.data) then
    raise exception 'L’absència vinculada no és vàlida';
  end if;
  if new.estat='Realitzada' and new.professor_substitut='' then raise exception 'Cal assignar un professor abans de completar la substitució'; end if;
  if new.professor_substitut='' then return new; end if;
  if not exists(select 1 from public.usuaris where lower(email)=new.professor_substitut and rol<>'convidat') or new.professor_substitut=new.professor_absent then raise exception 'Professor substitut invàlid'; end if;
  if new.estat='Cancel·lada' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('schedule:'||new.professor_substitut,0));
  if exists(select 1 from public.substitucions s where s.id<>new.id and s.data=new.data and s.professor_substitut=new.professor_substitut and s.estat<>'Cancel·lada'
    and app_private.slot(s.franja)&&app_private.slot(new.franja)) then raise exception 'El professor ja té una substitució en aquesta franja'; end if;
  weekday:=(array['Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte','Diumenge'])[extract(isodow from new.data)::integer];
  if exists(select 1 from public.horaris h where h.professor=new.professor_substitut and h.dia_setmana=weekday
    and new.data between h.vigent_desde and h.vigent_fins and (h.tipus='Lectiva' or h.materia='Pati')
    and app_private.slot(h.franja)&&app_private.slot(new.franja)) then raise exception 'El professor té classe o pati en aquesta franja'; end if;
  if exists(select 1 from public.absencies a where a.professor=new.professor_substitut and a.data=new.data and a.estat='Aprovada'
    and ((not a.te_periodes and app_private.slot(a.hora_inici||'-'||a.hora_fi)&&app_private.slot(new.franja))
      or exists(select 1 from public.absencia_periodes p where p.absencia_id=a.id and app_private.slot(p.franja)&&app_private.slot(new.franja)))) then raise exception 'El professor està absent en aquesta franja'; end if;
  return new;
end;
$$;
create trigger validate_substitution before insert or update on public.substitucions for each row execute function app_private.validate_substitution();

create or replace function public.update_substitution(p_id uuid,p_teacher text,p_state text,p_expected_teacher text,p_expected_state text) returns public.substitucions
language plpgsql security definer set search_path = '' as $$
declare result public.substitucions;
begin
  if not app_private.module_visible('substitucions') then raise exception 'No autoritzat'; end if;
  select * into strict result from public.substitucions where id=p_id for update;
  if result.professor_substitut is distinct from p_expected_teacher or result.estat is distinct from p_expected_state then
    raise exception 'La substitució ha canviat. Actualitza les dades abans de continuar';
  end if;
  if not app_private.manager() and not(result.professor_substitut=app_private.email() and p_teacher=result.professor_substitut and p_state='Realitzada' and result.estat='Pendent') then raise exception 'No autoritzat'; end if;
  update public.substitucions set professor_substitut=lower(p_teacher),estat=p_state where id=p_id returning * into result;
  return result;
end;
$$;
revoke all on function public.create_absence(jsonb,uuid[],uuid),public.review_absence(uuid,boolean,text),public.update_substitution(uuid,text,text,text,text) from public,anon;
grant execute on function public.create_absence(jsonb,uuid[],uuid),public.review_absence(uuid,boolean,text),public.update_substitution(uuid,text,text,text,text) to authenticated;
revoke all on all functions in schema app_private from public;
grant execute on all functions in schema app_private to authenticated;
commit;
