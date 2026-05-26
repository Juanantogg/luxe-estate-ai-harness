-- 0018_visits_notify_user_on_cancel.sql
-- Notifica al user cuando su visita es cancelada por alguien que no es
-- él mismo (agent o admin). Análogo a notify_agent_on_visit_insert
-- (mig 0017). Necesaria para que cancelVisit() pueda informar al user
-- afectado sin exponer service_role.

create or replace function public.notify_user_on_visit_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prop_title text;
  prop_tz text;
  formatted_local text;
begin
  -- Solo dispara cuando status pasa a 'cancelled' y NO fue el propio
  -- user quien canceló (lo cancela el agent o admin).
  if new.status <> 'cancelled' or old.status = 'cancelled' then
    return new;
  end if;
  if auth.uid() = new.user_id then
    -- El user canceló su propia visita; no notificamos.
    return new;
  end if;

  select p.title, p.timezone into prop_title, prop_tz
  from public.properties p
  where p.id = new.property_id;

  formatted_local := to_char(
    new.scheduled_at at time zone coalesce(prop_tz, 'America/Mexico_City'),
    'DD/MM/YYYY HH24:MI'
  );

  insert into public.notifications (
    recipient_id, type, title, body,
    property_id, visit_id, read_at, created_at
  ) values (
    new.user_id,
    'system',
    'Tu visita fue cancelada',
    coalesce(
      'Tu visita a "' || prop_title || '" del '
      || formatted_local || ' fue cancelada por el agente.',
      'Tu visita fue cancelada por el agente.'
    ),
    new.property_id,
    new.id,
    null,
    now()
  );
  return new;
end;
$$;

drop trigger if exists visits_notify_user_on_cancel on public.visits;
create trigger visits_notify_user_on_cancel
  after update on public.visits
  for each row execute function public.notify_user_on_visit_cancel();
