-- Ningú no pot esborrar la seva pròpia fila d'usuaris: el coordinador que ho
-- fes es quedaria fora de l'aplicació sense poder tornar a entrar.
-- Des del SQL Editor app_private.email() és null i no bloqueja res.
begin;
create or replace function app_private.no_eliminar_un_mateix() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if lower(old.email) = app_private.email() then
    raise exception 'No et pots eliminar a tu mateix.';
  end if;
  return old;
end;
$$;
revoke all on function app_private.no_eliminar_un_mateix() from public;
create or replace trigger no_eliminar_un_mateix before delete on public.usuaris
  for each row execute function app_private.no_eliminar_un_mateix();
commit;
