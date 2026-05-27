# Design spec — resend_invitation_button

> Status: `requires_approval = true`. Esta feature pasa por la puerta de
> aprobación humana antes de implementar. Las 4 decisiones del leader
> (mecanismo, sin rate-limit custom, persistencia de timestamp,
> visibilidad server-side) ya están cerradas y se reflejan acá. La
> investigación de API Supabase (§1) cierra el último punto técnico
> abierto. Items pendientes de confirmación humana adicional en §13.

## 0. Contexto + bug que se arregla

Smoke test manual de `invitation_status_indicator` (cerrada hoy, commit
`d421486`): el humano clickeó un link de invitación de Supabase 1h 23min
después de enviado y aterrizó en:

```
http://localhost:3000/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired
```

Logs de Supabase Auth (vía MCP): `"error":"email link has expired",
"path":"/verify"`. El OTP de invite tiene TTL **1h** por default en
Supabase. El user `broujeteixeiru-5511@yopmail.com` quedó en estado
`pending` sin link válido para aceptar y sin forma de re-obtenerlo desde
la UI (el admin tendría que borrar y re-invitar, perdiendo el `user_id`,
profile, notificaciones ya generadas y el row de auth.users).

Esta feature agrega un botón "Reenviar invitación" en cada fila de la
tab "Invitaciones" cuando el link probablemente expiró (≥ 1h desde el
último envío). Genera un OTP nuevo SIN tocar `auth.users` (preserva ids
y relaciones) y registra el nuevo timestamp en una columna nueva
`profiles.last_invited_at`.

**Out of scope (deuda documentada para otra feature)**: la captura del
error críptico en la URL del invitado — eso es `invite_error_landing`,
ya pendiente en `feature_list.json` y dependiendo de esta.

## Referencia visual

- Pantalla afectada: `docs/designs/admin_user_directory_cards/`
  (`screen.png` + `code.html`).
- El mockup NO contempla un botón "Reenviar" porque cuando se diseñó la
  pantalla no existía el flow de invite. Decisión del designer: el botón
  reutiliza el slot de acciones de la fila (col-span-2 derecha en
  desktop; bloque `pt-1` al final del card en mobile) — mismo lugar
  donde hoy se rinde "Pendiente" disabled o `ChangeRoleMenu` según
  estado. Se mantiene el patrón visual del directorio sin agregar
  zonas nuevas.
- Spec base de la que extiende: `progress/invitation_status_indicator/design.md`
  (todo lo no redefinido acá sigue vigente).

## 1. Investigación: `generateLink` vs `inviteUserByEmail`

Verifiqué la implementación en
`node_modules/.pnpm/@supabase+auth-js@2.106.1/node_modules/@supabase/auth-js/dist/module/GoTrueAdminApi.js`
y los doc comments del `.d.ts`:

| Método                   | Endpoint                    | ¿Envía email?                                                                        | Comportamiento si user existe                                                                                                                                                                                               |
| ------------------------ | --------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inviteUserByEmail`      | `POST /invite`              | **SÍ**                                                                               | Si el user existe Y `email_confirmed_at IS NULL` (pending real), GoTrue regenera el token y reenvía. Si está confirmado: error `email_exists`/422.                                                                          |
| `generateLink({invite})` | `POST /admin/generate_link` | **NO**: devuelve `properties.action_link` para que TÚ envíes el email (custom SMTP). | "handles the creation of the user for `signup`, `invite` and `magiclink`" (doc). Si el user ya existe Y no confirmó, regenera el OTP y devuelve el link nuevo. Si está confirmado: error similar al de `inviteUserByEmail`. |

### Decisión: usar `inviteUserByEmail`

Razones:

1. **Envío de email "gratis"**: estamos usando el SMTP hosted de Supabase
   (verificado: `inviteUser` actual no configura `redirectTo` ni custom
   SMTP, y el smoke test confirmó que el email llega a yopmail). Si
   usáramos `generateLink`, tendríamos que montar nuestro propio
   envío (Resend/SendGrid/etc) — fuera de scope para MVP.
2. **Simetría con `inviteUser`**: la action `inviteUser` ya implementada
   en `src/lib/admin/actions.ts:354` usa `inviteUserByEmail`. Reusar el
   mismo método elimina la divergencia "invite inicial" vs "reenvío"
   en el wire format de Supabase.
3. **El behavior "regenera OTP para user pending"** está documentado
   y observado en GoTrue 2.x (es el comportamiento natural del endpoint
   `/invite` cuando matchea por email y el row tiene `email_confirmed_at
