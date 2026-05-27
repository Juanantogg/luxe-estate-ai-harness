import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Landing del link de confirmación de cambio de email.
 *
 * Supabase, tras confirmar uno de los links de confirmación de cambio
 * de email, redirige al `emailRedirectTo` que pasamos en
 * `auth.updateUser({ email }, { emailRedirectTo })`. La URL tiene la
 * forma `GET /auth/email-change?code=<token>&type=email_change`.
 *
 * Comportamiento "Secure email change" (toggle de Supabase Auth, default
 * ON en Cloud 2024+): cuando un user pide cambiar email, Supabase manda
 * DOS links — uno al email viejo y otro al nuevo — y el cambio aplica
 * SOLO cuando ambos se confirman. Cada link aterriza acá; el primer
 * `exchangeCodeForSession` registra la confirmación pero `auth.users.email`
 * sigue siendo el viejo y `auth.users.new_email` queda con el nuevo
 * pendiente. El segundo link cierra el cambio: `email` pasa a ser el
 * nuevo y `new_email` queda null. Diferenciamos los dos casos con un
 * cast defensivo a `new_email` (el campo NO está tipado en
 * `@supabase/supabase-js`):
 *  - Aún pendiente (`new_email` presente) → flag `pending` → toast
 *    warning "Confirmaste un link. Revisa tu otro correo...".
 *  - Cambio completado → flag `1` → toast success "Correo actualizado".
 *
 * Errores: si Supabase rechaza el token (expirado / ya usado / email
 * tomado entre tanto), redirigimos con `email_changed=error` para que
 * `EmailChangedFlash` muestre el toast warning correspondiente. Los
 * errores que Supabase devuelve por URL fragment (`/#error=...`) NO
 * aterrizan acá — los captura `AuthErrorHashListener` en la home.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');

  if (errorParam || !code) {
    return NextResponse.redirect(`${origin}/profile?tab=settings&email_changed=error`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.warn('[email-change] exchange failed', {
      code: exchangeError.code ?? null,
      status: exchangeError.status ?? null,
    });
    return NextResponse.redirect(`${origin}/profile?tab=settings&email_changed=error`);
  }

  // Determinar si el cambio quedó pendiente del otro lado (modo Secure
  // email change ON) o si ya se completó. `new_email` no está tipado en
  // `@supabase/supabase-js`, así que casteamos defensivamente.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const newEmail = (user as { new_email?: string | null } | null)?.new_email ?? null;
  const stillPending = typeof newEmail === 'string' && newEmail.length > 0;

  const flag = stillPending ? 'pending' : '1';
  return NextResponse.redirect(`${origin}/profile?tab=settings&email_changed=${flag}`);
}
