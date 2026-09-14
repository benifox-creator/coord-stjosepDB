begin;
alter table public.comandes_infantil add column fotografia jsonb;
alter table public.comandes_infantil drop constraint comandes_infantil_curs_etapa_material_key;
create unique index comandes_infantil_active_key on public.comandes_infantil(curs_escolar,etapa,material_id) where estat<>'Cancel·lat';
create or replace function app_private.freeze_order() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m public.materials_infantil; p public.proveidors_infantil; pupils numeric; quantity numeric; stock_used numeric;
begin
  if new.estoc_aplicat<0 or new.marge_seguretat<0 then raise exception 'Estoc i marge no poden ser negatius'; end if;
  if tg_op='UPDATE' and old.fotografia is not null then
    if new.material_id<>old.material_id or new.curs_escolar<>old.curs_escolar or new.etapa<>old.etapa or new.estoc_aplicat<>old.estoc_aplicat or new.marge_seguretat<>old.marge_seguretat or new.estat in ('Pendent','Revisar') then
      raise exception 'La comanda confirmada conserva quantitats i preus. Cancel·la-la abans de preparar-ne una altra.';
    end if;
    if old.estat='Cancel·lat' and new.estat<>'Cancel·lat' then raise exception 'Una comanda cancel·lada no es pot reobrir. Crea una línia nova.'; end if;
    new.fotografia:=old.fotografia;
    return new;
  end if;
  -- Serialize allocations of the same stock across stages.
  select * into strict m from public.materials_infantil where id=new.material_id for update;
  select coalesce(sum(estoc_aplicat),0) into stock_used from public.comandes_infantil
    where material_id=new.material_id and curs_escolar=new.curs_escolar and id<>new.id and estat<>'Cancel·lat';
  if new.estat<>'Cancel·lat' and stock_used+new.estoc_aplicat>m.recompte_manual+m.entrades_rebudes-m.consum_manual then raise exception 'L’estoc ja està assignat a altres etapes'; end if;
  new.fotografia:=null;
  if new.estat in ('Demanat','Rebut') then
    select (valors->>0)::numeric into pupils from public.config where clau='material-infantil.alumnes-'||lower(new.etapa)||'.'||new.curs_escolar;
    if pupils is null then select (valors->>0)::numeric into pupils from public.config where clau='material-infantil.alumnes-'||lower(new.etapa); end if;
    if pupils is null or pupils<=0 then raise exception 'Configura el nombre d’alumnes abans de confirmar la comanda'; end if;
    select * into p from public.proveidors_infantil where id=m.proveidor_id;
    quantity:=ceil(greatest(0,m.unitats_per_alumne*pupils+new.marge_seguretat-new.estoc_aplicat));
    new.fotografia:=jsonb_build_object('quantitat',quantity,'preu_unitari',m.preu_unitari,'cost',round(quantity*m.preu_unitari,2),'material',to_jsonb(m),'proveidor',case when p.id is null then null else to_jsonb(p) end,'confirmat_el',now());
  end if;
  return new;
end;
$$;
create trigger freeze_order before insert or update on public.comandes_infantil for each row execute function app_private.freeze_order();
-- Historical rows stay explicitly without a snapshot: past prices cannot be reconstructed from today's catalog.
revoke all on function app_private.freeze_order() from public;
commit;
