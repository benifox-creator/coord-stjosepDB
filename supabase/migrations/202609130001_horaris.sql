begin;
create table if not exists public.horaris (
  id uuid primary key default gen_random_uuid(),
  professor text not null default '',
  dia_setmana text not null check (dia_setmana in ('Dilluns','Dimarts','Dimecres','Dijous','Divendres')),
  etapa text not null check (etapa in ('EI','EP','ESO 1r-2n','ESO 3r-4t','BATX','GM')),
  franja text not null default '',
  tipus text not null default 'Lectiva' check (tipus in ('Lectiva','No lectiva')),
  grup text not null default '',
  materia text not null default '',
  creat_el text not null default to_char(now(), 'YYYY-MM-DD HH24:MI'),
  creat_per text not null default ''
);



create table if not exists public.absencia_periodes (
  id uuid primary key default gen_random_uuid(),
  absencia_id uuid not null references public.absencies(id) on delete cascade,
  franja text not null default '',
  etapa text not null default '',
  tipus text not null default 'Lectiva' check (tipus in ('Lectiva','No lectiva')),
  grup text not null default '',
  materia text not null default ''
);

alter table public.horaris enable row level security;
alter table public.absencia_periodes enable row level security;

commit;
