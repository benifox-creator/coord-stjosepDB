begin;

-- Cancel·lar havia quedat sense volta enrere, i això era una trampa.
--
-- `enqueue` insereix amb `on conflict (event_key) do nothing`, així que la
-- fila cancel·lada continua ocupant la clau de l'esdeveniment. Cancel·lar per
-- error l'avís d'un dia volia dir que aquell avís ja no es podia tornar a
-- encuar: el segon `enqueue` no feia res i ningú se n'assabentava.
--
-- La sortida no és una funció nova sinó eixamplar la que ja hi ha. Reintentar
-- i desfer una cancel·lació acaben al mateix lloc —la notificació torna a la
-- cua des de zero— i qui ho pot fer és el mateix: qui la va generar, o la
-- coordinació. Un correu ja enviat continua fora d'abast, com abans.
create or replace function public.retry_notification(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.notifications set status='pending',attempts=0,next_attempt_at=now(),last_error=null
    where id=p_id and status in ('failed','cancel·lada')
      and (created_by=app_private.email() or app_private.admin());
  if not found then raise exception 'La notificació no es pot reintentar'; end if;
end;
$$;

commit;
