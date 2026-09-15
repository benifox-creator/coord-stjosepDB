begin;

-- La coordinació pot crear, editar i eliminar l'horari de qualsevol professor.
-- La resta de rols (direcció, titular, cap d'estudis, professorat) mantenen el
-- que tenien: veure segons `schedule_read`, escriure només el seu propi horari.
drop policy own_schedule on public.horaris;
create policy own_schedule on public.horaris for all to authenticated
using (app_private.module_visible('horaris') and app_private.creator()
  and (professor=app_private.email() or app_private.admin()))
with check (app_private.module_visible('horaris') and app_private.creator()
  and (professor=app_private.email() or app_private.admin()));

-- En obrir l'escriptura a horaris d'altri, un error d'escriptura al camp
-- `professor` crearia un horari orfe que ningú veuria (ni el seu suposat
-- titular, que no hi coincideix, ni cap validació d'absències). Per això, en
-- crear un horari per a una altra persona, aquesta ha d'existir a `usuaris`.
-- No s'aplica a l'horari propi: qui té sessió vàlida ja és al claustre.
create or replace function app_private.validate_schedule() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='DELETE' then
    perform pg_advisory_xact_lock(hashtextextended('schedule:'||old.professor,0));
    return old;
  end if;
  if tg_op='UPDATE' and new.professor<>old.professor then raise exception 'No es pot canviar el titular de l’horari'; end if;
  if tg_op='INSERT' then
    new.creat_per:=app_private.email();
    if new.professor is distinct from app_private.email()
      and not exists(select 1 from public.usuaris where lower(email)=lower(new.professor)) then
      raise exception 'El professor ha d’estar donat d’alta a Usuaris';
    end if;
  end if;
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

commit;
