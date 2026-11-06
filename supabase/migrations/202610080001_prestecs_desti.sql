-- On ha anat el material d'un préstec (aula o grup). Opcional.
begin;
alter table public.prestecs add column desti text not null default '';

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
  insert into public.prestecs(dispositiu_id,dispositiu_nom,usuari,email,data_inici,data_fi_prevista,notes,desti,request_id)
  values(coalesce(p_data->>'dispositiu_id',''),coalesce(p_data->>'dispositiu_nom',''),p_data->>'usuari',coalesce(p_data->>'email',''),p_data->>'data_inici',coalesce(p_data->>'data_fi_prevista',''),coalesce(p_data->>'notes',''),coalesce(trim(p_data->>'desti'),''),p_request_id) returning * into result;
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
commit;
