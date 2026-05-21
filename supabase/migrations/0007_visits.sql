-- 0007_visits.sql
-- Cita de visita a propiedad. user_id la agenda, agent_id la confirma.

create table if not exists public.visits (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references public.properties(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  agent_id uuid not null references public.profiles(id) on delete restrict,
  scheduled_at timestamptz not null,
  duration_minutes smallint not null default 30 check (duration_minutes > 0),
  status public.visit_status not null default 'pending',
  message text,
  agent_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists visits_property_idx on public.visits(property_id);
create index if not exists visits_user_idx on public.visits(user_id, scheduled_at desc);
create index if not exists visits_agent_idx on public.visits(agent_id, scheduled_at desc);
create index if not exists visits_scheduled_idx on public.visits(scheduled_at);

drop trigger if exists visits_set_updated_at on public.visits;
create trigger visits_set_updated_at
  before update on public.visits
  for each row execute function public.set_updated_at();

-- Validación: agent_id debe coincidir con properties.owner_id.
create or replace function public.validate_visit_agent()
returns trigger
language plpgsql
as $$
declare
  expected_agent uuid;
begin
  select owner_id into expected_agent
  from public.properties
  where id = new.property_id;

  if expected_agent is null then
    raise exception 'Property % does not exist', new.property_id;
  end if;

  if new.agent_id <> expected_agent then
    raise exception 'agent_id (%) must match property owner (%)',
      new.agent_id, expected_agent;
  end if;

  return new;
end;
$$;

drop trigger if exists visits_validate_agent on public.visits;
create trigger visits_validate_agent
  before insert or update on public.visits
  for each row execute function public.validate_visit_agent();

alter table public.visits enable row level security;

drop policy if exists "visits_select_participant_or_admin" on public.visits;
create policy "visits_select_participant_or_admin"
  on public.visits for select to authenticated
  using (user_id = auth.uid() or agent_id = auth.uid() or public.is_admin());

drop policy if exists "visits_insert_self" on public.visits;
create policy "visits_insert_self"
  on public.visits for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "visits_update_participant_or_admin" on public.visits;
create policy "visits_update_participant_or_admin"
  on public.visits for update to authenticated
  using (user_id = auth.uid() or agent_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or agent_id = auth.uid() or public.is_admin());

-- DELETE no tiene política → bloqueado para clientes.
