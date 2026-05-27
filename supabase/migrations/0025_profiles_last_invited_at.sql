-- 0025_profiles_last_invited_at.sql
--
-- Persistencia del timestamp del último invite enviado a un user. Sirve
-- al admin para saber si el link probablemente expiró (Supabase OTP de
-- invite tiene TTL 1h) y para decidir si renderizar el botón "Reenviar
-- invitación".
--
-- Modelo:
--   profiles.last_invited_at timestamptz null
--   - null     → el user nunca fue invitado (vino por signup directo o
--                es seed). El botón "Reenviar" NO se muestra: si un
--                user con profile.invitation_status='pending' y
--                last_invited_at IS NULL llegara a existir, es un bug
--                de data (no debería pasar). Documentado en §6.4 spec.
--   timestamp  → fecha/hora del último invite enviado. La action
--                resendInvitation lo actualiza a now() en éxito.
--
-- Backfill: lee auth.users.invited_at via subquery. Para profiles que
-- nunca tuvieron invite (invited_at NULL en auth) queda como NULL en
-- profiles, lo cual es correcto.
--
-- Trigger handle_new_user (replace): seteamos last_invited_at = new.invited_at
-- cuando viene por invite. Patrón replace ya usado 2 veces antes
-- (migs 0002 → 0023). Esta es la 3ª reescritura — documentado en CLAUDE.md
-- como patrón aceptado.

-- (1) Columna
alter table public.profiles
  add column if not exists last_invited_at timestamptz null;

-- (2) Backfill desde auth.users.invited_at
--     Solo afecta filas que NO tienen ya un timestamp y cuyo auth.users
--     row tiene invited_at no nulo. Idempotente.
update public.profiles p
   set last_invited_at = au.invited_at
  from auth.users au
 where p.id = au.id
   and au.invited_at is not null
   and p.last_invited_at is null;

-- (3) Índice parcial: la query del directorio filtra por
--     last_invited_at + threshold de 1h SOLO sobre rows pending.
--     Sin embargo, `getPendingInvitationCount` ya hace count via el
--     índice 0023 `profiles_pending_invitation_idx`. Para el filtro
--     por edad, la cardinalidad de pending es siempre minúscula así
--     que un índice extra no aporta; lo omitimos.
--     Nota: si en el futuro la tab "Invitaciones" llega a centenares
--     de filas, agregar índice sobre (last_invited_at) where
--     invitation_status='pending'.

-- (4) handle_new_user (replace): reemplaza la versión de mig 0023
--     para incluir last_invited_at en el INSERT. El resto de la
--     lógica es idéntica byte a byte. Patrón SECURITY DEFINER +
--     set search_path = public ya validado.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  computed_status public.invitation_status_t;
begin
  -- Misma lógica que mig 0023: invited si vino por invite Y no confirmó.
  if new.invited_at is not null and new.email_confirmed_at is null then
    computed_status := 'pending';
  else
    computed_status := 'accepted';
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    invitation_status,
    last_invited_at
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    computed_status,
    new.invited_at  -- null si no vino por invite; timestamp si sí
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- El trigger on_auth_user_created ya existe (mig 0002). NO se recrea.
-- on_auth_user_confirmed (mig 0023) se mantiene inalterado — el flip
-- a 'accepted' al confirmar email no necesita tocar last_invited_at.

-- Nota: no se otorga EXECUTE a authenticated/anon (mismo patrón mig
-- 0023, 0017, 0018). El motor de triggers la invoca como owner.
