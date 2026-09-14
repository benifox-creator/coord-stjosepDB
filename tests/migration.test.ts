import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'
import { expect, it } from 'vitest'

it('upgrades the legacy main schema without deleting existing records', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
      create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;`)
    await db.exec((await readFile('tests/fixtures/legacy-schema.sql', 'utf8')).replace('create extension if not exists "pgcrypto";', ''))
    await db.exec("insert into public.usuaris(email,nom,rol) values('admin@stjosep.org','Admin','coordinador'); insert into public.material(nom) values('Existing stock');")
    for (const file of (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) {
      await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'))
    }
    expect((await db.query('select * from public.usuaris')).rows).toHaveLength(1)
    expect((await db.query("select * from public.material where nom='Existing stock'")).rows).toHaveLength(1)
    expect((await db.query("select * from pg_policies where policyname='anon_full_access'")).rows).toHaveLength(0)
    expect((await db.query('select * from public.horaris')).rows).toHaveLength(0)
  } finally { await db.close() }
}, 30000)