IS NULL`). El humano lo verificará en el smoke test §8: si el primer
   reenvío devuelve `email_exists`/422 en lugar de regenerar, el plan B
   está descripto en §13.B (atajo: borrar `auth.users` row primero
   — descartado en las decisiones cerradas; si fuera necesario,
   detendríamos la feature y volvemos al humano).

**Consecuencia en el código de la action**: la action `resendInvitation`
llama `admin.auth.admin.inviteUserByEmail(target.email, { data: {
initial_role: target.role } })`. El `data.initial_role` se mantiene por
consistencia con `inviteUser` aunque para el reenvío no aporta nada
funcional (el profile ya existe; `handle_new_user` no re-corre porque
es `AFTER INSERT` y no hay INSERT).

### Mapeo de errores

El payload de error de `inviteUserByEmail` (mismo shape que `inviteUser`
ya maneja en `actions.ts:325-339` via `toAdminApiError`):

| Detección                                              | Code interno       | Mensaje al admin                                             |
| ------------------------------------------------------ | ------------------ | ------------------------------------------------------------ |
| `err.status === 429`                                   | `rate_limited`     | "Demasiados reenvíos recientes. Espera unos minutos."        |
| `err.code === 'user_not_found'` o `err.status === 404` | `not_found`        | "Usuario no encontrado."                                     |
| `err.code === 'email_exists'` o `err.status === 422`   | `already_accepted` | "El usuario ya aceptó la invitación." (caso race — ver §6.1) |
| Cualquier otro                                         | `server`           | "No se pudo reenviar la invitación."                         |

`already_accepted` es un code nuevo del `ResendInvitationErrorCode`
(análogo a `already_invited`/`already_exists` de `InviteUserErrorCode`).
Justificación: 422/`email_exists` solo puede ocurrir si el user
confirmó el email en el ínterin entre el render de la página y el
click del admin. El mensaje específico evita confusión.

## 2. Migración SQL — `0025_profiles_last_invited_at.sql`

Numeración: **0025**. Última aplicada en remoto: `0024_on_auth_user_confirmed_revoke_execute.sql`
(verificado con `ls supabase/migrations/`).

```sql
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
```

### Validaciones post-migración (verificable vía MCP)

- `select count(*) from public.profiles where last_invited_at is not null`
  → debe coincidir con `select count(*) from auth.users where invited_at
is not null` (para profiles que ambos rows existen). En el proyecto
  actual, eso debería ser **1** (broujeteixeiru-5511).
- `select pg_typeof(last_invited_at) from public.profiles where
last_invited_at is not null limit 1` → `timestamp with time zone`.
- Definición de `handle_new_user` con `\sf+ public.handle_new_user`:
  el cuerpo contiene `last_invited_at`.
- `get_advisors` no debe reportar nada crítico nuevo (sigue el patrón
  ya validado).

## 3. Regenerar tipos TS

Tras `apply_migration`, el implementer corre el MCP
`generate_typescript_types` y reemplaza `src/types/database.ts`. Esto
añade automáticamente:

- `profiles.Row.last_invited_at: string | null`
- `profiles.Insert.last_invited_at?: string | null`
- `profiles.Update.last_invited_at?: string | null`

Sin cambios manuales.

## 4. Cambios en `src/lib/admin/queries.ts`

### 4.1. `AdminUserRow` enriquecido

```ts
export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  invitation_status: InvitationStatus;
  created_at: string;
  properties_count: number | null;
  sales_ytd: number | null;
  // NUEVO ↓
  last_invited_at: string | null;
  canResendInvitation: boolean;
}
```

### 4.2. Selección de columnas + cálculo de `canResendInvitation`

**Decisión: cálculo en TypeScript (no en SQL)** leyendo
`last_invited_at` y comparando con `Date.now()`.

Razones:

- La query SQL ya tiene `select` largo + filtros + `count: 'exact'` +
  enrichment dual de performance. Agregar un `expression` calculado en
  el `.select()` de PostgREST requiere `select=...,age:extract(...)`
  con sintaxis menos legible y un campo más en el shape; mantenerlo en
  TS deja la query igual de simple.
- El threshold (1h) es **lógica de UI**, no de datos. Si mañana lo
  cambiamos a 30min o 2h, queremos cambiarlo en un único lugar de TS,
  no en SQL + tipos + UI.
- La fila ya pasa por un `.map()` en el enrichment de performance
  (queries.ts:191) — agregar un campo derivado más cuesta cero.
- **Seguridad NO se compromete**: la flag `canResendInvitation` se
  calcula server-side (el código TS de `queries.ts` corre en
  `page.tsx`, que es Server Component). El cliente solo recibe el
  boolean ya resuelto. La action `resendInvitation` además
  re-verifica server-side antes de actuar (§5.3 punto e), por lo
  que aunque un cliente manipule el DOM y haga clic en un botón
  oculto, el servidor lo rechaza.

Constante exportada para el threshold (reutilizable en tests y en la
action):

```ts
/**
 * Antigüedad mínima del último invite para considerar el link expirado.
 * Supabase Auth OTP de invite tiene TTL 1h por default — usamos el mismo
 * valor como threshold para mostrar "Reenviar". Cambiar acá impacta UI
 * y server simultáneamente.
 */
export const INVITE_RESEND_THRESHOLD_MS = 60 * 60 * 1000; // 1 hora
```

Y en el `.map()` final de `listAdminUsers`:

```ts
const now = Date.now();
// ... dentro del map de profiles → items:
const lastInvitedAt = p.last_invited_at;
const canResendInvitation =
  p.invitation_status === 'pending' &&
  lastInvitedAt !== null &&
  now - new Date(lastInvitedAt).getTime() >= INVITE_RESEND_THRESHOLD_MS;

return {
  // ... resto de campos
  last_invited_at: lastInvitedAt,
  canResendInvitation,
};
```

Y en el `.select(...)` de la query:

```ts
.select(
  'id, email, full_name, avatar_url, role, is_active, invitation_status, created_at, last_invited_at',
  { count: 'exact' },
)
```

## 5. Cambios en `src/lib/admin/actions.ts`

### 5.1. Tipos para el resultado de la action

Nuevo discriminated union, en línea con `InviteUserResult`:

```ts
export type ResendInvitationErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid'
  | 'not_found'
  | 'not_pending' // target ya aceptó (NO está en pending) — race antes del lookup admin
  | 'already_accepted' // Supabase devuelve email_exists/422 — race en el RTT a Auth
  | 'rate_limited'
  | 'server';

export type ResendInvitationResult =
  | { ok: true; email: string }
  | { ok: false; error: { code: ResendInvitationErrorCode; message: string } };
