begin;

-- Quants alumnes de cada grup han pagat. Un recompte i res més: ni noms, ni
-- números de llista, ni imports. El que el centre vol saber és la xifra
-- recaptada —perseguir qui deu diners ho continua fent el tutor amb la seva
-- llista—, i per a la xifra un recompte per grup ja n'hi ha prou.
alter table public.excursio_grups add column if not exists alumnes_pagats integer not null default 0;
alter table public.excursio_grups drop constraint if exists excursio_grups_pagats_check;
-- Sense límit superior a propòsit: els previstos s'escriuen al setembre i el
-- nombre es mou, així que pagar-ne més dels previstos és una dada correcta.
alter table public.excursio_grups add constraint excursio_grups_pagats_check
  check (alumnes_pagats >= 0);

-- Qui apunta els pagaments és el tutor, que no pot escriure aquesta taula: la
-- política només hi deixa entrar qui gestiona excursions o l'autor mentre és
-- esborrany. I les polítiques de PostgreSQL són **per fila, no per columna**,
-- així que obrir-la del tot també deixaria tocar les previsions.
--
-- La sortida és el permís per columna: es retira l'`update` sobre la taula i
-- es torna a concedir només sobre les columnes de sempre. Llavors un `update`
-- directe sobre `alumnes_pagats` falla per privilegis —també per a qui
-- gestiona excursions— i només hi entra la funció de sota, que corre com la
-- propietària. És el mateix que ja es fa a `prestecs`, on `authenticated`
-- només pot actualitzar `notes`.
revoke update on public.excursio_grups from authenticated;
grant update (grup, alumnes_previstos, alumnes_finals) on public.excursio_grups to authenticated;

-- I el mateix amb l'`insert`, que si no deixaria la clausura de sobre sense
-- efecte: el privilegi d'insert de la Fase A és **per taula i cobreix totes
-- les columnes**, així que un grup podria néixer amb el recompte ja escrit, i
-- un `delete` seguit d'un `insert` permetria reescriure'n un de registrat. Es
-- torna a concedir només sobre les columnes que el client escriu de debò: ni
-- l'`id` (que ja té `default`) ni `alumnes_pagats` no surten mai de cap insert
-- de l'aplicació, així que aquí no se li treu res que faci servir.
revoke insert on public.excursio_grups from authenticated;
grant insert (excursio_id, grup, alumnes_previstos, alumnes_finals) on public.excursio_grups to authenticated;

create or replace function public.registra_pagaments(p_grup uuid, p_pagats integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Qualsevol que vegi el mòdul, sobre qualsevol grup: `usuaris` no sap qui és
  -- tutor de quin grup, i restringir-ho a qui va proposar l'excursió deixaria
  -- el tutor de B sense poder apuntar el seu quan la proposa el de A. Queda
  -- rastre: la taula té el disparador d'auditoria des de la Fase A.
  if not (app_private.module_visible('excursions') and app_private.creator()) then
    raise exception 'No autoritzat';
  end if;
  if p_pagats is null or p_pagats < 0 then
    raise exception 'El nombre de pagaments no pot ser negatiu';
  end if;

  update public.excursio_grups set alumnes_pagats = p_pagats where id = p_grup;
  if not found then raise exception 'Aquest grup no existeix'; end if;
end;
$$;

revoke all on function public.registra_pagaments(uuid, integer) from public, anon, authenticated;
grant execute on function public.registra_pagaments(uuid, integer) to authenticated;

commit;
