-- 0020_profiles_notify_role_change.sql
-- Trigger AFTER UPDATE en profiles. Cuando un admin cambia el `role` o
-- `is_active` de otro usuario, inserta una notification en `notifications`
-- al user afectado. Patrón idéntico a 0017 / 0018 (SECURITY DEFINER +
-- search_path fijo).
--
-- - No notifica cuando el usuario edita su propio profile (auth.uid() = new.id).
-- - No notifica cuando no hay sesión (caso jobs administrativos service_role).
-- - Notifica role change y status change por separado: si en una misma
--   transacción cambian ambos, se generan 2 notifications.

create or replace function public.notify_profile_role_or_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_label_es text;
  notif_title text;
  notif_body text;
begin
  if auth.uid() is null or auth.uid() = new.id then
    return new;
  end if;

  if new.role is distinct from old.role then
    role_label_es := case new.role
      when 'user' then 'Usuario'
      when 'agent' then 'Agente'
      when 'broker' then 'Broker'
      when 'admin' then 'Administrador'
      else new.role::text
    end;
    notif_title := 'Tu rol fue actualizado';
    notif_body := 'Un administrador cambió tu rol a ' || role_label_es || '.';

    insert into public.notifications (
      recipient_id, type, title, body, read_at, created_at
    ) values (
      new.id, 'system', notif_title, notif_body, null, now()
    );
  end if;

  if new.is_active is distinct from old.is_active then
    if new.is_active = false then
      notif_title := 'Tu cuenta fue suspendida';
      notif_body := 'Un administrador suspendió tu cuenta. Contacta soporte si tienes preguntas.';
    else
      notif_title := 'Tu cuenta fue reactivada';
      notif_body := 'Un administrador reactivó tu cuenta.';
    end if;

    insert into public.notifications (
      recipient_id, type, title, body, read_at, created_at
    ) values (
      new.id, 'system', notif_title, notif_body, null, now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_notify_role_or_status_change on public.profiles;
create trigger profiles_notify_role_or_status_change
  after update on public.profiles
  for each row execute function public.notify_profile_role_or_status_change();
