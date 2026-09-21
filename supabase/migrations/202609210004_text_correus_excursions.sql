begin;

-- Els avisos d'excursions eren massa curts per ser útils. Deien «Aprovada.» o
-- «Tens excursions pendents de revisar», sense dir mai **quina** excursió, on
-- anava ni quin dia. Qui rebia el correu havia d'obrir l'aplicació per saber
-- de què li parlaven, i el de cancel·lació —el més delicat de tots, perquè
-- pot haver-hi famílies que ja han pagat— no en deia res.
--
-- Ara tots porten els mateixos blocs: què ha passat, de quina sortida es
-- tracta, què ha de fer qui el rep, i on mirar-ho.

-- Postgres dona els noms dels dies i dels mesos en anglès si no es toca
-- `lc_time`, i tocar-lo afectaria tota la base de dades. Es construeix a mà,
-- que a més deixa la frase exactament com la volem.
create or replace function app_private.data_llarga(d date) returns text
language sql immutable set search_path = '' as $$
  select case when d is null then 'sense data' else
    (array['Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte','Diumenge'])[extract(isodow from d)]
    || ', ' || extract(day from d)::text || ' '
    -- En català la preposició s'apostrofa davant de vocal: «d'abril»,
    -- «d'agost», «d'octubre», però «de gener». Escriure «de octubre» en un
    -- correu del centre es llegeix com una falta, no com un detall.
    || case when extract(month from d) in (4, 8, 10) then 'd''' else 'de ' end
    || (array['gener','febrer','març','abril','maig','juny','juliol','agost',
              'setembre','octubre','novembre','desembre'])[extract(month from d)]
    || ' de ' || extract(year from d)::text
  end;
$$;

-- El bloc de dades que surt a tots els correus, sagnat perquè es distingeixi
-- del text seguit. Una sola funció per no haver de mantenir el mateix format
-- en tres llocs.
create or replace function app_private.fitxa_excursio(e public.excursions) returns text
language sql immutable set search_path = '' as $$
  select '  ' || e.codi || ' · ' || e.lloc
    || case when coalesce(e.etapa,'') = '' then '' else ' (' || e.etapa || ')' end
    || E'\n  ' || app_private.data_llarga(e.data);
$$;

create or replace function app_private.peu_correu() returns text
language sql immutable set search_path = '' as $$
  select E'\n\n—\nSJO Hub · Col·legi Sant Josep Obrer\nCorreu automàtic. No cal respondre-hi.';
$$;

create or replace function app_private.enllac_excursions() returns text
language sql immutable set search_path = '' as $$
  select 'https://benifox-creator.github.io/coord-stjosepDB/#/excursions';
$$;

