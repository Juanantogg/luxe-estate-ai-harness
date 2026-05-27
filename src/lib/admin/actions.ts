'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from './queries';
import {
  changeRoleSchema,
  inviteUserSchema,
  reactivateUserSchema,
  resendInvitationSchema,
  suspendUserSchema,
  type ChangeRoleInput,
  type InviteUserInput,
  type ReactivateUserInput,
  type ResendInvitationInput,
  type SuspendUserInput,
} from './schemas';

/**
 * Resultado uniforme para las actions de mutación del directorio. La UI
 * pinta `error.message` directamente, así que los mensajes ya vienen en
 * español neutro y sin filtrar detalles de la infra.
 */
export type ActionErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid'
  | 'not_found'
  | 'self_target'
  | 'no_op'
  | 'server';

export type ActionResult =
  | { ok: true }
  | { ok: false; error: { code: ActionErrorCode; message: string } };

export type InviteUserErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid'
  | 'already_invited'
  | 'already_exists'
  | 'rate_limited'
  | 'server';

export type InviteUserResult =
  | { ok: true; email: string }
  | { ok: false; error: { code: InviteUserErrorCode; message: string } };

/**
 * Códigos de error para `resendInvitation`. Diferenciamos `not_pending`
 * (nuestro guard antes de llamar a Supabase: el target ya aceptó antes
 * del click) de `already_accepted` (la propia API de Supabase reporta
 * `email_exists`/422 — race extremadamente improbable entre guard y RTT).
 * En UI ambos se renderean con el mismo mensaje, pero diferenciar facilita
 * debugging.
 */
export type ResendInvitationErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid'
  | 'not_found'
  | 'not_pending'
  | 'already_accepted'
  | 'rate_limited'
  | 'server';

export type ResendInvitationResult =
  | { ok: true; email: string }
  | { ok: false; error: { code: ResendInvitationErrorCode; message: string } };

const DIRECTORY_PATH = '/admin/users';

/**
 * Valida sesión + rol admin del caller. Devuelve `user.id` cuando OK, o un
 * `ActionResult` listo para retornar cuando falla. Centraliza el doble
 * check para no duplicar boilerplate en cada action.
 */
async function requireAdminCaller(): Promise<
  { ok: true; callerId: string } | { ok: false; result: Extract<ActionResult, { ok: false }> }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      result: {
        ok: false,
        error: { code: 'unauthenticated', message: 'Sesión expirada.' },
      },
    };
  }
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (error || profile?.role !== 'admin') {
    return {
      ok: false,
      result: {
        ok: false,
        error: { code: 'forbidden', message: 'No autorizado.' },
      },
    };
  }
  return { ok: true, callerId: user.id };
}

/**
 * Verifica que el target NO esté en estado de invitación pendiente.
 *
 * Si lo está, devuelve un `ActionResult` `invalid` listo para retornar.
 * Si la fila no existe, deja pasar — el lookup principal de cada action
 * se encarga del `not_found` con su mensaje propio.
 *
 * Se invoca DESPUÉS de `requireAdminCaller` y del self-target guard, pero
 * ANTES del lookup principal del target. No se invoca desde `inviteUser`
 * (decisión §4.3 del spec).
 */
async function requireAcceptedTarget(
  targetUserId: string,
): Promise<{ ok: true } | { ok: false; result: Extract<ActionResult, { ok: false }> }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('invitation_status')
    .eq('id', targetUserId)
    .maybeSingle();

  if (error) {
    console.error('[requireAcceptedTarget] lookup failed:', error);
    return {
      ok: false,
      result: {
        ok: false,
        error: {
          code: 'server',
          message: 'No se pudo validar el estado del usuario.',
        },
      },
    };
  }
  if (!data) return { ok: true };

  if (data.invitation_status === 'pending') {
    return {
      ok: false,
      result: {
        ok: false,
        error: {
          code: 'invalid',
          message: 'El usuario invitado todavía no aceptó la invitación.',
        },
      },
    };
  }
  return { ok: true };
}

/**
 * Verifica que el target SÍ esté en estado de invitación pendiente.
 *
 * Devuelve `{ ok: true, email, role }` cuando puede proceder (datos
 * útiles para la llamada admin posterior). Devuelve un `ResendInvitationResult`
 * con `not_pending` cuando el target ya aceptó (race antes del click) o
 * `not_found` cuando el row no existe. Espejo lógico de
 * `requireAcceptedTarget`.
 */
async function requirePendingTarget(targetUserId: string): Promise<
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

/**
 * Cambia el rol de otro usuario. El trigger DB `notify_profile_role_or_status_change`
 * (mig 0020) se encarga de notificar al target — esta action no toca
 * `notifications` directamente.
 */
