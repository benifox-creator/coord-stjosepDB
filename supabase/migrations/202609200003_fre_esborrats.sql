begin;

-- Fre als esborrats massius.
--
-- Tots els esborrats de l'aplicació passen per `deleteRowById`, que filtra per
-- identificador: **exactament una fila per sentència**. L'única excepció són
-- les cascades (una excursió s'emporta els seus grups i acompanyants, una
-- absència els seus períodes, un préstec els seus articles), i per això les
-- taules filles tenen més marge.
--
-- Això atura un error de programació que oblidés el filtre —que esborraria tot
-- el que l'RLS deixi veure— i un abús des de l'API amb una sessió normal. **No
-- atura ningú amb credencials completes**, que pot desactivar el disparador:
-- per a això només hi ha còpies de seguretat.
create or replace function app_private.fre_esborrats() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n integer; maxim integer := tg_argv[0]::integer;
begin
  select count(*) into n from esborrades;
  if n > maxim then
    raise exception 'Esborrat massiu aturat: s''intentaven esborrar % files de %, i el màxim per operació és %.',
      n, tg_table_name, maxim;
  end if;
  return null;
end;
$$;

do $$
declare t text; maxim int;
  -- Les filles reben cascades: una sortida de tota una etapa pot arrossegar
  -- divuit grups. Tenen marge, però no il·limitat.
  filles text[] := array['excursio_grups','excursio_acompanyants','absencia_periodes','prestec_items'];
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    maxim := case when t = any(filles) then 50 else 1 end;
    execute format(
      'create trigger fre_esborrats after delete on public.%I
       referencing old table as esborrades
       for each statement execute function app_private.fre_esborrats(%L)', t, maxim::text);
  end loop;
end $$;

commit;
