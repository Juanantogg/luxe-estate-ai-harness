/**
 * Catálogo cerrado de códigos de error de auth.
 *
 * El frontend usa `code` para decidir comportamiento (p. ej.
 * `email_not_confirmed` → ofrecer reenvío) y `message` para mostrar al
 * usuario en español. El `message` se genera server-side a partir del
 * `code`; **nunca** se devuelve el `message` crudo de Supabase para evitar
 * filtrar internals / PII.
 */
export type AuthErrorCode =
  | 'invalid_input'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'email_taken'
  | 'weak_password'
  | 'rate_limited'
  | 'oauth_failed'
  | 'oauth_cancelled'
  | 'reset_token_invalid'
  | 'session_missing'
  | 'network_error'
  | 'unknown';

export interface AuthError {
  code: AuthErrorCode;
  message: string;
}

const MESSAGES: Record<AuthErrorCode, string> = {
  invalid_input: 'Revisa los campos marcados.',
  invalid_credentials: 'Email o contraseña incorrectos.',
  email_not_confirmed: 'Confirma tu correo antes de iniciar sesión. ¿No te llegó? Reenvíalo.',
  email_taken: 'Ya existe una cuenta con ese correo. Inicia sesión.',
  weak_password: 'Contraseña demasiado débil. Usa al menos 8 caracteres con letras y números.',
  rate_limited: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  oauth_failed: 'No pudimos completar el inicio de sesión con Google. Inténtalo de nuevo.',
  oauth_cancelled: 'Cancelaste el inicio de sesión con Google.',
  reset_token_invalid: 'El enlace expiró o ya fue usado. Solicita uno nuevo.',
  session_missing: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  network_error: 'Problema de conexión. Inténtalo de nuevo.',
  unknown: 'Algo salió mal. Inténtalo de nuevo.',
};

/**
 * Mensaje en español neutro asociado a un `AuthErrorCode`. Centralizado
 * aquí para que cualquier capa (Server Actions, Route Handlers, query
 * params en redirects) pueda derivarlo sin duplicar strings.
 */
export function authErrorMessage(code: AuthErrorCode): string {
  return MESSAGES[code] ?? MESSAGES.unknown;
}

/**
 * Construye un `AuthError` listo para retornar. `message` se deriva del
 * código si no se pasa explícitamente.
 */
export function authError(code: AuthErrorCode, message?: string): AuthError {
  return { code, message: message ?? authErrorMessage(code) };
}

interface SupabaseErrorLike {
  code?: string | null;
  status?: number | null;
  name?: string;
  message?: string;
}

/**
 * Mapea un error de Supabase Auth (o cualquier objeto con forma similar)
 * al catálogo cerrado de `AuthErrorCode`. **Nunca** propaga el
 * `err.message` crudo: el mensaje final viene siempre del catálogo.
 *
 * La función inspecciona en orden: `code` (Supabase Auth >= 2.x), `status`
 * HTTP, y como último recurso el `message` (sólo para detectar patrones
 * conocidos, no para reenviarlo).
 */
export function mapSupabaseError(err: unknown): AuthError {
  if (!err) return authError('unknown');

  const e = err as SupabaseErrorLike;
  const code = (e.code ?? '').toLowerCase();
  const status = e.status ?? 0;
  const lowerMsg = (e.message ?? '').toLowerCase();

  if (
    code === 'invalid_credentials' ||
    code === 'invalid_grant' ||
    lowerMsg.includes('invalid login credentials')
  ) {
    return authError('invalid_credentials');
  }
  if (code === 'email_not_confirmed' || lowerMsg.includes('email not confirmed')) {
    return authError('email_not_confirmed');
  }
  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    lowerMsg.includes('already registered') ||
    lowerMsg.includes('user already')
  ) {
    return authError('email_taken');
  }
  if (code === 'weak_password' || lowerMsg.includes('password should be')) {
    return authError('weak_password');
  }
  if (
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    status === 429
  ) {
    return authError('rate_limited');
  }
  if (lowerMsg.includes('network') || lowerMsg.includes('fetch failed')) {
    return authError('network_error');
  }

  // Log server-side para trazabilidad de errores inesperados.
  console.error('[auth] unknown supabase error', { code: e.code, status: e.status });
  return authError('unknown');
}
