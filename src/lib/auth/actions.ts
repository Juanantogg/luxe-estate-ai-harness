'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { authError, mapSupabaseError, type AuthError, type AuthErrorCode } from './errors';
import { getRedirectPathForRole, safeNextPath } from './redirect';
import { requestResetSchema, signInSchema, signUpSchema, updatePasswordSchema } from './schemas';
import { getSiteUrl } from './site-url';

/**
 * Tipo de retorno común de las Server Actions de auth.
 *
 * Patrón discriminado por `ok`. Cualquier mensaje al usuario viaja en
 * `error.message` (en español neutro, derivado del catálogo).
 */
export type AuthSuccess<T = void> = { ok: true; data?: T };
export type AuthFailure = { ok: false; error: AuthError };
export type AuthResult<T = void> = AuthSuccess<T> | AuthFailure;

function failure(code: AuthErrorCode, message?: string): AuthFailure {
  return { ok: false, error: message ? { code, message } : authError(code) };
}

function firstZodError(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? 'Revisa los campos marcados.';
}

/**
 * Inicia sesión con email/password. En éxito hace `redirect` (no retorna).
 * En error retorna `AuthFailure` consumible por `useActionState`.
 *
 * Acepta un campo opcional `next` en el FormData (oculto en el form) que,
 * si pasa `safeNextPath`, prevalece sobre la redirección por rol.
 */
export async function signInWithPassword(formData: FormData): Promise<AuthResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return failure('invalid_input', firstZodError(parsed.error));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { ok: false, error: mapSupabaseError(error) };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return failure('session_missing');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role ?? 'user';
  const next = safeNextPath(formData.get('next')?.toString() ?? null);
  const target = next ?? getRedirectPathForRole(role);

  // redirect() lanza NEXT_REDIRECT; no envolver en try/catch.
  redirect(target);
}

/**
 * Registra un nuevo usuario con email/password. Supabase está configurado
 * con verificación de email obligatoria: tras el signUp **no hay sesión
 * activa**. El caller debe redirigir a `/auth/verify-email?email=...`.
 *
 * Retorna `{ ok: true, data: { email } }` para que el caller construya el
 * redirect sin acoplarse al path.
 */
export async function signUpWithPassword(
  formData: FormData,
): Promise<AuthResult<{ email: string }>> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    fullName: formData.get('fullName'),
  });
  if (!parsed.success) {
    return failure('invalid_input', firstZodError(parsed.error));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${getSiteUrl()}/auth/callback?type=signup`,
    },
  });
  if (error) {
    return { ok: false, error: mapSupabaseError(error) };
  }

  // Supabase, con "Confirm signup" activo, devuelve un user pero sin
  // sesión. Si el email ya existía Supabase puede devolver el user con
  // identities=[] — detectamos esa enumeración silenciosa.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { ok: false, error: authError('email_taken') };
  }

  return { ok: true, data: { email: parsed.data.email } };
}

/**
 * Variante de `signUpWithPassword` pensada para `useActionState`: en éxito
 * redirige a `/auth/verify-email?email=...` (no retorna). En error retorna
 * `AuthFailure` para que el componente lo muestre inline.
 *
 * Mantiene `signUpWithPassword` intacto: callers que necesiten el `email`
 * para otro flujo (p.ej. tests) siguen usando la original.
 */
export async function signUpAndRedirect(formData: FormData): Promise<AuthResult> {
  const result = await signUpWithPassword(formData);
  if (!result.ok) {
    return result;
  }

  const email = result.data?.email ?? '';
  redirect(`/auth/verify-email?email=${encodeURIComponent(email)}`);
}

/**
 * Inicia el flujo OAuth con Google. Supabase devuelve la URL de
 * consentimiento; la action hace `redirect()` a esa URL externa.
 *
 * Acepta un campo opcional `next` para preservar el destino post-login.
 */
export async function signInWithGoogle(formData?: FormData): Promise<AuthResult> {
  const supabase = await createClient();
  const rawNext = formData?.get('next')?.toString() ?? null;
  const next = safeNextPath(rawNext);

  const callbackUrl = new URL(`${getSiteUrl()}/auth/callback`);
  if (next) callbackUrl.searchParams.set('next', next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  if (error || !data?.url) {
    return { ok: false, error: error ? mapSupabaseError(error) : authError('oauth_failed') };
  }

  redirect(data.url);
}

/**
 * Cierra la sesión local y redirige a `/login`. Se invoca con
 * `<form action={signOut}>` sin esperar resultado.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/login');
}

/**
 * Solicita un enlace de reset de contraseña al email indicado.
 *
 * Siempre retorna éxito (incluso si el email no existe) para evitar
 * enumeración de cuentas. Sólo el rate limit se expone explícitamente.
 */
export async function requestPasswordReset(formData: FormData): Promise<AuthResult> {
  const parsed = requestResetSchema.safeParse({
    email: formData.get('email'),
  });
  if (!parsed.success) {
    return failure('invalid_input', firstZodError(parsed.error));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/auth/reset`,
  });
  if (error) {
    const mapped = mapSupabaseError(error);
    // Sólo exponemos rate limit; el resto se silencia para no permitir
    // enumeración de cuentas existentes.
    if (mapped.code === 'rate_limited') {
      return { ok: false, error: mapped };
    }
  }

  return { ok: true };
}

/**
 * Actualiza la contraseña del usuario actual. Sólo válido si hay sesión
 * activa (Supabase la crea automáticamente al intercambiar el code del
 * link de reset). En éxito redirige a `/login?reset=ok`.
 */
export async function updatePassword(formData: FormData): Promise<AuthResult> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) {
    return failure('invalid_input', firstZodError(parsed.error));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: authError('reset_token_invalid') };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { ok: false, error: mapSupabaseError(error) };
  }

  redirect('/login?reset=ok');
}

/**
 * Reenvía el email de verificación de signup. Mismo patrón silencioso que
 * `requestPasswordReset`: sólo el rate limit se expone.
 */
export async function resendVerificationEmail(formData: FormData): Promise<AuthResult> {
  const parsed = requestResetSchema.safeParse({
    email: formData.get('email'),
  });
  if (!parsed.success) {
    return failure('invalid_input', firstZodError(parsed.error));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback?type=signup`,
    },
  });
  if (error) {
    const mapped = mapSupabaseError(error);
    if (mapped.code === 'rate_limited') {
      return { ok: false, error: mapped };
    }
  }

  return { ok: true };
}
