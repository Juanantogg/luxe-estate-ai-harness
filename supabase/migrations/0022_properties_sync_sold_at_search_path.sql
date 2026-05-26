-- 0022_properties_sync_sold_at_search_path.sql
-- Hardening defensivo: el trigger `properties_sync_sold_at` creado en mig
-- 0021 no fijaba `search_path`. El linter de Supabase (WARN
-- `function_search_path_mutable`) recomienda fijarlo siempre para evitar
-- ataques de search_path en funciones que se ejecutan con permisos
-- elevados. Aunque esta función no es SECURITY DEFINER, mantenemos la
-- convención del proyecto (idéntica a `notify_profile_role_or_status_change`,
-- `notify_agent_on_visit_insert`, etc.).

create or replace function public.properties_sync_sold_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.listing_status is distinct from 'sold' and new.listing_status = 'sold' then
    new.sold_at := now();
  elsif old.listing_status = 'sold' and new.listing_status is distinct from 'sold' then
    new.sold_at := null;
  end if;
  return new;
end;
$$;
