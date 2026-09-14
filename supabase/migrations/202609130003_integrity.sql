begin;
create unique index usuaris_email_normalized_key on public.usuaris (lower(email));

create or replace function public.format_code(prefix text, n bigint) returns text
language sql immutable set search_path = '' as $$
  select prefix || '-' || lpad(n::text, greatest(3,length(n::text)), '0');
$$;
do $$ declare pair text[]; begin
  foreach pair slice 1 in array array[
    ['substitucions','SUB'],['absencies','ABS'],['inventari','INV'],['incidencies','INC'],['manteniment','MAN'],
    ['coneixement','ART'],['projectes','PRJ'],['tasques','TAS'],['material','MAT'],['prestecs','PRE'],['reserves','RES'],['materials_infantil','MINF']
  ] loop
    execute format('alter table public.%I alter column codi set default public.format_code(%L,nextval(%L))',pair[1],pair[2],'public.'||pair[1]||'_codi_seq');
  end loop;
end $$;

create or replace function app_private.minutes(value text) returns integer
language plpgsql immutable set search_path = '' as $$
declare h integer; m integer;
begin
  if value !~ '^([0-9]|[01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Hora invàlida: %', value; end if;
  h:=split_part(value,':',1)::integer; m:=split_part(value,':',2)::integer;
  return h*60+m;
end;
$$;
create or replace function app_private.slot(value text) returns int4range
language plpgsql immutable set search_path = '' as $$
declare a integer; b integer;
begin
  if array_length(string_to_array(value,'-'),1) <> 2 then raise exception 'Franja invàlida'; end if;
  a:=app_private.minutes(trim(split_part(value,'-',1))); b:=app_private.minutes(trim(split_part(value,'-',2)));
  if b <= a then raise exception 'La franja ha d’acabar després de començar'; end if;
  return int4range(a,b,'[)');
end;
$$;
create or replace function app_private.validate_reservation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if trim(new.espai)='' then raise exception 'Cal indicar un espai'; end if;
  perform new.data::date;
  perform app_private.slot(new.hora_inici||'-'||new.hora_fi);
  if tg_op='INSERT' and not app_private.manager() then
    new.email:=app_private.email();
    new.estat:='Pendent';
  end if;
  if new.estat <> 'Cancel·lada' then
    perform pg_advisory_xact_lock(hashtextextended('reserves:'||new.espai||new.data,0));
    if exists(select 1 from public.reserves r where r.id<>new.id and r.espai=new.espai and r.data=new.data
      and r.estat<>'Cancel·lada' and app_private.slot(r.hora_inici||'-'||r.hora_fi) && app_private.slot(new.hora_inici||'-'||new.hora_fi))
    then raise exception 'Aquest espai ja té una reserva en aquesta franja'; end if;
  end if;
  return new;
end;
$$;
create trigger validate_reservation before insert or update on public.reserves for each row execute function app_private.validate_reservation();

alter table public.prestecs add column request_id uuid unique;
alter table public.material add constraint material_stock_bounds check(quantitat_total>=0 and quantitat_disponible>=0 and quantitat_disponible<=quantitat_total) not valid;

create or replace function public.create_loan(p_data jsonb,p_items jsonb,p_request_id uuid) returns public.prestecs
language plpgsql security definer set search_path = '' as $$
declare result public.prestecs; item record; mid uuid; quantity integer;
begin
  if not (app_private.module_visible('prestecs') and app_private.creator()) then raise exception 'No autoritzat'; end if;
  if p_request_id is null then raise exception 'Cal identificar la petició'; end if;
  perform pg_advisory_xact_lock(hashtextextended('loan:'||p_request_id::text,0));
  select * into result from public.prestecs where request_id=p_request_id;
  if found then return result; end if;
  if coalesce(trim(p_data->>'usuari'),'')='' then raise exception 'Cal indicar la persona'; end if;
  if coalesce(p_data->>'dispositiu_id','')='' and jsonb_array_length(p_items)=0 then raise exception 'Cal indicar dispositiu o material'; end if;
  perform (p_data->>'data_inici')::date;
  if nullif(p_data->>'data_fi_prevista','')::date < (p_data->>'data_inici')::date then raise exception 'Dates invàlides'; end if;
  if coalesce(p_data->>'dispositiu_id','')<>'' then
    perform pg_advisory_xact_lock(hashtextextended('device:'||(p_data->>'dispositiu_id'),0));
    if exists(select 1 from public.prestecs where dispositiu_id=p_data->>'dispositiu_id' and estat<>'Retornat') then raise exception 'Aquest dispositiu ja està en préstec'; end if;
  end if;
  insert into public.prestecs(dispositiu_id,dispositiu_nom,usuari,email,data_inici,data_fi_prevista,notes,request_id)
  values(coalesce(p_data->>'dispositiu_id',''),coalesce(p_data->>'dispositiu_nom',''),p_data->>'usuari',coalesce(p_data->>'email',''),p_data->>'data_inici',coalesce(p_data->>'data_fi_prevista',''),coalesce(p_data->>'notes',''),p_request_id) returning * into result;
  for item in select value from jsonb_array_elements(p_items) order by value->>'codi' loop
    quantity:=(item.value->>'quantitat')::integer;
    if quantity is null or quantity<=0 then raise exception 'Quantitat invàlida'; end if;
    update public.material set quantitat_disponible=quantitat_disponible-quantity
      where codi=item.value->>'codi' and quantitat_disponible>=quantity returning id into mid;
    if not found then raise exception 'Estoc insuficient o material desconegut: %',item.value->>'codi'; end if;
    insert into public.prestec_items(prestec_id,material_id,quantitat) values(result.id,mid,quantity);
  end loop;
  return result;
end;
$$;

create or replace function public.change_loan_state(p_id uuid,p_state text) returns void
language plpgsql security definer set search_path = '' as $$
declare loan public.prestecs; item record;
begin
  if not (app_private.module_visible('prestecs') and app_private.manager()) then raise exception 'No autoritzat'; end if;
  if p_state not in ('Actiu','Vençut','Retornat') then raise exception 'Estat invàlid'; end if;
  select * into strict loan from public.prestecs where id=p_id for update;
  if loan.estat=p_state then return; end if;
  if loan.estat='Retornat' then raise exception 'Un préstec retornat no es pot reobrir. Crea un préstec nou.'; end if;
  if p_state='Retornat' then
    for item in select * from public.prestec_items where prestec_id=p_id order by material_id loop
      update public.material set quantitat_disponible=quantitat_disponible+item.quantitat where id=item.material_id;
    end loop;
  end if;
  update public.prestecs set estat=p_state, data_fi_real=case when p_state='Retornat' then current_date::text else data_fi_real end where id=p_id;
end;
$$;
create or replace function public.delete_loan(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.admin() then raise exception 'No autoritzat'; end if;
  if not exists(select 1 from public.prestecs where id=p_id) then return; end if;
  perform public.change_loan_state(p_id,'Retornat');
  delete from public.prestecs where id=p_id;
end;
$$;
revoke all on function public.create_loan(jsonb,jsonb,uuid),public.change_loan_state(uuid,text),public.delete_loan(uuid) from public,anon;
grant execute on function public.create_loan(jsonb,jsonb,uuid),public.change_loan_state(uuid,text),public.delete_loan(uuid) to authenticated;
revoke all on all functions in schema app_private from public;
grant execute on all functions in schema app_private to authenticated;
commit;