```

`not_pending` y `already_accepted` son distintos a propósito:

- `not_pending` lo emite **nuestro guard** antes de llamar a Supabase
  (ver §5.3.c). El admin tenía la pantalla vieja, el target aceptó
  entre el render y el click.
- `already_accepted` lo emite **Supabase** cuando el guard pasó (el
  profile decía pending) pero `auth.users` ya tenía `email_confirmed_at`
  no-NULL — escenario sólo posible si los triggers no corrieron sync
  o si el row se modificó entre el guard y la llamada admin.

Para la UI ambos se renderean con el mismo mensaje: "El usuario ya
aceptó la invitación. Refresca la página." (consolidación en el toast
de error — ver §5.4).

### 5.2. Helper nuevo: `requirePendingTarget`

**Decisión sobre la confusión del prompt**: el helper existente
`requireAcceptedTarget` (actions.ts:99) NO está "hecho al revés". Hace
exactamente lo que dice su nombre: exige que el target sea `accepted`
y rechaza pendings. Es la lógica que necesitan `changeRole`,
`suspendUser`, `reactivateUser`.

Para esta feature necesitamos lo CONTRARIO: exigir que el target SÍ
esté pending. Creo un helper paralelo `requirePendingTarget` (nuevo).
Justificación:

- Patrón ya validado: `requireAdminCaller` + `requireAcceptedTarget`.
  Agregar `requirePendingTarget` mantiene la simetría y deja el
  archivo legible.
- NO invertir inline en la action: una invocación a `requirePendingTarget`
  es 2 líneas vs 15 de lookup+check+shape de error inline.
- Si en el futuro otra action necesita el mismo guard (ej: deuda
  documentada en §6 — "cancelar invitación"), ya estará disponible.

El helper devuelve además el `email` del target (que la action necesita
para llamar a `inviteUserByEmail`) y el `role` (para el `data:
{initial_role}`), evitando un segundo lookup:

```ts
/**
 * Verifica que el target SÍ esté en estado de invitación pendiente.
 *
 * Devuelve `{ ok: true, email, role }` cuando puede proceder (datos
 * útiles para la llamada admin posterior). Devuelve `ActionResult`
 * `not_pending` cuando el target ya aceptó (race antes del click) o
 * `not_found` cuando el row no existe. Espejo lógico de
 * `requireAcceptedTarget`.
 */
async function requirePendingTarget(
  targetUserId: string,
): Promise<
  | { ok: true; email: string; role: UserRole }
  | {
      ok: false;
      result: { ok: false; error: { code: ResendInvitationErrorCode; message: string } };
    }
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('email, role, invitation_status')
    .eq('id', targetUserId)
    .maybeSingle();

  if (error) {
    console.error('[requirePendingTarget] lookup failed:', error);
    return {
      ok: false,
      result: {
        ok: false,
        error: { code: 'server', message: 'No se pudo validar el estado del usuario.' },
      },
    };
  }
  if (!data) {
    return {
      ok: false,
      result: {
        ok: false,
        error: { code: 'not_found', message: 'Usuario no encontrado.' },
      },
    };
  }
  if (data.invitation_status !== 'pending') {
    return {
      ok: false,
      result: {
        ok: false,
        error: {
          code: 'not_pending',
          message: 'El usuario ya aceptó la invitación. Refresca la página.',
        },
      },
    };
  }
  return { ok: true, email: data.email, role: data.role };
}
```

Notar que `data.role` es del tipo `UserRole` (incluye `'broker'`); para
pasarlo a `inviteUserByEmail` lo casteamos a `AssignableRole` (ya
contiene todos los valores que la UI puede haber asignado al invitar).
Si por algún motivo es `'broker'` (out of scope UI), la action aún
funciona: `data` solo lo guarda en `raw_user_meta_data`, no es un check
de validación.

### 5.3. La action `resendInvitation`

Schema zod nuevo en `src/lib/admin/schemas.ts`:

```ts
export const resendInvitationSchema = z.object({
  targetUserId: z.string().uuid(),
});
export type ResendInvitationInput = z.infer<typeof resendInvitationSchema>;
```

Implementación de la action:

```ts
/**
 * Reenvía la invitación pendiente de un user invocando
 * `auth.admin.inviteUserByEmail` con service_role. Preserva user_id,
 * profile y relaciones (no borra ni recrea el row de auth.users).
 *
 * Guards (en orden):
 *   a) Zod validation.
 *   b) requireAdminCaller.
 *   c) requirePendingTarget (target debe estar pending).
 *   d) Edge: NO checkear self-target. El admin no se invita a sí mismo
 *      (la UI no permite verse en tab Invitaciones porque su propio
 *      status es 'accepted'); además el caller jamás está pending
 *      porque tiene sesión activa. Defensivo: si por algún motivo
 *      ocurriera, la action no rompería — Supabase respondería con
 *      already_accepted.
 *
 * Side effect post-éxito:
 *   - UPDATE profiles.last_invited_at = now() para que la UI no muestre
 *     "Reenviar" otra vez por al menos 1h.
 *   - revalidatePath('/admin/users') para que un F5 trivial muestre el
 *     timestamp nuevo.
 */
