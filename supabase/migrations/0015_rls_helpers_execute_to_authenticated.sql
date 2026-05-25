-- 0015_rls_helpers_execute_to_authenticated.sql
-- Fix de bug introducido por 0011_function_hardening: las funciones
-- is_admin(), is_agent_or_above() y current_user_role() son invocadas
-- desde policies RLS evaluadas con el rol de la sesión (authenticated).
-- Sin EXECUTE para ese rol, Postgres falla con:
--   ERROR 42501: permission denied for function is_admin
-- y la query explota antes de devolver fila alguna.
--
-- Reproducción: usuario logged-in entra a /favorites o / → la policy
-- favorites_select_own_or_admin (o properties_select_public_or_own)
-- evalúa is_admin() y revienta.
--
-- Lo que NO queremos (intención original de 0011): que estas funciones
-- queden expuestas vía PostgREST RPC al rol anon. Por eso solo se otorga
-- EXECUTE a authenticated; anon queda sin acceso (las policies de anon
-- no usan estas helpers — ver mig 0013 y 0014).
--
-- Las otras funciones revocadas en 0011 (handle_new_user, handle_new_message,
-- validate_visit_agent, set_updated_at) son triggers SECURITY DEFINER que
-- Postgres invoca internamente sin chequear EXECUTE del caller, así que
-- siguen sin necesitar grant.

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_agent_or_above() to authenticated;
