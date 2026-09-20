begin;

-- Poder treure un correu de la cua sense esborrar-lo. El worker només recull
-- els que estan a 'pending' o 'sending', així que un estat nou n'hi ha prou.
-- Es marca en comptes d'esborrar per la mateixa raó que la resta del sistema:
-- el registre del que va passar val més que la taula neta.
alter table public.notifications drop constraint if exists notifications_status_check;
alter table public.notifications add constraint notifications_status_check
  check (status in ('pending','sending','sent','failed','cancel·lada'));

create or replace function public.cancel_notification(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.notifications
     set status = 'cancel·lada', last_error = 'Cancel·lada per ' || coalesce(app_private.email(),'?')
   where id = p_id
     and status in ('pending','failed')
     and (created_by = app_private.email() or app_private.admin());
  -- El mateix error tant si no existeix com si no és teva: així no es pot
  -- esbrinar quins identificadors existeixen provant.
  if not found then raise exception 'Aquesta notificació no es pot cancel·lar'; end if;
end;
$$;

revoke all on function public.cancel_notification(uuid) from public, anon, authenticated;
grant execute on function public.cancel_notification(uuid) to authenticated;

commit;
