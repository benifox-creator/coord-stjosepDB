-- Piloto: tablas normalizadas para los módulos Usuaris y Substitucions.
-- Sustituye a las hojas "Usuaris" y "Substitucions" de Google Sheets.
-- IDs generados por la BD (uuid) en vez del generador secuencial en cliente
-- (INV-001 style), que era propenso a colisiones con escrituras concurrentes.

create extension if not exists "pgcrypto";

-- ---------- usuaris ----------

create table public.usuaris (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  nom        text not null default '',
  rol        text not null default 'convidat'
             check (rol in ('coordinador', 'direccio', 'cap_estudis', 'professorat', 'convidat')),
  data_alta  timestamptz not null default now()
);

-- ---------- substitucions ----------

create sequence public.substitucions_codi_seq;

create table public.substitucions (
  id                    uuid primary key default gen_random_uuid(),
  -- codi legible (SUB-001...) que se sigue mostrando en la UI; la clave real es "id"
  codi                  text not null unique
                        default ('SUB-' || lpad(nextval('public.substitucions_codi_seq')::text, 3, '0')),
  data                  date not null,
  etapa                 text not null
                        check (etapa in ('EI', 'EP', 'ESO 1r-2n', 'ESO 3r-4t', 'BATX', 'GM')),
  franja                text not null default '',
  tipus                 text not null check (tipus in ('Classe', 'Pati')),
  professor_absent      text not null default '',
  professor_substitut   text not null default '',
  grup                  text not null default '',
  materia               text not null default '',
  estat                 text not null default 'Pendent'
                        check (estat in ('Pendent', 'Realitzada', 'Cancel·lada')),
  notes                 text not null default '',
  -- text (no timestamptz): solo se usa como etiqueta de visualización en la UI
  -- ("Creat per X · <creat_el>"), igual que en Sheets -- no hace falta un tipo
  -- timestamp real para eso.
  creat_el              text not null default to_char(now(), 'YYYY-MM-DD HH24:MI'),
  creat_per             text not null default ''
);

-- ---------- RLS ----------
-- Política permisiva para el piloto: cualquiera con la anon key tiene acceso
-- completo (equivalente en permisos a la Sheets API de hoy, pero OJO: la anon
-- key es pública en el bundle del cliente, así que esto NO exige haber pasado
-- por el login de Firebase para leer/escribir -- es más abierto que el modelo
-- actual, que sí exige un token de Google válido del dominio @stjosep.org.
-- Endurecer con Supabase Third-Party Auth (verificación del JWT de Firebase)
-- antes de un uso más allá de pruebas internas.

alter table public.usuaris enable row level security;
alter table public.substitucions enable row level security;

create policy "anon_full_access" on public.usuaris
  for all using (true) with check (true);

create policy "anon_full_access" on public.substitucions
  for all using (true) with check (true);
