begin;

-- El preu congelat viu a `excursions` i no a `excursio_finances` perquè
-- **és públic**: surt a la circular i les famílies l'han de veure. El que no
-- és públic és com s'ha arribat a aquest número.
alter table public.excursions add column if not exists preu_alumne numeric(10,2);
alter table public.excursions add column if not exists preu_confirmat_per text;
alter table public.excursions add column if not exists preu_confirmat_el timestamptz;
alter table public.excursions drop constraint if exists excursions_preu_alumne_check;
alter table public.excursions add constraint excursions_preu_alumne_check
  check (preu_alumne is null or preu_alumne >= 0);

-- Confirmar el preu és una acció del servidor i no una escriptura qualsevol:
-- qui el confirma ha de ser qui veu els costos, i l'excursió ha d'estar
-- aprovada. Un cop enviada la circular ja no es toca, perquè les famílies
-- tenen a casa un paper que diu un import.
create or replace function public.confirmar_preu(p_id uuid, p_preu numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare qui text := app_private.email(); actual text;
begin
  if not app_private.excursions_costos() then raise exception 'No autoritzat'; end if;
  if p_preu is null or p_preu < 0 then raise exception 'El preu no pot ser negatiu'; end if;

  select estat into actual from public.excursions where id = p_id;
  if actual is null then raise exception 'L''excursió no existeix'; end if;
  if actual not in ('Aprovada','Reservada') then
    raise exception 'Només es confirma el preu d''una excursió aprovada (ara és %)', actual;
  end if;

  update public.excursions
     set preu_alumne = p_preu, preu_confirmat_per = qui, preu_confirmat_el = now()
   where id = p_id;
end;
$$;

revoke all on function public.confirmar_preu(uuid, numeric) from public, anon, authenticated;
grant execute on function public.confirmar_preu(uuid, numeric) to authenticated;

commit;
