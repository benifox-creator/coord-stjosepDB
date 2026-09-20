begin;

-- Taules separades i no columnes amagades a `excursions`: les polítiques de
-- PostgreSQL són per fila, no per columna, i tothom entra amb el mateix tipus
-- de sessió. Amagar els costos només a la pantalla els deixaria a l'abast de
-- qualsevol que demanés les dades directament a l'API. Així el servidor
-- senzillament no els envia.
create table if not exists public.excursio_finances (
  excursio_id uuid primary key references public.excursions(id) on delete cascade,
  preu_activitat numeric(10,2) not null default 0,
  preu_activitat_tipus text not null default 'per_alumne'
    check (preu_activitat_tipus in ('per_alumne','total')),
  ampa_import numeric(10,2) not null default 0,
  ampa_cobreix_activitat boolean not null default false,
  cost_acompanyants numeric(10,2) not null default 0,
  -- Els paràmetres amb què es va calcular, desats en confirmar el preu perquè
  -- el càlcul sigui reproduïble encara que després es canviï la configuració.
  previsio_usada numeric(4,3),
  marge_pct_usat numeric(5,2),
  iva_pct_usat numeric(5,2)
);

-- Una fila per autocar. S'acaba el text "406+406", que l'Excel partia pel
-- primer '+' i deixava el preu en blanc quan n'hi havia tres.
create table if not exists public.excursio_autocars (
  id uuid primary key default gen_random_uuid(),
  excursio_id uuid not null references public.excursions(id) on delete cascade,
  places integer not null default 0 check (places >= 0),
  preu numeric(10,2) not null default 0 check (preu >= 0)   -- sense IVA
);
create index if not exists excursio_autocars_excursio on public.excursio_autocars(excursio_id);

alter table public.excursio_finances enable row level security;
alter table public.excursio_autocars enable row level security;

-- Una sola política per taula, per a totes les operacions: qui veu els diners
-- és exactament qui els pot tocar. Dues polítiques separades només serien dues
-- coses a mantenir sincronitzades.
create policy excursio_finances_costos on public.excursio_finances for all to authenticated
using (app_private.module_visible('excursions') and app_private.excursions_costos())
with check (app_private.module_visible('excursions') and app_private.excursions_costos());

create policy excursio_autocars_costos on public.excursio_autocars for all to authenticated
using (app_private.module_visible('excursions') and app_private.excursions_costos())
with check (app_private.module_visible('excursions') and app_private.excursions_costos());

-- L'RLS filtra files; el GRANT dona accés a la taula. Calen les dues coses.
do $$ declare t text; begin
  foreach t in array array['excursio_finances','excursio_autocars'] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function app_private.audit_change()', t);
    -- Reben cascades quan s'esborra una excursió: com les altres filles,
    -- tenen marge però no il·limitat.
    execute format(
      'create trigger fre_esborrats after delete on public.%I
       referencing old table as esborrades
       for each statement execute function app_private.fre_esborrats(%L)', t, '50');
  end loop;
end $$;

commit;
