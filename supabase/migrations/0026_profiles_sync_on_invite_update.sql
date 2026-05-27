-- 0026_profiles_sync_on_invite_update.sql
--
-- Fix correctivo de un bug detectado en smoke test manual 2026-05-27:
-- `inviteUserByEmail` de Supabase setea `auth.users.invited_at` en un
-- UPDATE POSTERIOR al INSERT del row (~18ms después). El trigger
-- `handle_new_user` (mig 0002 / 0023 / 0025) corre AFTER INSERT y lee
-- `NEW.invited_at` que en ese momento es NULL, así que siempre marca
-- al user nuevo como `invitation_status='accepted'` aunque venga por invite.
--
-- Evidencia (row de kuzepoprazi-2837@yopmail.com):
--   auth.users.created_at:  01:17:34.9745  (INSERT)
--   profiles.created_at:    01:17:34.9734  (trigger handle_new_user)
--   auth.users.invited_at:  01:17:34.9928  (UPDATE posterior)
--
-- Fix: trigger AFTER UPDATE OF invited_at en auth.users que sincroniza
-- el profile cuando invited_at pasa de NULL a NOT NULL. Mismo patrón
-- que `on_auth_user_confirmed` de mig 0023 pero sobre el campo
-- `invited_at` en lugar de `email_confirmed_at`.
--
-- Condiciones para flipear el profile:
--   - OLD.invited_at IS NULL AND NEW.invited_at IS NOT NULL
--   - NEW.email_confirmed_at IS NULL (todavía no confirmó)
--   - profile.invitation_status NO es ya 'pending' (idempotencia)
--
-- Si el user fue invitado pero ya confirmó el email en la misma
-- transacción (caso teórico de invites auto-confirmados), NO lo
-- pasamos a pending — queda como accepted.

create or replace function public.on_auth_user_invited()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.invited_at is null
     and new.invited_at is not null
     and new.email_confirmed_at is null then
    update public.profiles
       set invitation_status = 'pending',
           last_invited_at = new.invited_at
     where id = new.id
       and invitation_status <> 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_invited on auth.users;
create trigger on_auth_user_invited
  after update of invited_at on auth.users
  for each row execute function public.on_auth_user_invited();

-- Revoke EXECUTE (mismo patrón que 0024 — la función solo es invocada
-- por el motor de triggers, no via RPC).
revoke execute on function public.on_auth_user_invited() from public;
revoke execute on function public.on_auth_user_invited() from anon;
revoke execute on function public.on_auth_user_invited() from authenticated;

-- Backfill: corregir cualquier user existente que esté en este estado
-- inconsistente (invitation_status='accepted' pero auth.users.invited_at
-- no nulo y email_confirmed_at nulo).
update public.profiles p
   set invitation_status = 'pending',
       last_invited_at = coalesce(p.last_invited_at, au.invited_at)
  from auth.users au
 where p.id = au.id
   and au.invited_at is not null
   and au.email_confirmed_at is null
   and p.invitation_status = 'accepted';