export async function changeRole(input: ChangeRoleInput): Promise<ActionResult> {
  const parsed = changeRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'invalid', message: 'Datos inválidos.' } };
  }

  const caller = await requireAdminCaller();
  if (!caller.ok) return caller.result;

  if (parsed.data.targetUserId === caller.callerId) {
    return {
      ok: false,
      error: { code: 'self_target', message: 'No puedes cambiar tu propio rol.' },
    };
  }

  const accepted = await requireAcceptedTarget(parsed.data.targetUserId);
  if (!accepted.ok) return accepted.result;

  const supabase = await createClient();

  const { data: target, error: targetErr } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', parsed.data.targetUserId)
    .maybeSingle();
  if (targetErr) {
    console.error('[changeRole] target lookup failed:', targetErr);
    return { ok: false, error: { code: 'server', message: 'No se pudo actualizar.' } };
  }
  if (!target) {
    return { ok: false, error: { code: 'not_found', message: 'Usuario no encontrado.' } };
  }
  if (target.role === parsed.data.nextRole) {
    return { ok: false, error: { code: 'no_op', message: 'El usuario ya tiene ese rol.' } };
  }

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ role: parsed.data.nextRole })
    .eq('id', parsed.data.targetUserId);
  if (updErr) {
    console.error('[changeRole] update failed:', updErr);
    return { ok: false, error: { code: 'server', message: 'No se pudo actualizar.' } };
  }

  revalidatePath(DIRECTORY_PATH);
  return { ok: true };
}

/**
 * Suspende un usuario (`is_active=false`) y revoca su sesión activa via
 * Admin API (decisión R2). Si el `signOut` falla, NO se revierte el
 * suspend lógico: la sesión activa expira en ~1h en el peor caso.
 */
export async function suspendUser(input: SuspendUserInput): Promise<ActionResult> {
  const parsed = suspendUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'invalid', message: 'Datos inválidos.' } };
  }

  const caller = await requireAdminCaller();
  if (!caller.ok) return caller.result;

  if (parsed.data.targetUserId === caller.callerId) {
    return {
      ok: false,
      error: { code: 'self_target', message: 'No puedes suspenderte a ti mismo.' },
    };
  }

  const accepted = await requireAcceptedTarget(parsed.data.targetUserId);
  if (!accepted.ok) return accepted.result;

  const supabase = await createClient();

  const { data: target, error: targetErr } = await supabase
    .from('profiles')
    .select('id, is_active')
    .eq('id', parsed.data.targetUserId)
    .maybeSingle();
  if (targetErr) {
    console.error('[suspendUser] target lookup failed:', targetErr);
    return { ok: false, error: { code: 'server', message: 'No se pudo suspender.' } };
  }
  if (!target) {
    return { ok: false, error: { code: 'not_found', message: 'Usuario no encontrado.' } };
  }
  if (target.is_active === false) {
    return {
      ok: false,
      error: { code: 'no_op', message: 'El usuario ya está suspendido.' },
    };
  }

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ is_active: false })
    .eq('id', parsed.data.targetUserId);
  if (updErr) {
    console.error('[suspendUser] update failed:', updErr);
    return { ok: false, error: { code: 'server', message: 'No se pudo suspender.' } };
  }

  // Revoca todas las sesiones activas del target (decisión R2). Si la
  // llamada falla, dejamos el suspend lógico aplicado y solo logueamos.
  try {
    const admin = createAdminClient();
    const { error: signOutErr } = await admin.auth.admin.signOut(
      parsed.data.targetUserId,
      'global',
    );
    if (signOutErr) {
      console.error('[suspendUser] signOut admin failed:', signOutErr);
    }
  } catch (err) {
    console.error('[suspendUser] admin client unavailable:', err);
  }

  revalidatePath(DIRECTORY_PATH);
  return { ok: true };
}

/**
 * Reactiva un usuario suspendido. Sin side-effect de sesión.
 */
export async function reactivateUser(input: ReactivateUserInput): Promise<ActionResult> {
  const parsed = reactivateUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'invalid', message: 'Datos inválidos.' } };
  }

  const caller = await requireAdminCaller();
  if (!caller.ok) return caller.result;

  if (parsed.data.targetUserId === caller.callerId) {
    // Defensa simétrica: no debería ocurrir (el caller está activo), pero
    // mantiene la simetría con suspendUser / changeRole.
    return {
      ok: false,
      error: { code: 'self_target', message: 'No puedes reactivarte a ti mismo.' },
    };
  }

  const accepted = await requireAcceptedTarget(parsed.data.targetUserId);
  if (!accepted.ok) return accepted.result;

  const supabase = await createClient();

  const { data: target, error: targetErr } = await supabase
    .from('profiles')
    .select('id, is_active')
    .eq('id', parsed.data.targetUserId)
    .maybeSingle();
  if (targetErr) {
    console.error('[reactivateUser] target lookup failed:', targetErr);
    return { ok: false, error: { code: 'server', message: 'No se pudo reactivar.' } };
  }
  if (!target) {
    return { ok: false, error: { code: 'not_found', message: 'Usuario no encontrado.' } };
  }
  if (target.is_active === true) {
    return {
      ok: false,
      error: { code: 'no_op', message: 'El usuario ya está activo.' },
    };
  }

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ is_active: true })
    .eq('id', parsed.data.targetUserId);
  if (updErr) {
    console.error('[reactivateUser] update failed:', updErr);
    return { ok: false, error: { code: 'server', message: 'No se pudo reactivar.' } };
  }

  revalidatePath(DIRECTORY_PATH);
  return { ok: true };
}

