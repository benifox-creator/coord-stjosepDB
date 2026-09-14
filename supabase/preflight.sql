-- Read-only checks before applying migrations to an existing installation.
-- Any exception means: investigate on a copy before continuing.
begin transaction read only;
do $$
declare bad bigint;
begin
  select count(*) into bad from (select lower(email) from public.usuaris group by lower(email) having count(*)>1) duplicates;
  if bad>0 then raise exception 'Hi ha % emails duplicats sense distingir majúscules',bad; end if;
  if not exists(select 1 from public.usuaris where rol='coordinador' and lower(email) like '%@stjosep.org') then
    raise exception 'Cal provisionar explícitament un coordinador intern abans de tancar RLS';
  end if;
  select count(*) into bad from public.material where quantitat_total<0 or quantitat_disponible<0 or quantitat_disponible>quantitat_total;
  if bad>0 then raise exception 'Cal reconciliar l’estoc de % materials',bad; end if;
  select count(*) into bad from public.config where jsonb_typeof(valors)<>'array';
  if bad>0 then raise exception 'Hi ha % configuracions que no són llistes',bad; end if;
  select count(*) into bad from public.reserves where hora_inici !~ '^([0-9]|[01][0-9]|2[0-3]):[0-5][0-9]$' or hora_fi !~ '^([0-9]|[01][0-9]|2[0-3]):[0-5][0-9]$';
  if bad>0 then raise exception 'Hi ha % reserves amb hores no interpretables',bad; end if;
  if to_regclass('public.horaris') is not null then
    execute 'select count(*) from public.horaris' into bad;
    raise notice 'Hi ha % períodes d’horari: revisar el curs i la vigència abans de la migració 004',bad;
  end if;
end;
$$;
select dispositiu_id,count(*) as prestecs_actius from public.prestecs
  where estat<>'Retornat' and dispositiu_id<>'' group by dispositiu_id having count(*)>1;
-- These rows require reconciliation; they are never corrected automatically.
select codi, data, hora_inici, hora_fi from public.absencies
  where hora_inici='' or hora_fi='';
commit;
