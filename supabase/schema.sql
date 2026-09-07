-- Esquema completo: sustituye todas las hojas de Google Sheets por tablas
-- normalizadas en Postgres. IDs generados por la BD (uuid) en vez del
-- generador secuencial en cliente (INV-001 style), que era propenso a
-- colisiones con escrituras concurrentes.
--
-- Convención en todas las tablas: "id" (uuid) es la clave real usada por la
-- app para editar/eliminar; "codi" es el código legible (INV-001, MAT-001...)
-- que se sigue mostrando en la UI, generado automáticamente por secuencia.
-- Los campos de fecha se guardan como texto (no `date`/`timestamptz`) salvo
-- excepción justificada, porque el cliente ya trabaja con ellos como string
-- (new Date(...)) y no hay consultas de rango que se beneficien del tipo
-- nativo — mismo criterio que Sheets, sin la complejidad de manejar
-- null-vs-string-vacío en cada módulo.

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

-- ---------- absencies ----------

create sequence public.absencies_codi_seq;

create table public.absencies (
  id            uuid primary key default gen_random_uuid(),
  codi          text not null unique
                default ('ABS-' || lpad(nextval('public.absencies_codi_seq')::text, 3, '0')),
  professor     text not null default '',
  data          date not null,
  hora_inici    text not null default '',
  hora_fi       text not null default '',
  hores         numeric(4,2) not null default 0,
  motiu         text not null default '',
  notes         text not null default '',
  estat         text not null default 'Pendent revisió'
                check (estat in ('Pendent revisió', 'Aprovada', 'Rebutjada')),
  motiu_rebuig  text not null default '',
  creat_el      text not null default to_char(now(), 'YYYY-MM-DD HH24:MI'),
  creat_per     text not null default '',
  revisat_per   text not null default '',
  revisat_el    text not null default ''
);

-- ---------- inventari ----------
create sequence public.inventari_codi_seq;
create table public.inventari (
  id           uuid primary key default gen_random_uuid(),
  codi         text not null unique default ('INV-' || lpad(nextval('public.inventari_codi_seq')::text, 3, '0')),
  nom          text not null default '',
  categoria    text not null default 'Altre'
               check (categoria in ('Portàtil','Ordinador','Tauleta','Projector','Impressora','Switch/Router','Monitor','Servidor','Altre')),
  marca        text not null default '',
  model        text not null default '',
  num_serie    text not null default '',
  ubicacio     text not null default '',
  estat        text not null default 'Actiu'
               check (estat in ('Actiu','En reparació','De baixa','En préstec')),
  data_compra    text not null default '',
  garantia_fins  text not null default '',
  mac_lan      text not null default '',
  mac_wan      text not null default '',
  ip_lan       text not null default '',
  ip_wan       text not null default '',
  notes        text not null default ''
);

-- ---------- incidencies ----------
create sequence public.incidencies_codi_seq;
create table public.incidencies (
  id                    uuid primary key default gen_random_uuid(),
  codi                  text not null unique default ('INC-' || lpad(nextval('public.incidencies_codi_seq')::text, 3, '0')),
  marca_temps           text not null,
  estat                 text not null default 'Oberta' check (estat in ('Oberta','En curs','Tancada')),
  prioritat             text not null default 'Mitjana' check (prioritat in ('Alta','Mitjana','Baixa')),
  reporter              text not null default '',
  tipus_problema        text not null default 'Altre'
                        check (tipus_problema in ('Maquinari','Programari','Xarxa','Projector/Pantalla','Impressora','Altre')),
  localitzacio          text not null default '',
  dispositiu            text not null default '',
  descripcio_detallada  text not null default '',
  assignat_a            text not null default '',
  data_resolucio        text not null default '',
  dies_tasca_oberta     text not null default '',
  comentaris            text not null default '',
  notificat             text not null default 'false' check (notificat in ('false','pending','true'))
);