interface AdminApiError {
  code?: string;
  status?: number;
  message?: string;
}

function toAdminApiError(err: unknown): AdminApiError {
  if (typeof err !== 'object' || err === null) return {};
  const e = err as Record<string, unknown>;
  return {
    code: typeof e.code === 'string' ? e.code : undefined,
    status: typeof e.status === 'number' ? e.status : undefined,
    message: typeof e.message === 'string' ? e.message : undefined,
  };
}

/**
 * Invita a un nuevo usuario via `auth.admin.inviteUserByEmail` y, si el
 * rol inicial pedido difiere del default `user`, lo fija con un UPDATE
 * inmediato (decisión C1 / Opción A). El trigger `handle_new_user`
 * (mig 0002) crea siempre el profile con `role='user'` ignorando
 * `raw_user_meta_data`.
 *
 * Errores Supabase mapeados a códigos legibles:
 *  - `email_exists` / 422 → `already_exists`
 *  - `invite_already_sent` → `already_invited`
 *  - status 429 → `rate_limited`
 *  - resto → `server`
 */
export async function inviteUser(input: InviteUserInput): Promise<InviteUserResult> {
  const parsed = inviteUserSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? 'Datos inválidos.';
    return { ok: false, error: { code: 'invalid', message: firstIssue } };
  }

  const caller = await requireAdminCaller();
  if (!caller.ok) {
    // requireAdminCaller devuelve ActionResult; lo traducimos al shape
    // específico de invite. `unauthenticated` y `forbidden` están en
    // ambos sets, así que el code es seguro.
    return {
      ok: false,
      error: {
        code: caller.result.error.code as InviteUserErrorCode,
        message: caller.result.error.message,
      },
    };
  }

  const admin = createAdminClient();
  const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: { initial_role: parsed.data.initialRole },
    },
  );

  if (inviteErr) {
    const e = toAdminApiError(inviteErr);
    const code: InviteUserErrorCode =
      e.code === 'email_exists' || e.status === 422
        ? 'already_exists'
        : e.code === 'invite_already_sent'
          ? 'already_invited'
          : e.status === 429
            ? 'rate_limited'
            : 'server';
    const message =
      code === 'already_exists'
        ? 'Este email ya está registrado como usuario.'
        : code === 'already_invited'
          ? 'Ya hay una invitación pendiente para este email.'
          : code === 'rate_limited'
            ? 'Demasiadas invitaciones recientes. Intenta más tarde.'
            : 'No se pudo enviar la invitación.';
    console.error('[inviteUser] inviteUserByEmail failed:', inviteErr);
    return { ok: false, error: { code, message } };
  }

  const newUserId = inviteData?.user?.id;
  if (!newUserId) {
    console.error('[inviteUser] respuesta inesperada:', inviteData);
    return {
      ok: false,
      error: { code: 'server', message: 'Respuesta inesperada del servidor.' },
    };
  }

  // Si el rol pedido NO es 'user', forzamos el UPDATE con service_role.
  // No bloqueamos el flow si falla: el invite ya se envió y el admin puede
  // ajustar manualmente tras aceptación.
  if (parsed.data.initialRole !== 'user') {
    const { error: updErr } = await admin
      .from('profiles')
      .update({ role: parsed.data.initialRole })
      .eq('id', newUserId);
    if (updErr) {
      console.error('[inviteUser] no se pudo fijar initial_role:', updErr);
    }
  }

  revalidatePath(DIRECTORY_PATH);
  return { ok: true, email: parsed.data.email };
}

/**
 * Reenvía la invitación pendiente de un user invocando
 * `auth.admin.inviteUserByEmail` con service_role. Preserva user_id,
 * profile y relaciones (no borra ni recrea el row de auth.users).
 *
 * Guards (en orden):
 *   a) Zod validation.
 *   b) requireAdminCaller.
 *   c) requirePendingTarget (target debe estar pending).
 *
 * Side effect post-éxito:
 *   - UPDATE profiles.last_invited_at = now() para que la UI no muestre
 *     "Reenviar" otra vez por al menos 1h.
 *   - revalidatePath('/admin/users') para que un F5 trivial muestre el
 *     timestamp nuevo.
 *
 * Si el UPDATE de `last_invited_at` falla post-envío, NO revertimos: el
 * email ya está enviado y no podemos des-enviarlo. Logueamos y devolvemos
 * `ok: true` igual (mismo trade-off documentado para `signOut` admin en
 * `suspendUser`).
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
