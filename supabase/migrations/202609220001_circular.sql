begin;

-- Les tres dates viuen a `excursions` i no a les taules de costos: surten a
-- la circular, o sigui que són públiques. El que és privat és com s'ha
-- arribat al preu, no quan s'ha de pagar.
alter table public.excursions add column if not exists data_circular date;
alter table public.excursions add column if not exists data_limit_pagament date;
alter table public.excursions add column if not exists data_limit_resguard date;
alter table public.excursions add column if not exists circular_enviada_per text;
alter table public.excursions add column if not exists circular_enviada_el timestamptz;

-- Un sí o no públic, sense import. La circular ha de poder dir que l'AMPA hi
-- col·labora, i qui la genera pot ser un docent amb la casella de logística,
-- que **no pot llegir `excursio_finances`**. Amb aquest camp la frase surt
-- sense haver d'obrir-li els costos: diu que col·labora, no amb quant.
alter table public.excursions add column if not exists ampa_collabora boolean not null default false;

-- El disparador de `202609210004` acaba a `Aprovada → Reservada`; qualsevol
-- altra transició cau a «Transició no vàlida», `enviar_circular` inclosa
-- (és `security definer`, però qui fa l'`update` és el disparador, no la
-- funció). Cal afegir-hi les dues branques noves. Es reemplaça sencera i no
-- es toca `202609210004`: les migracions no es toquen un cop aplicades. La
-- resta del cos és còpia literal de la migració anterior.
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

  -- Noves: enviar la circular. Es pot enviar tant abans com després de
  -- reservar el transport, per això les dues branques. `enviar_circular` ja
  -- comprova el preu i qui pot fer-ho; aquí només cal deixar passar la
  -- transició en si.
  elsif old.estat in ('Aprovada','Reservada') and new.estat = 'Circular enviada' then
    if not app_private.excursions_gestio() then raise exception 'No autoritzat'; end if;

  else
    raise exception 'Transició no vàlida: % → %', old.estat, new.estat;
  end if;

  return new;
end;
$$;

-- `confirmar_preu` és qui té els números a la mà, així que és qui manté el
-- camp. Es reemplaça sencera perquè les migracions no es toquen un cop
-- aplicades; la resta del cos és la de la migració anterior.
create or replace function public.confirmar_preu(
  p_id uuid, p_preu numeric, p_previsio numeric, p_marge_pct numeric, p_iva_pct numeric
) returns void
language plpgsql security definer set search_path = '' as $$
declare qui text := app_private.email(); actual text;
begin
  if not app_private.excursions_costos() then raise exception 'No autoritzat'; end if;
  if p_preu is null or p_preu < 0 then raise exception 'El preu no pot ser negatiu'; end if;

  select estat into actual from public.excursions where id = p_id;
  if actual is null then raise exception 'L''excursió no existeix'; end if;
  -- `Circular enviada` **no** hi és, i no s'hi ha d'afegir mai: és el moment a
  -- partir del qual les famílies tenen a casa un paper amb un import.
  if actual not in ('Aprovada','Reservada') then
    raise exception 'Només es confirma el preu d''una excursió aprovada (ara és %)', actual;
  end if;

  update public.excursions
     set preu_alumne = p_preu, preu_confirmat_per = qui, preu_confirmat_el = now(),
         ampa_collabora = coalesce(
           (select ampa_import > 0 or ampa_cobreix_activitat
              from public.excursio_finances where excursio_id = p_id), false)
   where id = p_id;

  update public.excursio_finances
     set previsio_usada = p_previsio, marge_pct_usat = p_marge_pct, iva_pct_usat = p_iva_pct
   where excursio_id = p_id;
end;
$$;

-- Enviar la circular és el pas que converteix un preu calculat en un import
-- que les famílies tenen a casa. Per això és una funció del servidor i no una
-- escriptura qualsevol, i per això exigeix que el preu ja estigui congelat.
--
-- **`Circular enviada` no s'afegeix a la llista de `confirmar_preu`.** Aquell
-- estat és precisament el moment a partir del qual el preu no es pot moure.
create or replace function public.enviar_circular(
  p_id uuid, p_circular date, p_pagament date, p_resguard date
) returns void
language plpgsql security definer set search_path = '' as $$
declare qui text := app_private.email(); e public.excursions; destinatari text;
begin
  if not app_private.excursions_gestio() then raise exception 'No autoritzat'; end if;

  select * into e from public.excursions where id = p_id;
  if e.id is null then raise exception 'L''excursió no existeix'; end if;
  if e.estat not in ('Aprovada','Reservada') then
    raise exception 'Només s''envia la circular d''una excursió aprovada (ara és %)', e.estat;
  end if;
  if e.preu_alumne is null then
    raise exception 'Cal confirmar el preu abans d''enviar la circular';
  end if;

  update public.excursions
     set estat = 'Circular enviada',
         data_circular = p_circular,
         data_limit_pagament = p_pagament,
         data_limit_resguard = p_resguard,
         circular_enviada_per = qui, circular_enviada_el = now()
   where id = p_id;

  for destinatari in
    select coalesce(e.proposada_per, e.creat_per)
    union
    select email from public.excursio_acompanyants where excursio_id = p_id
  loop
    if destinatari is not null then
      perform app_private.enqueue(destinatari,
        e.codi || ' · circular enviada · ' || e.lloc,
        'Bon dia,' || E'\n\n' ||
        'Ja ha sortit la circular d''aquesta excursió.' || E'\n\n' ||
        app_private.fitxa_excursio(e) || E'\n\n' ||
        'Data límit de pagament: ' || app_private.data_llarga(p_pagament) || E'\n' ||
        'Resguard al tutor: ' || app_private.data_llarga(p_resguard) ||
        E'\n\n' || app_private.enllac_excursions() || app_private.peu_correu(),
        'circular-enviada:' || p_id::text || ':' || destinatari);
    end if;
  end loop;
end;
$$;

revoke all on function public.enviar_circular(uuid, date, date, date) from public, anon, authenticated;
grant execute on function public.enviar_circular(uuid, date, date, date) to authenticated;

commit;