-- ---------- manteniment ----------
create sequence public.manteniment_codi_seq;
create table public.manteniment (
  id             uuid primary key default gen_random_uuid(),
  codi           text not null unique default ('MAN-' || lpad(nextval('public.manteniment_codi_seq')::text, 3, '0')),
  titol          text not null default '',
  categoria      text not null default 'Altres'
                 check (categoria in ('Persianes/Stores','Portes/Finestres','Mobiliari','Electricitat','Fontaneria','Pintura','Altres')),
  localitzacio   text not null default '',
  descripcio     text not null default '',
  prioritat      text not null default 'Normal' check (prioritat in ('Urgent','Normal','Baixa')),
  estat          text not null default 'Pendent' check (estat in ('Pendent','En gestió','Resolt','Cancel·lat')),
  reporter       text not null default '',
  data_report    text not null default '',
  data_resolucio text not null default '',
  notes          text not null default '',
  creat_el       text not null default to_char(now(), 'YYYY-MM-DD HH24:MI')
);

-- ---------- coneixement ----------
-- Tags i Links normalitzats a tipus natius (abans strings serialitzats a mà);
-- Publicat és boolean real, elimina el workaround de coerció de Sheets
-- (USER_ENTERED convertia "true" a booleà i tornava "TRUE" en llegir-ho).
create sequence public.coneixement_codi_seq;
create table public.coneixement (
  id               uuid primary key default gen_random_uuid(),
  codi             text not null unique default ('ART-' || lpad(nextval('public.coneixement_codi_seq')::text, 3, '0')),
  titol            text not null default '',
  categoria        text not null default '',
  contingut        text not null default '',
  tags             text[] not null default '{}',
  links            jsonb not null default '[]'::jsonb,
  autor            text not null default '',
  creat_el         text not null default '',
  actualitzat_el   text not null default '',
  publicat         boolean not null default false
);

-- ---------- projectes ----------
create sequence public.projectes_codi_seq;
create table public.projectes (
  id                 uuid primary key default gen_random_uuid(),
  codi               text not null unique default ('PRJ-' || lpad(nextval('public.projectes_codi_seq')::text, 3, '0')),
  nom                text not null default '',
  descripcio         text not null default '',
  categoria          text not null default '',
  estat              text not null default 'Actiu' check (estat in ('Actiu','Completat','Arxivat')),
  responsable        text not null default '',
  data_inici         text not null default '',
  data_fi_prevista   text not null default '',
  creat_el           text not null default ''
);

-- ---------- tasques ----------
create sequence public.tasques_codi_seq;
create table public.tasques (
  id             uuid primary key default gen_random_uuid(),
  codi           text not null unique default ('TAS-' || lpad(nextval('public.tasques_codi_seq')::text, 3, '0')),
  -- referència lògica al codi de projectes.codi (no FK), igual que la resta
  -- de referències creuades de l'app (ex. dispositiu_id a prestecs) — evita
  -- tocar els components de UI que ja fan servir aquest valor com a string
  projecte_codi  text not null default '',
  titol          text not null default '',
  descripcio     text not null default '',
  estat          text not null default 'Pendent' check (estat in ('Pendent','En curs','Completada','Bloquejada')),
  prioritat      text not null default 'Mitjana' check (prioritat in ('Alta','Mitjana','Baixa')),
  responsable    text not null default '',
  data_limit     text not null default '',
  creat_el       text not null default ''
);

-- ---------- material ----------
create sequence public.material_codi_seq;
create table public.material (
  id                     uuid primary key default gen_random_uuid(),
  codi                   text not null unique default ('MAT-' || lpad(nextval('public.material_codi_seq')::text, 3, '0')),
  nom                    text not null default '',
  categoria              text not null default 'Altre'
                        check (categoria in ('Cable','Adaptador','Àudio/Vídeo','Perifèric','Emmagatzematge','Bateria/Carregador','Projecció','Altre')),
  descripcio             text not null default '',
  quantitat_total        integer not null default 0,
  quantitat_disponible   integer not null default 0,
  ubicacio               text not null default '',
  notes                  text not null default ''
);

-- Ajust atòmic d'estoc: substitueix el patró lectura+escriptura sense lock
-- d'abans (dues crides independents sobre la mateixa fila = race condition
-- real amb escriptures concurrents).
create or replace function public.adjust_material_stock(p_material_id uuid, p_delta integer)
returns void
language sql
set search_path = public
as $$
  update public.material
  set quantitat_disponible = greatest(0, quantitat_disponible + p_delta)
  where id = p_material_id;
$$;

