-- 0017_visits_slot_constraint_and_notification_trigger.sql
--
-- Cierra tres huecos para que la pantalla schedule_visit_screen funcione:
--
-- (a) Constraint único parcial sobre (agent_id, scheduled_at) cuando el
--     status es uno de los "ocupantes". Previene race conditions: si dos
--     users hacen submit del mismo slot al mismo tiempo, la DB rechaza el
--     segundo con error 23505 (unique_violation) y la Server Action lo
--     traduce a `slot_taken`.
--
-- (b) Trigger AFTER INSERT que crea una notification para el agente. Como
--     `notifications` tiene INSERT bloqueado a clientes por RLS (sin
--     policy), insertamos desde DB en lugar de exponer service_role en
--     una Server Action. La función es SECURITY DEFINER + search_path
--     fijo, mismo patrón que `validate_visit_agent` (mig 0007). El body
--     se formatea en la zona local de la propiedad (depende de la
--     columna `timezone` agregada en 0016).
--
-- (c) RPC `get_agent_occupied_slots` SECURITY DEFINER que permite a un
--     usuario autenticado leer SOLO los timestamps de los slots tomados
--     por un agente, sin filtrar quién agendó qué. Se necesita porque
--     RLS de `visits` solo deja ver filas donde el caller es participante;
--     el user que está agendando no es participante todavía.

-- (a) Unique partial index
create unique index if not exists visits_agent_slot_unique_active_idx
  on public.visits (agent_id, scheduled_at)
  where status in ('pending', 'confirmed', 'rescheduled');

-- (b) Trigger AFTER INSERT → notification al agente
create or replace function public.notify_agent_on_visit_insert()
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
  select p.title, p.timezone into prop_title, prop_tz
  from public.properties p
  where p.id = new.property_id;

  -- Formateo en zona local de la propiedad.
  -- to_char con AT TIME ZONE devuelve la representación local.
  formatted_local := to_char(
    new.scheduled_at at time zone coalesce(prop_tz, 'America/Mexico_City'),
    'DD/MM/YYYY HH24:MI'
  );

  insert into public.notifications (
    recipient_id, type, title, body,
    property_id, visit_id, read_at, created_at
  ) values (
    new.agent_id,
    'visit_confirmed',
    'Nueva visita agendada',
    coalesce(
      'Un usuario agendó una visita a "' || prop_title || '" el '
      || formatted_local || ' (hora local de la propiedad).',
      'Un usuario agendó una visita.'
    ),
    new.property_id,
    new.id,
    null,
    now()
  );
  return new;
end;
$$;

drop trigger if exists visits_notify_agent_on_insert on public.visits;
create trigger visits_notify_agent_on_insert
  after insert on public.visits
  for each row execute function public.notify_agent_on_visit_insert();

-- El trigger es SECURITY DEFINER, así que internamente puede INSERTAR en
-- notifications saltando RLS (ése es el propósito). No otorgamos EXECUTE
-- a authenticated/anon: solo el motor de triggers lo invoca. Esto
-- preserva la intención original de mig 0011 para esta función.

-- (c) RPC para leer slots ocupados sin filtrar identidad
create or replace function public.get_agent_occupied_slots(
  agent uuid,
  from_ts timestamptz,
  to_ts timestamptz
)
returns table (scheduled_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select v.scheduled_at
  from public.visits v
  where v.agent_id = agent
    and v.status in ('pending', 'confirmed', 'rescheduled')
    and v.scheduled_at >= from_ts
    and v.scheduled_at <= to_ts;
$$;

grant execute on function public.get_agent_occupied_slots(uuid, timestamptz, timestamptz)
  to authenticated;