export async function resendInvitation(
  input: ResendInvitationInput,
): Promise<ResendInvitationResult> {
  const parsed = resendInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'invalid', message: 'Datos inválidos.' } };
  }

  const caller = await requireAdminCaller();
  if (!caller.ok) {
    return {
      ok: false,
      error: {
        code: caller.result.error.code as ResendInvitationErrorCode,
        message: caller.result.error.message,
      },
    };
  }

  const target = await requirePendingTarget(parsed.data.targetUserId);
  if (!target.ok) return target.result;

  const admin = createAdminClient();
  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(target.email, {
    data: { initial_role: target.role },
  });

  if (inviteErr) {
    const e = toAdminApiError(inviteErr);
    const code: ResendInvitationErrorCode =
      e.status === 429
        ? 'rate_limited'
        : e.code === 'user_not_found' || e.status === 404
          ? 'not_found'
          : e.code === 'email_exists' || e.status === 422
            ? 'already_accepted'
            : 'server';
    const message =
      code === 'rate_limited'
        ? 'Demasiados reenvíos recientes. Espera unos minutos.'
        : code === 'not_found'
          ? 'Usuario no encontrado.'
          : code === 'already_accepted'
            ? 'El usuario ya aceptó la invitación. Refresca la página.'
            : 'No se pudo reenviar la invitación.';
    console.error('[resendInvitation] inviteUserByEmail failed:', inviteErr);
    return { ok: false, error: { code, message } };
  }

  // Persistir el timestamp nuevo. Si esto falla, ya enviamos el email
  // — logueamos pero NO revertimos (mismo trade-off que mig 0024 con
  // signOut admin de suspendUser).
  const supabase = await createClient();
  const { error: updErr } = await supabase
    .from('profiles')
    .update({ last_invited_at: new Date().toISOString() })
    .eq('id', parsed.data.targetUserId);
  if (updErr) {
    console.error('[resendInvitation] last_invited_at update failed:', updErr);
  }

  revalidatePath(DIRECTORY_PATH);
  return { ok: true, email: target.email };
}
```

### 5.4. Imports nuevos en `actions.ts`

- `import type { UserRole } from './queries';` para tipar el helper.
- `resendInvitationSchema`, `ResendInvitationInput` desde `./schemas`.

## 6. Cambios en UI

### 6.1. `UserDirectoryRow.tsx` — render condicional del botón

El bloque `actionsNode` actual tiene 3 ramas (caller / pending /
ChangeRoleMenu). Ahora el pending se subdivide en dos:

```tsx
const actionsNode = isCaller ? (
  // Sin cambios: botón disabled "No editable" + bg-surface-soft del row
  <Button disabled aria-disabled="true" title="No puedes cambiar tu propio rol" ...>
    No editable
  </Button>
) : status === 'pending' ? (
  user.canResendInvitation ? (
    <ResendInvitationButton
      userId={user.id}
      userEmail={user.email}
      userDisplayName={displayName}
    />
  ) : (
    <Button
      variant="secondary"
      size="sm"
      disabled
      aria-disabled="true"
      title="Esperando que el usuario acepte la invitación. Si pasa más de una hora podrás reenviarla."
      className="md:w-auto"
      fullWidth
    >
      Pendiente
    </Button>
  )
) : (
  <ChangeRoleMenu ... />
);
```

Sin cambios al resto del row (avatar, name, status indicator, etc.).
El `UserStatusIndicator` sigue mostrando "Invitado pendiente" en
ambos sub-estados — la diferencia es solo en el slot de acciones.

### 6.2. Componente nuevo `ResendInvitationButton.tsx`

Archivo: `src/components/admin/ResendInvitationButton.tsx`.

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui';
import { resendInvitation } from '@/lib/admin/actions';

export interface ResendInvitationButtonProps {
  userId: string;
  userEmail: string;
  userDisplayName: string;
}

type Feedback =
  | { kind: 'idle' }
  | { kind: 'success'; email: string }
  | { kind: 'error'; message: string };

/**
 * Botón "Reenviar invitación" para filas pending con last_invited_at
 * antiguo. Llama a la Server Action `resendInvitation`. Sigue el patrón
 * de feedback inline ya usado en InviteUserDialog (success/error como
 * <p> bajo el control) porque no hay sistema global de toast en el repo
 * todavía. El feedback se auto-limpia tras 4s en éxito y persiste hasta
 * próximo clic en error.
 *
 * Decisión: `useTransition` (no `useState<isPending>` manual). Razones:
 *  - Es un Server Action call — useTransition lo wrappea naturalmente.
 *  - Permite que React mantenga visible la UI vieja durante la transición
 *    (mismo patrón que InviteUserDialog / ChangeRoleConfirmDialog).
 *  - Permite usar `loading={isPending}` directamente en el Button.
 */
export function ResendInvitationButton({
  userId,
  userEmail,
  userDisplayName,
}: ResendInvitationButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' });

  function handleClick() {
    setFeedback({ kind: 'idle' });
    startTransition(async () => {
      const result = await resendInvitation({ targetUserId: userId });
      if (!result.ok) {
        setFeedback({ kind: 'error', message: result.error.message });
        return;
      }
      setFeedback({ kind: 'success', email: result.email });
      // Auto-limpia tras 4s para que la fila vuelva a su estado
      // "esperando aceptación" visualmente.
      setTimeout(() => setFeedback({ kind: 'idle' }), 4000);
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-1.5 md:items-end">
      <Button
        variant="secondary"
        size="sm"
        leadingIcon="send"
        loading={isPending}
        disabled={isPending || feedback.kind === 'success'}
        aria-label={`Reenviar invitación a ${userEmail}`}
        aria-busy={isPending}
        onClick={handleClick}
        className="md:w-auto"
        fullWidth
      >
        Reenviar invitación
      </Button>
      {feedback.kind === 'success' && (
        <p className="text-xs text-primary md:text-right" role="status">
          Invitación reenviada a <span className="font-medium">{userDisplayName}</span>.
        </p>
      )}
      {feedback.kind === 'error' && (
        <p className="text-xs text-danger md:text-right" role="alert">
          {feedback.message}
        </p>
      )}
    </div>
  );
}
```

Notas de implementación:

