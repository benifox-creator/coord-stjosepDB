-- La funció d'alta automàtica (`provisiona-usuaris`) pregunta amb el testimoni
-- de qui la crida si és coordinador, abans de tocar res a Firebase.
begin;
create or replace function public.es_coordinador() returns boolean
language sql stable set search_path = '' as $$ select app_private.admin(); $$;
revoke all on function public.es_coordinador() from public, anon;
grant execute on function public.es_coordinador() to authenticated;
commit;
