import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRedirectPathForRole, safeNextPath } from '@/lib/auth/redirect';

/**
 * Maneja DOS flujos en un solo handler:
 *  - OAuth (Google): `?code=<authcode>&next=<path>`
 *  - Confirmación de email tras signup: `?code=<token>&type=signup&next=<path>`
 *
 * En éxito intercambia el code por sesión, lee `profile.role` y redirige
 * por rol (o respeta `next` si pasa `safeNextPath`).
 *
 * En error redirige a `/login?error=<AuthErrorCode>` para que la pantalla
 * login muestre el mensaje correspondiente.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));
  const errorParam = searchParams.get('error');

  if (errorParam) {
    return NextResponse.redirect(`${origin}/login?error=oauth_cancelled`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=session_missing`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  // Fallback ante una carrera con el trigger handle_new_user: si el row
  // aún no existe, tratamos como rol "user" (el más restrictivo).
  const role = profile?.role ?? 'user';
  const target = next ?? getRedirectPathForRole(role);
  return NextResponse.redirect(`${origin}${target}`);
}
