begin;

-- `excursio_finances` ja portava `previsio_usada`, `marge_pct_usat` i
-- `iva_pct_usat` des de la migració que va crear la taula, justament perquè
-- el preu confirmat es pogués reconstruir encara que la configuració es
-- retoqués més tard. Però `confirmar_preu` no els escrivia mai: si algú
-- reclamava un càrrec sis mesos després, amb el marge ja retocat, no hi havia
-- manera de saber amb quins números s'havia calculat el preu que té a casa.
--
-- Es reemplaça la funció (i no se n'afegeix una de nova) perquè no hi pot
-- haver dues maneres de confirmar un preu: una que congela els paràmetres i
-- una altra que no. Deixar viva la versió de 2 arguments seria deixar una
-- porta del darrere oberta.
drop function if exists public.confirmar_preu(uuid, numeric);

create or replace function public.confirmar_preu(
  p_id uuid, p_preu numeric, p_previsio numeric, p_marge_pct numeric, p_iva_pct numeric
) returns void
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

  -- Si encara no hi ha fila de costos (mai s'ha desat res), no hi ha res a
  -- marcar amb els paràmetres: `update` sense files no és cap error, i el
  -- client (`useFinances.confirma`) sempre desa els costos abans de cridar
  -- aquí, així que en l'ús normal la fila ja existeix.
  update public.excursio_finances
     set previsio_usada = p_previsio, marge_pct_usat = p_marge_pct, iva_pct_usat = p_iva_pct
   where excursio_id = p_id;
end;
$$;

revoke all on function public.confirmar_preu(uuid, numeric, numeric, numeric, numeric) from public, anon, authenticated;
grant execute on function public.confirmar_preu(uuid, numeric, numeric, numeric, numeric) to authenticated;

commit;