-- ---------- prestecs ----------
create sequence public.prestecs_codi_seq;
create table public.prestecs (
  id                    uuid primary key default gen_random_uuid(),
  codi                  text not null unique default ('PRE-' || lpad(nextval('public.prestecs_codi_seq')::text, 3, '0')),
  dispositiu_id         text not null default '',
  dispositiu_nom        text not null default '',
  usuari                text not null default '',
  email                 text not null default '',
  data_inici            text not null default '',
  data_fi_prevista      text not null default '',
  data_fi_real          text not null default '',
  estat                 text not null default 'Actiu' check (estat in ('Actiu','Retornat','Vençut')),
  notes                 text not null default ''
);

-- Línies de material d'un préstec: substitueix el string
-- "MAT-001:2:Nom;MAT-003:1:Nom" serialitzat en una sola cel·la. FK real a
-- material(id), a diferència de dispositiu_id/projecte_codi que són
-- referències lliures igual que a Sheets.
create table public.prestec_items (
  id           uuid primary key default gen_random_uuid(),
  prestec_id   uuid not null references public.prestecs(id) on delete cascade,
  material_id  uuid not null references public.material(id),
  quantitat    integer not null check (quantitat > 0)
);
create index prestec_items_prestec_id_idx on public.prestec_items(prestec_id);
create index prestec_items_material_id_idx on public.prestec_items(material_id);

-- ---------- reserves ----------
create sequence public.reserves_codi_seq;
create table public.reserves (
  id           uuid primary key default gen_random_uuid(),
  codi         text not null unique default ('RES-' || lpad(nextval('public.reserves_codi_seq')::text, 3, '0')),
  espai        text not null default '',
  usuari       text not null default '',
  email        text not null default '',
  data         text not null default '',
  hora_inici   text not null default '',
  hora_fi      text not null default '',
  motiu        text not null default '',
  estat        text not null default 'Pendent' check (estat in ('Pendent','Confirmada','Cancel·lada')),
  creat_el     text not null default ''
);

-- ---------- config (clau/valors, substitueix el full "Config") ----------
create table public.config (
  clau    text primary key,
  valors  jsonb not null default '[]'::jsonb
);

-- ---------- RLS ----------
-- Política permisiva para todas las tablas: cualquiera con la anon key tiene
-- acceso completo (equivalente en permisos a la Sheets API de hoy, pero OJO:
-- la anon key es pública en el bundle del cliente, así que esto NO exige
-- haber pasado por el login de Firebase para leer/escribir -- es más abierto
-- que el modelo actual, que sí exige un token de Google válido del dominio
-- @stjosep.org. Endurecer con Supabase Third-Party Auth (verificación del
-- JWT de Firebase) antes de un uso más allá de pruebas internas.

alter table public.usuaris enable row level security;
alter table public.substitucions enable row level security;
alter table public.inventari enable row level security;
alter table public.incidencies enable row level security;
alter table public.manteniment enable row level security;
alter table public.coneixement enable row level security;
alter table public.projectes enable row level security;
alter table public.tasques enable row level security;
alter table public.material enable row level security;
alter table public.prestecs enable row level security;
alter table public.prestec_items enable row level security;
alter table public.reserves enable row level security;
alter table public.config enable row level security;

create policy "anon_full_access" on public.usuaris for all using (true) with check (true);
create policy "anon_full_access" on public.substitucions for all using (true) with check (true);

alter table public.absencies enable row level security;
create policy "anon_full_access" on public.absencies for all using (true) with check (true);

alter table public.substitucions
  add column absencia_id uuid references public.absencies(id);

create policy "anon_full_access" on public.inventari for all using (true) with check (true);
create policy "anon_full_access" on public.incidencies for all using (true) with check (true);
create policy "anon_full_access" on public.manteniment for all using (true) with check (true);
create policy "anon_full_access" on public.coneixement for all using (true) with check (true);
create policy "anon_full_access" on public.projectes for all using (true) with check (true);
create policy "anon_full_access" on public.tasques for all using (true) with check (true);
create policy "anon_full_access" on public.material for all using (true) with check (true);
create policy "anon_full_access" on public.prestecs for all using (true) with check (true);
create policy "anon_full_access" on public.prestec_items for all using (true) with check (true);
create policy "anon_full_access" on public.reserves for all using (true) with check (true);
create policy "anon_full_access" on public.config for all using (true) with check (true);
