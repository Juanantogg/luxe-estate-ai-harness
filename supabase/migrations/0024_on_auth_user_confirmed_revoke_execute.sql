-- 0024_on_auth_user_confirmed_revoke_execute.sql
--
-- Fix correctivo del WARN `anon_security_definer_function_executable` que
-- introduce mig 0023 para `on_auth_user_confirmed`. La función solo es
-- invocada por el motor de triggers (AFTER UPDATE en auth.users) — no
-- tiene sentido exponerla vía /rest/v1/rpc/. Patrón idéntico a lo que
-- mig 0011 hizo con handle_new_user, notify_*, etc.

revoke execute on function public.on_auth_user_confirmed() from public;
revoke execute on function public.on_auth_user_confirmed() from anon;
revoke execute on function public.on_auth_user_confirmed() from authenticated;
