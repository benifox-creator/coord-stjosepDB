-- Els correus els enviava només el cron de GitHub Actions (cada 10 minuts),
-- però GitHub l'executava unes 4 vegades al dia: els avisos trigaven hores.
-- Ara la base de dades mira cada minut si hi ha correus a la cua i, si n'hi
-- ha, crida la funció `send-notifications`. GitHub queda de reserva; si tots
-- dos coincideixen no es repeteix res, perquè `claim_notifications` reserva
-- cada correu amb `for update skip locked`.
--
-- La funció s'autentica amb una contrasenya pròpia, generada aquí i desada
-- xifrada a Vault (`correus_cron_secret`): no cal tocar els secrets de
-- Supabase ni de GitHub. La funció la comprova amb `valida_secret_cron`,
-- que només pot executar el service_role.
--
-- Les extensions i el Vault només existeixen a Supabase: a la base de proves
-- (PGlite) aquesta part se salta, però les funcions es creen igualment.
begin;

create or replace function public.valida_secret_cron(p_secret text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare esperat text;
begin
  select decrypted_secret into esperat from vault.decrypted_secrets where name = 'correus_cron_secret';
  return esperat is not null and p_secret is not null and p_secret = esperat;
end;
$$;
revoke all on function public.valida_secret_cron(text) from public, anon, authenticated;
grant execute on function public.valida_secret_cron(text) to service_role;

create or replace function app_private.dispara_correus() returns void
language plpgsql security definer set search_path = '' as $$
declare secret text;
begin
  -- Sense correus pendents no es crida res: cada minut, la majoria de vegades.
  if not exists (select 1 from public.notifications
                  where status in ('pending','sending') and next_attempt_at <= now() and attempts < 5) then
    return;
  end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'correus_cron_secret';
  if secret is null then raise exception 'Falta el secret correus_cron_secret a Vault'; end if;
  perform net.http_post(
    url := 'https://gbugvympcvlskkrbklae.supabase.co/functions/v1/send-notifications',
    headers := jsonb_build_object('x-scheduler-secret', secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;
revoke all on function app_private.dispara_correus() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_namespace where nspname = 'vault') then
    raise notice 'Sense pg_cron o Vault: els correus continuen depenent només de GitHub.';
    return;
  end if;
  create extension if not exists pg_net;
  create extension if not exists pg_cron;
  if not exists (select 1 from vault.secrets where name = 'correus_cron_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'correus_cron_secret',
      'Contrasenya amb què pg_cron crida la funció send-notifications');
  end if;
  perform cron.schedule('envia-correus', '* * * * *', 'select app_private.dispara_correus()');
end $$;

commit;
