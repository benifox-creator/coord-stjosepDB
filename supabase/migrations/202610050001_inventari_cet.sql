begin;

-- Catàleg d'aules i espais. El full CET ja el portava (pestanya Barems): cada
-- ubicació té un sol edifici i una sola planta, i així dos dispositius de la
-- mateixa aula no poden dir coses diferents.
create table if not exists public.ubicacions (
  id uuid primary key default gen_random_uuid(),
  codi text not null unique,
  edifici text not null default '',
  planta text not null default '',
  constraint ubicacions_codi_no_buit check (trim(codi) <> '')
);
alter table public.ubicacions enable row level security;

-- L'RLS filtra files; el GRANT dona accés a la taula. Calen les dues coses.
revoke all on public.ubicacions from anon, authenticated;
grant select, insert, update, delete on public.ubicacions to authenticated;

-- La mateixa regla que inventari: la veu qui veu el mòdul, la toca la coordinació.
create policy ubicacions_read on public.ubicacions for select to authenticated
using (app_private.module_visible('inventari'));
create policy ubicacions_admin on public.ubicacions for all to authenticated
using (app_private.module_visible('inventari') and app_private.admin())
with check (app_private.module_visible('inventari') and app_private.admin());

create trigger audit_change after insert or update or delete on public.ubicacions
for each row execute function app_private.audit_change();
create trigger fre_esborrats after delete on public.ubicacions
referencing old table as esborrades
for each statement execute function app_private.fre_esborrats('1');

-- La ubicació d'un dispositiu passa a ser un codi del catàleg. Pot ser buida
-- (null): al full n'hi ha uns quants sense aula. Les que ja hi hagués escrites
-- a mà entren al catàleg tal qual, perquè la clau forana no les rebutgi.
alter table public.inventari alter column ubicacio drop not null;
alter table public.inventari alter column ubicacio drop default;
update public.inventari set ubicacio = null where trim(ubicacio) = '';
insert into public.ubicacions(codi)
  select distinct ubicacio from public.inventari where ubicacio is not null
  on conflict (codi) do nothing;
-- Reanomenar una ubicació arriba als seus dispositius; esborrar-ne una que
-- encara en té no es pot.
alter table public.inventari add constraint inventari_ubicacio_fkey
  foreign key (ubicacio) references public.ubicacions(codi)
  on update cascade on delete restrict;

-- Nou estats fixos. No són una llista de Configuració perquè el Dashboard i
-- les etiquetes de color en depenen.
alter table public.inventari drop constraint if exists inventari_estat_check;
alter table public.inventari add constraint inventari_estat_check check (estat in (
  'Actiu','Avariat','En reparació','En préstec','En proves',
  'No desplegat','Retirat temporalment','De baixa','Robat'));

-- Els valors surten de dues llistes editables de Configuració
-- (inventari.accions i inventari.sistemes-operatius); per això són text lliure.
alter table public.inventari add column if not exists accio text not null default '';
alter table public.inventari add column if not exists sistema_operatiu text not null default '';

commit;
