-- 0011_function_hardening.sql
-- Hardening de funciones según get_advisors(security):
-- 1. Set search_path en funciones que no lo tenían (search_path hijacking).
-- 2. Revoke EXECUTE de roles anon, authenticated, public en funciones
--    SECURITY DEFINER internas. Solo se invocan desde RLS y triggers,
--    nunca como RPC.

-- ============== search_path hardening ==============

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.validate_visit_agent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  expected_agent uuid;
begin
  select owner_id into expected_agent
  from public.properties where id = new.property_id;

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

-- ============== Revoke EXECUTE de funciones internas ==============
-- Estas funciones son invocadas por RLS policies y triggers. NO deben
-- exponerse vía PostgREST.

revoke execute on function public.current_user_role() from anon, authenticated, public;
revoke execute on function public.is_admin() from anon, authenticated, public;
revoke execute on function public.is_agent_or_above() from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.handle_new_message() from anon, authenticated, public;
revoke execute on function public.validate_visit_agent() from anon, authenticated, public;
revoke execute on function public.set_updated_at() from anon, authenticated, public;
