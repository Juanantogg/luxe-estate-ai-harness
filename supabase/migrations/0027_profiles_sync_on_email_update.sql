-- 0027_profiles_sync_on_email_update.sql
--
-- Sincroniza `profiles.email` con `auth.users.email` cuando este último
-- cambia. Hasta ahora la columna `profiles.email` se setea en el INSERT
-- (trigger `handle_new_user`, mig 0002 / 0023 / 0025) y nunca se vuelve
-- a tocar. La feature `change_email_flow` introduce un flujo donde el
-- user cambia su email vía `auth.updateUser({ email })` y Supabase
-- actualiza `auth.users.email` cuando ambos links de confirmación
-- ("Secure email change" ON, default Cloud) se han clickeado. Sin este
-- trigger, `profiles.email` se queda con el viejo y el SettingsPanel /
-- ProfileHeader siguen mostrando el correo anterior.
--
-- Patrón idéntico a `on_auth_user_confirmed` (mig 0023) y
-- `on_auth_user_invited` (mig 0026):
--   - SECURITY DEFINER + set search_path = public.
--   - Trigger AFTER UPDATE OF email ON auth.users.
--   - Solo actúa cuando el valor REALMENTE cambió (defensive: triggers
--     en `update of <col>` corren también con UPDATEs que no cambian el
--     valor; el check explícito evita un UPDATE ruidoso a profiles).
--   - Idempotente: el UPDATE final filtra `where profiles.email <> new.email`.
--   - EXECUTE revocado a public/anon/authenticated — la función solo se
--     invoca desde el motor de triggers (igual que 0024/0026).

create or replace function public.on_auth_user_email_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.profiles
       set email = new.email
     where id = new.id
       and email is distinct from new.email;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.on_auth_user_email_changed();

-- Revoke EXECUTE (mismo patrón que 0024 / 0026 — la función solo es
-- invocada por el motor de triggers, no via RPC).
revoke execute on function public.on_auth_user_email_changed() from public;
revoke execute on function public.on_auth_user_email_changed() from anon;
revoke execute on function public.on_auth_user_email_changed() from authenticated;

-- Backfill: corregir cualquier row donde profiles.email esté desincronizado
-- respecto a auth.users.email (posible si algún user ya pasó por un
-- updateUser({ email }) confirmado antes de esta migración).
update public.profiles p
   set email = au.email
  from auth.users au
 where p.id = au.id
   and au.email is not null
   and p.email is distinct from au.email;