- **No usar `prefer-const` lint del Button**: `disabled={isPending ||
feedback.kind === 'success'}` evita doble clic durante el window de
  4s post-éxito (la fila revalida en background; en próximo F5 el row
  desaparece o cambia de tab).
- **Ícono `send`**: ya usado por `inviteUser` button. Consistencia
  visual entre "Enviar invitación" inicial y "Reenviar invitación".
- **`fullWidth` + `md:w-auto`**: replicada del `actionsNode` existente
  para mantener el comportamiento responsive del card mobile.
- **`useTransition` confirmado** (decisión explícita pedida por el
  leader). Justificación arriba en doc comment.

### 6.3. `index.ts` barrel

`src/components/admin/index.ts` agrega:

```ts
export { ResendInvitationButton } from './ResendInvitationButton';
```

`page.tsx` NO necesita importarlo (solo lo monta `UserDirectoryRow`).
El barrel se actualiza por uniformidad con el resto de componentes
admin.

### 6.4. `UserStatusIndicator` y resto de componentes

Sin cambios. La derivación de `status` sigue siendo:

```
invitation_status='pending' → 'pending' (independiente de last_invited_at)
```

El botón visible/disabled es ortogonal al texto del indicator.

## 7. Tokens a usar

Sin tokens nuevos. Todos ya existen y los reusamos:

- Botón "Reenviar invitación": `Button variant="secondary"` →
  `bg-surface-container text-on-surface border-outline` (definido en
  `Button.tsx` primitive).
