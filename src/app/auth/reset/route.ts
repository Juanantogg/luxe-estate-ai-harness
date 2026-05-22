import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Landing del link de reset password.
 *
 * Recibe `?code=<recovery-token>`, hace `exchangeCodeForSession` para que
 * Supabase setee las cookies de recovery, y redirige al form
 * `/auth/reset/new`. En caso de fallo redirige a `/login?error=reset_token_invalid`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=reset_token_invalid`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=reset_token_invalid`);
  }

  return NextResponse.redirect(`${origin}/auth/reset/new`);
}