create or replace function app_private.validate_excursio() returns trigger
language plpgsql security definer set search_path = '' as $$
declare qui text := app_private.email(); destinatari text; total integer;
begin
  if tg_op = 'INSERT' then
    new.creat_per := qui;
    if new.estat <> 'Esborrany' then raise exception 'Una excursió neix com a esborrany'; end if;
    if coalesce(trim(new.responsable),'') = '' then new.responsable := qui; end if;
    return new;
  end if;

  -- Les hores es validen sempre que hi siguin, estigui en l'estat que estigui.
  if new.hora_sortida <> '' then perform app_private.minutes(new.hora_sortida); end if;
  if new.hora_tornada <> '' then perform app_private.minutes(new.hora_tornada); end if;

  -- La data es valida per si mateixa, no només en proposar. Es deixa passar una
  -- excursió cancel·lada encara que la data fos dolenta: cancel·lar sempre ha
  -- de ser possible.
  if new.estat not in ('Esborrany','Cancel·lada') and not app_private.data_lectiva(new.data) then
    raise exception 'El dia % no és lectiu', to_char(new.data,'DD/MM/YYYY');
  end if;

  if new.estat = old.estat then return new; end if;

  if new.estat = 'Cancel·lada' then
    if not app_private.excursions_gestio() then raise exception 'No autoritzat'; end if;
    new.cancellada_per := qui; new.cancellada_el := now();

  elsif old.estat = 'Esborrany' and new.estat = 'Proposada' then
    if not (app_private.creator() and (old.creat_per = qui or app_private.excursions_gestio())) then
      raise exception 'No autoritzat';
    end if;
    if coalesce(trim(new.lloc),'') = '' or coalesce(trim(new.activitat),'') = ''
      or new.data is null or new.hora_sortida = '' or new.hora_tornada = ''
      or (new.transport = 'altres' and coalesce(trim(new.transport_detall),'') = '') then
      raise exception 'Falten dades per enviar la proposta';
    end if;
    select coalesce(sum(alumnes_previstos),0) into total from public.excursio_grups where excursio_id = new.id;
    if total = 0 then raise exception 'Falten dades: cal almenys un grup amb alumnes'; end if;
    new.proposada_per := qui; new.proposada_el := now();
    -- Un resum al dia i no un correu per proposta: al setembre es fa el pla
    -- sencer en una setmana, i cinquanta avisos s'aprenen a ignorar. **Sense
    -- dir quantes n'hi ha**: l'avís s'encua un sol cop al dia i el número
    -- envelliria malament a mesura que n'entressin més.
    for destinatari in select email from public.usuaris where rol in ('coordinador','direccio','titular') loop
      perform app_private.enqueue(destinatari, 'Excursions pendents d''aprovar',
        'Bon dia,' || E'\n\n' ||
        'Hi ha propostes d''excursió pendents d''aprovar al pla del curs.' || E'\n\n' ||
        'Les pots revisar aquí:' || E'\n' || app_private.enllac_excursions() ||
        app_private.peu_correu(),
        'excursions-pendents:' || destinatari || ':' || current_date::text);
    end loop;

  elsif old.estat = 'Proposada' and new.estat in ('Aprovada','Esborrany') then
    if not app_private.approver() then raise exception 'No autoritzat'; end if;
    if new.estat = 'Aprovada' then
      new.aprovada_per := qui; new.aprovada_el := now(); new.motiu_rebuig := null;
    elsif coalesce(trim(new.motiu_rebuig),'') = '' then
      raise exception 'Cal dir per què es rebutja';
    end if;
    perform app_private.enqueue(old.proposada_per,
      case when new.estat = 'Aprovada'
        then new.codi || ' aprovada · ' || new.lloc
        else new.codi || ' torna a esborrany · ' || new.lloc end,
      'Bon dia,' || E'\n\n' ||
      case when new.estat = 'Aprovada'
        then 'La teva proposta d''excursió ha estat aprovada.'
        else 'La teva proposta torna a esborrany perquè cal revisar-la.' end
      || E'\n\n' || app_private.fitxa_excursio(new.*) || E'\n\n' ||
      case when new.estat = 'Aprovada'
        then 'Ja es pot reservar. Tens el detall al pla del curs:'
        else 'Motiu: ' || new.motiu_rebuig || E'\n\n' ||
             'La pots corregir i tornar a enviar des del pla del curs:' end
      || E'\n' || app_private.enllac_excursions() || app_private.peu_correu(),
      'excursio-resolta:' || old.id::text || ':' || new.estat);

  elsif old.estat = 'Aprovada' and new.estat = 'Reservada' then
    if not app_private.excursions_gestio() then raise exception 'No autoritzat'; end if;
    new.reservada_per := qui; new.reservada_el := now();

  else
    raise exception 'Transició no vàlida: % → %', old.estat, new.estat;
  end if;

  return new;
end;
$$;

create or replace function app_private.notify_excursio_cancellada() returns trigger
language plpgsql security definer set search_path = '' as $$
declare destinatari text; avis_diners text := '';
begin
  -- El cas més delicat del mòdul: si el preu ja estava confirmat, hi ha
  -- circulars a casa i famílies que potser han pagat. La devolució encara no
  -- la fa l'aplicació, i el correu ho ha de dir en comptes de fer veure que
  -- està resolt.
  if new.preu_alumne is not null then
    -- `to_char` fa servir el separador decimal de la configuració regional del
    -- servidor, que és un punt. En català és una coma, i «12.50 €» en un correu
    -- del centre es llegeix com una xifra escrita per una màquina estrangera.
    avis_diners := E'\n\n' || 'El preu ja estava confirmat ('
      || translate(trim(to_char(new.preu_alumne,'FM999990.00')), '.', ',')
      || ' € per alumne). Els pagaments que hagin fet '
      || 'les famílies s''han de gestionar a part: l''aplicació encara no ho fa.';
  end if;

  for destinatari in
    select coalesce(new.proposada_per, new.creat_per)
    union
    select email from public.excursio_acompanyants where excursio_id = new.id
  loop
    if destinatari is not null then
      perform app_private.enqueue(destinatari,
        new.codi || ' cancel·lada · ' || new.lloc,
        'Bon dia,' || E'\n\n' ||
        'Aquesta excursió s''ha cancel·lat.' || E'\n\n' ||
        app_private.fitxa_excursio(new.*) || E'\n\n' ||
        'Motiu: ' || coalesce(nullif(trim(new.motiu_cancellacio),''), 'no se n''ha indicat cap.') ||
        avis_diners || E'\n\n' || app_private.enllac_excursions() || app_private.peu_correu(),
        'excursio-cancellada:' || new.id::text || ':' || destinatari);
    end if;
  end loop;
  return null;
end;
$$;

commit;