- Botón disabled "Pendiente": misma variant + `disabled:opacity-50
disabled:cursor-not-allowed`.
- Feedback success: `text-primary` (#006655 mosque).
- Feedback error: `text-danger` (#dc2626).
- Ícono `send` con color heredado de la variant del button.

## 8. Tipografía

Sin cambios respecto a `invitation_status_indicator/design.md`. Los
textos nuevos heredan:

- "Reenviar invitación" en botón: `text-xs font-medium` (default
  `Button size="sm"`).
- "Invitación reenviada a {nombre}." en feedback: `text-xs` (inline
  bajo el botón, alineado a derecha en desktop).
- "Esperando que el usuario acepte..." en `title` HTML del botón
  disabled: rendering nativo del browser, no usa tokens (mismo
  trade-off documentado en `invitation_status_indicator/design.md` §8).

## 9. Datos

### Tabla consumida

- `profiles` (read): + columna `last_invited_at` nueva.
- `profiles` (write desde Server Action): solo `last_invited_at = now()`.
- `auth.users` (write indirecto vía `inviteUserByEmail`): Supabase
  regenera el OTP en el row existente. No tocamos columnas
  directamente.

### Server vs Client

| Archivo                         | Tipo                        | Razón                                                   |
| ------------------------------- | --------------------------- | ------------------------------------------------------- |
| `page.tsx`                      | Server                      | Sin cambios (sigue siendo SC).                          |
| `UserDirectoryRow.tsx`          | Server                      | Sin cambios — render condicional pasa props a SC y CC.  |
| `ResendInvitationButton.tsx`    | **Client (`'use client'`)** | Interactividad: `useTransition`, `useState`, `onClick`. |
| `actions.ts` (resendInvitation) | Server Action               | `'use server'` ya en el archivo.                        |
| `queries.ts`                    | Module                      | Server-only (importa types y nada client).              |

### Cache / revalidación

- `page.tsx` sigue `dynamic = 'force-dynamic'`. Cada navegación
  re-fetcha.
- La action llama `revalidatePath('/admin/users')` en éxito → próximo
  render del admin trae el `last_invited_at` actualizado y el botón
  desaparece (o queda como "Pendiente" disabled si volvió a estar
  dentro del threshold de 1h).

## 10. Interactividad

| Elemento                         | Tipo   | Detalle                                                                                |
| -------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| Botón "Reenviar invitación"      | client | `onClick` → Server Action; loading state; feedback inline.                             |
| Botón disabled "Pendiente"       | static | `disabled aria-disabled` + tooltip nativo via `title`. NO interactivo.                 |
| Feedback `<p>` success/error     | static | Render condicional desde state local del botón.                                        |
| Server Action `resendInvitation` | server | Mutación + revalidate. Sin notificaciones — esta action no escribe en `notifications`. |

**Decisión: NO crear notificación al admin** post-reenvío. Justificación:
es el propio admin quien clickeó y ya ve el feedback inline. Crear una
notification en su propia bandeja sería ruido. (En contraste, los
triggers de mig 0020 sí notifican AL TARGET cuando se le cambia el rol,
porque el target no participó del clic.)

## 11. Estados

### Loading

- Mientras `isPending`: botón muestra spinner via `Button loading={...}`
  (primitive ya soporta el patrón); `aria-busy="true"`; `disabled`.

### Éxito

- Mensaje inline `text-primary`: "Invitación reenviada a {nombre}."
- Botón queda disabled durante 4s para evitar doble envío accidental.
- En el próximo render del row (post-revalidate), `canResendInvitation`
  vuelve a `false` (porque `now - last_invited_at < 1h`) y se muestra
  el botón disabled "Pendiente".

### Error

- `rate_limited` → "Demasiados reenvíos recientes. Espera unos minutos."
- `not_found` → "Usuario no encontrado."
- `not_pending` / `already_accepted` → "El usuario ya aceptó la
  invitación. Refresca la página."
- `unauthenticated` → "Sesión expirada."
- `forbidden` → "No autorizado."
- `invalid` → "Datos inválidos."
- `server` (default) → "No se pudo reenviar la invitación."

El mensaje persiste hasta el próximo clic (no auto-clear). Justificación:
en error el admin necesita leerlo, copiarlo, decidir qué hacer; el
auto-clear de 4s podría hacerle perder el texto.

### Empty

No aplica. El botón vive dentro de una fila — si no hay filas pending,
el componente no se monta.

## 12. A11y — checklist concreto

- **Botón "Reenviar invitación"**:
  - `aria-label="Reenviar invitación a {email}"` (no `aria-label`
    con `{userDisplayName}` porque dos users pueden tener el mismo
    nombre pero email único).
  - `aria-busy="true"` cuando `isPending`.
  - `disabled` durante pending y durante el window de 4s post-éxito.
- **Botón disabled "Pendiente"**:
  - `aria-disabled="true"` + `title` con la explicación. Idéntico al
    patrón del caller y de la versión actual ya validada.
- **Feedback inline**:
  - `role="status"` para success (live region polite implícito).
  - `role="alert"` para error (live region assertive).
- **Contraste**:
  - `text-primary` (#006655) sobre `bg-surface` (blanco): AA, ya
    validado.
  - `text-danger` (#dc2626) sobre `bg-surface`: AA, ya validado.
- **Tab order**: el componente nuevo se inserta en el slot de acciones
  del row, así que cae naturalmente al final del foco del row. Tabindex
  default del Button. No requiere management explícito.

## 13. Puntos de confirmación humana antes de implementar

A. **Numeración migración 0025**: confirmar que `0024_on_auth_user_confirmed_revoke_execute.sql`
sigue siendo la última aplicada en remoto vía MCP (vía
`mcp__supabase__list_migrations` antes de `apply_migration`).
Verificado en el árbol local pero el ledger remoto puede haber
avanzado entre design y implementación.

B. **Plan B si `inviteUserByEmail` rechaza pending con `email_exists`**:
Documentado en §1: si el comportamiento real de GoTrue en el proyecto
`eacacybbdrstirdvwwsn` NO regenera el OTP para users pending y
devuelve 422, debemos pivotear a `generateLink({ type: 'invite' })`

- montar envío de email custom (Resend/SendGrid). Como esto agrega
  dependencia + config + es out of scope del MVP, la feature quedaría
  **blocked** y el implementer debe reportarlo al leader. La probabilidad
  es baja (el behavior actual de GoTrue es regenerar, y `inviteUser`
  actual no falla en ningún caso observado), pero el smoke test §15 es
  el que lo confirma.

C. **Texto exacto del feedback de éxito**: propuesto "Invitación
reenviada a {nombre}." Alternativa "Email de invitación reenviado a
{nombre}." es más explícita sobre el medio. Recomendación: la versión
corta porque la frase ya está en el contexto "directorio admin → fila
pending".

D. **Auto-clear del feedback success a 4s**: ¿es OK el valor o el humano
prefiere otro (3s o 6s)? El proyecto no tiene un patrón establecido
todavía. Recomendación: 4s — suficiente para que el admin lea, no
tanto que sea molesto en escenarios de varios reenvíos seguidos.

E. **Política sobre re-renvíos `last_invited_at` UPDATE fail**:
propuesto loguear + NO revertir (igual que `signOut` admin de
`suspendUser`). Si el humano prefiere "intentar revertir" — agregar
notación en spec; pero hay un problema: no podemos "des-enviar" un
email. Conclusión: log + proceder es la única política sana.

F. **¿Mostrar `last_invited_at` en la UI como texto auxiliar?** Propuesto:
NO. La fila ya tiene mucho texto y el admin no necesita el timestamp
exacto — solo necesita "¿puedo reenviar?" (botón o no botón). Si en
el futuro hay feedback negativo del humano, se puede agregar
"Invitado hace 3 días" como subtítulo. Out of scope.

## 14. Riesgos

- **R1 — Race triple-window**: admin abre la pantalla, target acepta
  invite, admin clickea reenviar. El guard `requirePendingTarget` lee
  `profiles.invitation_status` que es **accepted** post-trigger
  `on_auth_user_confirmed`. El guard rechaza con `not_pending` antes de
  llamar a Supabase. Cubierto correctamente.

- **R2 — Race entre guard y `inviteUserByEmail`**: el guard pasa
  (profile dice pending) pero entre líneas el target confirma. Supabase
  responde `email_exists`/422. El mapeo `already_accepted` lo cubre con
  mensaje específico. **Aceptable** — race extremadamente improbable
  (<100ms windows).

- **R3 — `last_invited_at` queda desfasado si Supabase falla
  silenciosamente**: si `inviteUserByEmail` devuelve `ok` pero el email
  no se envía (problema de SMTP en Supabase), `last_invited_at` se
  actualiza igual y el botón desaparece por 1h. Mitigación: el log de
  Supabase Auth (verificable vía MCP `get_logs`) confirma el envío real;
  el smoke test §15 valida la recepción del email. **Aceptable** —
  caso obscuro fuera del control del frontend.

- **R4 — Service_role usado en cada reenvío**: ya está bien protegido
  (`'server-only'` + `createAdminClient` cacheado). Mismo trade-off ya
  asumido para `inviteUser` y `suspendUser`. Sin riesgo nuevo.

- **R5 — Botón visible para profile sin `auth.users` correspondiente
  (data corrupt)**: si por algún motivo un profile pending no tiene
  row en auth.users (bug histórico), `inviteUserByEmail` falla con
  `user_not_found`. El mapeo `not_found` lo cubre. El admin verá
  "Usuario no encontrado." y puede decidir borrar el profile huérfano
  manualmente. **Aceptable** — caso de bug de data, no de feature.

- **R6 — Threshold de 1h hardcoded vs TTL real de Supabase**: el
  proyecto usa el OTP TTL default de Supabase (1h). Si el humano alguna
  vez configura un TTL distinto en el dashboard, el threshold de la
  feature queda desincronizado. **Mitigación**: comentario explícito en
  `INVITE_RESEND_THRESHOLD_MS` + acceptance criterion (§17) verificable.

## 15. Smoke test manual (humano lo ejecuta tras implementer)

Pre-requisitos:

- `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` (ya seteado, mismo que
  usa `inviteUser`).
- 1 admin real + el invitado existente
  `broujeteixeiru-5511@yopmail.com` (ya marcado pending desde la
  feature anterior).
- Acceso al MCP para forzar el escenario "han pasado 2 horas" sin
  esperar.
- App corriendo con `pnpm dev`.

Pasos:

1. Login como admin → ir a `/admin/users` → tab "Invitaciones".
2. **Asserción A**: la fila de `broujeteixeiru-5511@yopmail.com` aparece
   con badge "Invitado pendiente", botón **disabled "Pendiente"** (no
   ha pasado 1h desde la invitación original, o `last_invited_at` aún
   está dentro del threshold post-backfill — verificar mensaje del
   tooltip).
3. **Forzar el escenario expirado** vía MCP (`update profiles set
last_invited_at = now() - interval '2 hours' where email =
'broujeteixeiru-5511@yopmail.com'`).
4. F5 en `/admin/users?tab=pending`.
5. **Asserción B**: la fila ahora muestra el botón "Reenviar invitación"
   (variant secondary, ícono `send`).
6. Click en "Reenviar invitación".
7. **Asserción C**: botón muestra spinner por ~1-2s (loading state);
   luego aparece debajo el mensaje "Invitación reenviada a
   broujeteixeiru-5511..." en color primary.
8. **Asserción D**: el botón queda disabled hasta auto-clear (~4s);
   luego vuelve a estado normal — pero la página revalidó así que el
   próximo render usa `last_invited_at = now()` y el botón "Reenviar"
   desaparece, sustituido por "Pendiente" disabled.
9. Abrir yopmail con `broujeteixeiru-5511@yopmail.com`.
10. **Asserción E**: hay un nuevo email "Confirm Your Signup" con un
    link de invitación. El timestamp del email es de ahora (no del
    invite original).
11. Click en el link DENTRO DE LA HORA siguiente. Completar password.
12. F5 admin browser.
13. **Asserción F**: la fila desapareció de "Invitaciones" y aparece en
    la tab "Usuarios" (o el rol que se le asignó) como Activo. El
    botón "Cambiar rol" del row ahora está activo.

#### Sub-tests de error mapping:

14. (Opcional) Test de race: forzar `update auth.users set
email_confirmed_at = now() where email = '...'` SIN modificar
    `profiles.invitation_status` (saltarse el trigger — solo posible
    vía MCP). Click "Reenviar". **Asserción G**: feedback de error
    "El usuario ya aceptó la invitación. Refresca la página."
15. (Opcional) Test de rate-limit: ejecutar el reenvío sin esperar el
    auto-clear, repetidamente. En algún punto Supabase debería
    rate-limitear (su rate-limit es ~5 invites/hora/admin por defecto).
    **Asserción H**: feedback de error "Demasiados reenvíos recientes.
    Espera unos minutos."

#### Limpieza:

16. Si quedan filas pending corruptas (caso §6 del spec base, profile
    sin invited_at correspondiente), borrar manualmente vía MCP.

## 16. Alternativas consideradas (obligatorio por `requires_approval`)

### Mecanismo de reenvío

- **Opción A — `inviteUserByEmail` (RECOMENDADA, elegida)**: una sola
  llamada, Supabase envía el email vía su SMTP hosted, regenera el OTP
  preservando user_id. Pro: zero config extra. Contra: si GoTrue cambia
  el behavior y rechaza pendings con 422, hay que pivotear (§13.B).
- **Opción B — `generateLink({invite}) + custom SMTP** (Resend/SendGrid):
  más control, mismo behavior garantizado. Contra: agregar dependencia,
  config de API key, template HTML del email. Out of scope MVP.
- **Opción C — Borrar el row de `auth.users` + reinvitar**: simple
  pero rompe `user_id` y todas las relaciones (profile, notifications,
  favorites futuros, etc). Explícitamente rechazado en decisiones
  cerradas del leader.

**Recomendación**: A. Si el smoke test demuestra que GoTrue rechaza
pending con 422 en este proyecto, escalar a leader antes de pivotear.

### Helper `requirePendingTarget` vs check inline

- **Opción A — Helper paralelo a `requireAcceptedTarget` (RECOMENDADA,
  elegida)**: simetría obvia, una invocación de 2 líneas, devuelve los
  datos útiles (email, role) para evitar segundo lookup.
- **Opción B — Check inline en `resendInvitation`**: 15 líneas extra
  en la action, lookup duplicado del email/role.
- **Opción C — Modificar `requireAcceptedTarget` para aceptar un
  parámetro de polaridad (`expectPending: boolean`)**: configurabilidad
  ganada vs claridad perdida. Los nombres `requireAcceptedTarget` y
  `requirePendingTarget` son auto-documentantes; un único helper con
  flag boolean sería más enrevesado.

**Recomendación**: A.

### Visibilidad del botón (umbral)

- **Opción A — Server-side flag `canResendInvitation` calculado en
  `listAdminUsers` con threshold = 1h (RECOMENDADA, elegida)**: respeta
  la decisión cerrada del leader (no manipulable desde cliente).
- **Opción B — Cliente lee `last_invited_at` y calcula con
  `Date.now()`**: rechazado por decisión del leader (manipulable y
  fuera de control).
- **Opción C — Botón siempre visible, rate-limit como única barrera**:
  rechazado por decisión del leader ("evita reenvíos accidentales
  antes de revisar bandeja"). Además, la UI sin filtro temporal
  invitaría al admin a clickear inmediatamente tras invitar (cuando
  el target todavía no abrió el email).

**Recomendación**: A.

### Cálculo de la flag (SQL vs TS)

- **Opción A — TS en `listAdminUsers` (RECOMENDADA, elegida)**: threshold
  centralizado en una constante; query SQL inalterada.
- **Opción B — Expression en `.select()` de PostgREST**: campo calculado
  por DB. Pro: cero JS. Contra: threshold hardcoded en query string;
  cambiar la lógica requiere cambiar el SQL y los tipos.

**Recomendación**: A.

### Feedback de éxito/error

- **Opción A — Inline `<p>` bajo el botón (RECOMENDADA, elegida)**:
  consistente con `InviteUserDialog` (success "Invitación enviada a
  ..." inline). Cero infraestructura nueva.
- **Opción B — Sistema global de toast** (sonner / radix-toast / custom):
  fuera de scope; ya marcado como TODO en
  `src/components/property/FavoriteButton.tsx:59`. Si en el futuro se
  agrega, este componente migra trivial.
- **Opción C — `alert()` nativo del browser**: rechazado por UX.

**Recomendación**: A. Migración futura a B cuando exista.

## 17. Resumen de archivos a crear/modificar

### Crear

- `supabase/migrations/0025_profiles_last_invited_at.sql`
- `src/components/admin/ResendInvitationButton.tsx`

### Modificar

- `src/types/database.ts` (regenerado via MCP)
- `src/lib/admin/queries.ts` (campo `last_invited_at` + `canResendInvitation`
  - constante `INVITE_RESEND_THRESHOLD_MS`)
- `src/lib/admin/schemas.ts` (zod schema nuevo `resendInvitationSchema`)
- `src/lib/admin/actions.ts` (helper `requirePendingTarget` + action
  `resendInvitation` + types `ResendInvitationErrorCode`/`Result`)
- `src/components/admin/UserDirectoryRow.tsx` (render condicional del
  botón)
- `src/components/admin/index.ts` (export del componente nuevo)

### NO modificar

- `src/components/admin/UserStatusIndicator.tsx` (lógica de status
  inalterada)
- `src/components/admin/ChangeRoleMenu.tsx`, `ChangeRoleConfirmDialog.tsx`,
  `InviteUserDialog.tsx`, `InviteUserButton.tsx`, `UserDirectoryTabs.tsx`,
  `UserRoleBadge.tsx`, `UserDirectorySearch.tsx`,
  `UserDirectoryEmptyState.tsx`
- `src/app/(admin)/admin/users/page.tsx` (la query devuelve la flag,
  el page la pasa al row vía `user.canResendInvitation` automático)
- `src/lib/supabase/admin.ts` (sin cambios)
- Migraciones 0001-0024
- `CLAUDE.md`, `AGENTS.md`, `.claude/`

## 18. Criterios de aceptación verificables (gate de reviewer)

- [ ] Migración `0025_profiles_last_invited_at.sql` aplicada via MCP.
- [ ] `select count(*) from profiles where last_invited_at is not null`
      ≥ 1 (el backfill capturó al menos al user pending existente
      `broujeteixeiru-5511@yopmail.com`).
- [ ] `\sf+ public.handle_new_user` muestra que el cuerpo nuevo
      incluye `last_invited_at, new.invited_at`.
- [ ] `src/types/database.ts` regenerado incluye `last_invited_at:
    string | null` en `profiles.Row`.
- [ ] `AdminUserRow` tiene los campos `last_invited_at` y
      `canResendInvitation`.
- [ ] Constante `INVITE_RESEND_THRESHOLD_MS` exportada desde
      `queries.ts` con valor `3_600_000` (1h en ms).
- [ ] Schema zod `resendInvitationSchema` con un único campo
      `targetUserId: uuid` en `schemas.ts`.
- [ ] Action `resendInvitation` existe en `actions.ts`, usa
      `'use server'`, valida con zod, llama a `requireAdminCaller` +
      `requirePendingTarget`.
- [ ] Helper `requirePendingTarget` definido y devuelve `email` + `role`
      del target en el caso ok.
- [ ] Llamada a Supabase es `admin.auth.admin.inviteUserByEmail(email,
    { data: { initial_role: role } })`.
- [ ] Mapping de errores incluye los 4 cases: 429 → rate_limited,
      404/user_not_found → not_found, 422/email_exists →
      already_accepted, resto → server. Mensajes en español según §11.
- [ ] Post-éxito: UPDATE `profiles.last_invited_at = now()` +
      `revalidatePath('/admin/users')`.
- [ ] `ResendInvitationButton.tsx` existe como `'use client'`, usa
      `useTransition`, tiene `aria-label="Reenviar invitación a
    {email}"` y `aria-busy={isPending}`.
- [ ] El botón se renderea SOLO cuando `status === 'pending' AND
    user.canResendInvitation === true`. Cuando pending pero
      `!canResendInvitation`, sigue mostrándose botón disabled
      "Pendiente" con tooltip actualizado a "Esperando que el usuario
      acepte la invitación. Si pasa más de una hora podrás reenviarla."
- [ ] Atacar la action desde DevTools con un target NO pending
      devuelve `{ ok: false, error: { code: 'not_pending', ... } }`.
- [ ] Smoke test §15: asserciones A→F pasan.
- [ ] `init.sh full` pasa (lint + type-check + build).
- [ ] Cero hex literales en JSX (grep limpio).
- [ ] `get_advisors` post-migración no reporta warnings críticos nuevos.
