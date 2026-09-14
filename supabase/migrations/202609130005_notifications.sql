begin;
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(), created_by text not null,
  recipient text not null, subject text not null, body text not null,
  status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
  attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
  sent_at timestamptz, last_error text, event_key text unique, claim_token uuid
);
alter table public.notifications enable row level security;
revoke all on public.notifications from public,anon,authenticated;
grant select on public.notifications to authenticated;
create policy own_notifications on public.notifications for select to authenticated using (app_private.admin() or created_by=app_private.email());

create or replace function app_private.enqueue(recipient text, subject text, body text, event_key text default null) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications(created_by,recipient,subject,body,event_key)
  values(coalesce(app_private.email(),'system'),recipient,subject,body,event_key) on conflict(event_key) do nothing;
$$;
create or replace function public.queue_email(p_to text,p_subject text,p_body text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.creator() then raise exception 'No autoritzat'; end if;
  if not exists(select 1 from public.usuaris where lower(email)=lower(p_to)) and not exists(select 1 from public.config where clau='manteniment.email' and valors ? p_to) then raise exception 'Destinatari no autoritzat'; end if;
  if length(p_subject)>200 or length(p_body)>20000 then raise exception 'Notificació massa llarga'; end if;
  perform app_private.enqueue(lower(p_to),p_subject,p_body);
end;
$$;
create or replace function app_private.notify_absence() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target record;
begin
  if tg_op='INSERT' then
    for target in select email from public.usuaris where rol in ('coordinador','direccio','titular') loop
      perform app_private.enqueue(target.email,'Nova absència pendent de revisar',new.professor||' ha reportat una absència el '||new.data::text||'. Accedeix a SJO Hub per revisar-la.', 'absence-created:'||new.id||':'||target.email);
    end loop;
  elsif new.estat<>old.estat then
    perform app_private.enqueue(new.professor,'Revisió de la teva absència','La teva absència del '||new.data::text||' consta com a '||new.estat||'. '||new.motiu_rebuig,'absence-reviewed:'||new.id||':'||new.estat);
  end if;
  return new;
end;
$$;
create trigger notify_absence after insert or update on public.absencies for each row execute function app_private.notify_absence();
create or replace function app_private.notify_substitution() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' or new.professor_substitut<>old.professor_substitut or new.estat<>old.estat then
    if new.professor_substitut<>'' then
      perform app_private.enqueue(new.professor_substitut,'Actualització de substitució',new.data::text||' · '||new.franja||' · '||new.grup||' · '||new.materia||E'\nEstat: '||new.estat||E'\n'||new.notes);
    end if;
    if tg_op='UPDATE' and old.professor_substitut<>'' and old.professor_substitut<>new.professor_substitut then
      perform app_private.enqueue(old.professor_substitut,'Substitució reassignada','Ja no tens assignada la substitució del '||old.data::text||' · '||old.franja||'.');
    end if;
  end if;
  return new;
end;
$$;
create trigger notify_substitution after insert or update on public.substitucions for each row execute function app_private.notify_substitution();

create or replace function public.retry_notification(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.notifications set status='pending',attempts=0,next_attempt_at=now(),last_error=null
    where id=p_id and status='failed' and (created_by=app_private.email() or app_private.admin());
  if not found then raise exception 'La notificació no es pot reintentar'; end if;
end;
$$;
create or replace function public.claim_notifications() returns setof public.notifications
language plpgsql security definer set search_path = '' as $$
begin
  update public.notifications set status='failed',last_error='Enviament interromput. Revisa el correu abans de reintentar.'
    where status='sending' and next_attempt_at<=now() and attempts>=5;
  return query update public.notifications n set status='sending',attempts=attempts+1,claim_token=gen_random_uuid(),next_attempt_at=now()+interval '5 minutes'
  where id in (select id from public.notifications where (status='pending' or status='sending') and next_attempt_at<=now() and attempts<5 order by created_at for update skip locked limit 10)
  returning n.*;
end;
$$;
create or replace function public.finish_notification(p_id uuid,p_claim uuid,p_error text default null) returns void
language sql security definer set search_path = '' as $$
  update public.notifications set
    status=case when p_error is null then 'sent' when attempts>=5 then 'failed' else 'pending' end,
    sent_at=case when p_error is null then now() else null end,
    last_error=left(p_error,500),next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer))
  where id=p_id and claim_token=p_claim and status='sending';
$$;
revoke all on function public.queue_email(text,text,text),public.retry_notification(uuid),public.claim_notifications(),public.finish_notification(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.queue_email(text,text,text),public.retry_notification(uuid) to authenticated;
grant execute on function public.claim_notifications(),public.finish_notification(uuid,uuid,text) to service_role;
revoke all on all functions in schema app_private from public;
-- enqueue and trigger functions are intentionally not exposed to authenticated callers.
revoke all on function app_private.enqueue(text,text,text,text) from authenticated;
commit;
