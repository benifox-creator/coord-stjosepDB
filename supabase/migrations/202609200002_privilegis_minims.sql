begin;

-- Supabase té configurat que, per defecte, tota taula nova de l'esquema public
-- concedeixi **tots** els privilegis a `anon` i `authenticated`
-- (arwdDxtm: insert, select, update, delete, truncate, references, trigger,
-- maintain). Per això les taules tenen més permisos dels que cap migració ha
-- concedit mai, i cada mòdul nou hereta el mateix.
--
-- Dos d'aquests fan mal:
--   * TRUNCATE buida una taula sencera, **se salta l'RLS** (les polítiques no
--     s'hi apliquen) i **no dispara els triggers de fila**, així que no deixa
--     cap rastre a l'auditoria.
--   * REFERENCES permet crear claus foranes contra les nostres taules.
--
-- No són explotables des de l'API REST, que només exposa consultar, inserir,
-- actualitzar, esborrar i cridar funcions. Però són privilegis que ningú
-- necessita i que anul·len defenses; es retiren.
--
-- No es toquen select/insert/update/delete: el permís per columna de
-- `prestecs` (només `notes`) s'ha de conservar tal com està.

do $$ declare t text; extres text; begin
  -- MAINTAIN només existeix a PostgreSQL 17 i endavant; a les versions
  -- anteriors (i a PGlite, on corren les proves) revocar-lo fallaria.
  extres := case when current_setting('server_version_num')::int >= 170000
    then 'truncate, references, trigger, maintain' else 'truncate, references, trigger' end;
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke %s on public.%I from authenticated, anon', extres, t);
  end loop;
end $$;

-- I que les taules futures no neixin amb tot concedit. `anon` no ha de tenir
-- res per defecte: si alguna taula nova s'oblidés d'activar l'RLS, avui seria
-- llegible per qualsevol. Les migracions ja concedeixen explícitament el que
-- cal a `authenticated`.
alter default privileges in schema public revoke all on tables from anon;
do $$ begin
  if current_setting('server_version_num')::int >= 170000 then
    alter default privileges in schema public revoke truncate, references, trigger, maintain on tables from authenticated;
  else
    alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;
  end if;
end $$;

commit;
