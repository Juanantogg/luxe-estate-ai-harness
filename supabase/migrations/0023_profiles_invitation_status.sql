-- 0023_profiles_invitation_status.sql
--
-- Estado autoritativo de la invitación en profiles. Hasta ahora la UI
-- derivaba "Activo / Inactivo" solo de profiles.is_active, lo que hacía
-- que un usuario recién invitado (sin confirmar email) apareciera como
-- "Activo" desde el INSERT del profile (smoke test 2026-05-26).
--
-- Modelo:
--   profiles.invitation_status invitation_status_t not null default 'accepted'
--   - 'pending'  → invitado por admin, NO ha confirmado email todavía.
--   - 'accepted' → confirmó email O entró por signup directo O es seed.
--
-- Triggers:
--   1) handle_new_user (replace): al crear el profile, lee auth.users
--      del row recién insertado y decide pending vs accepted.
--   2) on_auth_user_confirmed (nuevo): AFTER UPDATE OF email_confirmed_at
--      en auth.users; flippea profiles.invitation_status a 'accepted'
--      cuando la transición es NULL → NOT NULL.
--
-- Backfill: TODOS los profiles existentes → 'accepted'. Justificación:
-- la columna no existía hasta ahora, y todos los profiles actuales han
-- estado funcionando como "Activo" en producción, así que pasar a
-- 'accepted' preserva el comportamiento visible. El advisor de UX
-- (humano) lo confirmó implícitamente al pedir el fix.

-- (1) Enum
do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'invitation_status_t'
  ) then
    create type public.invitation_status_t as enum ('pending', 'accepted');
  end if;
end$$;

-- (2) Columna
alter table public.profiles
  add column if not exists invitation_status public.invitation_status_t
    not null default 'accepted';

-- (3) Backfill explícito por idempotencia (el default ya cubre filas
--     existentes, pero dejamos el UPDATE para que la intención sea
--     auditable en el ledger).
update public.profiles set invitation_status = 'accepted'
 where invitation_status is null
    or invitation_status not in ('pending', 'accepted');

-- (4) Índice parcial: las queries de la tab "Invitaciones" filtran por
--     pending, que será siempre una fracción mínima del total.
create index if not exists profiles_pending_invitation_idx
  on public.profiles (created_at desc)
  where invitation_status = 'pending';

-- (5) handle_new_user: reemplaza la implementación de mig 0002 para
--     incluir invitation_status. Mantiene el on conflict do nothing y
--     el resto de columnas idénticas. Lee auth.users del NEW row (el
--     trigger corre AFTER INSERT en auth.users) para inferir el estado.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  computed_status public.invitation_status_t;
begin
  -- Invited si: vino por invite (invited_at no nulo) Y todavía no
  -- confirmó email. El segundo check importa porque el evento de
  -- confirmación post-invite también puede disparar este trigger en
  -- algunos paths (defensivo).
  if new.invited_at is not null and new.email_confirmed_at is null then
    computed_status := 'pending';
  else
    computed_status := 'accepted';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, invitation_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    computed_status
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- El trigger on_auth_user_created ya existe (mig 0002). NO se recrea;
-- la nueva definición de handle_new_user es picked up automáticamente.

-- (6) Trigger nuevo: cuando se confirma email, marca el profile como
--     accepted. Solo actúa en la transición NULL → NOT NULL para no
--     romper casos teóricos (re-confirmación, edición admin de la
--     columna por algún motivo futuro).
create or replace function public.on_auth_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles
       set invitation_status = 'accepted'
     where id = new.id
       and invitation_status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.on_auth_user_confirmed();

-- Nota: ambas funciones son SECURITY DEFINER pero NO se otorga EXECUTE
-- a authenticated/anon. Solo el motor de triggers las invoca. Esto
-- replica el patrón de mig 0017/0018/0020 (handle_new_user ya estaba
-- así desde mig 0011 + 0015).
