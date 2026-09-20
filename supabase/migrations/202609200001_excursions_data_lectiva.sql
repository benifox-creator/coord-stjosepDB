begin;

-- La comprovació de dia lectiu estava lligada a la transició
-- Esborrany → Proposada, no a la dada. Per tant, un cop aprovada o reservada,
-- canviar la data no passava per cap validació i una excursió podia quedar
-- reservada en dissabte o en un dia no lectiu.
--
-- Ara es comprova sempre que l'excursió no sigui un esborrany. L'esborrany
-- continua admetent una data provisional mentre es decideix, que és el que el
-- fa útil; a partir d'aquí, la data ha de ser lectiva.
create or replace function app_private.data_lectiva(d date) returns boolean
language sql stable security definer set search_path = '' as $$
  select d is null or (
    extract(isodow from d) < 6
    and not exists(select 1 from public.config where clau = 'centre.dies-no-lectius' and valors ? d::text)
  );
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
    for destinatari in select email from public.usuaris where rol in ('coordinador','direccio','titular') loop
      perform app_private.enqueue(destinatari, 'Excursions pendents d''aprovar',
        'Tens excursions pendents de revisar al pla del curs.',
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
      'La teva excursió ' || old.codi || ': ' || new.estat,
      coalesce(new.motiu_rebuig, 'Aprovada.'),
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

commit;
