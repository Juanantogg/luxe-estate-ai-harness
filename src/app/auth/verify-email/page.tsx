import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { getRedirectPathForRole } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/server';
import { ResendButton } from './ResendButton';

interface PageProps {
  searchParams: Promise<{ email?: string }>;
}

/**
 * Pantalla intermedia post-signup. Indica al usuario que revise su correo
 * y le permite reenviar el email de verificación.
 *
 * Si el user llega aquí ya autenticado (porque confirmó y volvió al link),
 * redirige a su home según rol.
 */
export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const { email } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    redirect(getRedirectPathForRole(profile?.role ?? 'user'));
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <article className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft sm:p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
          <span className="material-icons text-2xl text-primary" aria-hidden="true">
            mark_email_unread
          </span>
        </div>
        <h1 className="mt-6 text-center text-2xl font-bold text-on-surface">Revisa tu correo</h1>
        <p className="mt-3 text-center text-sm text-muted">
          {email ? (
            <>
              Te enviamos un enlace de confirmación a{' '}
              <strong className="text-on-surface">{email}</strong>. Ábrelo para activar tu cuenta.
            </>
          ) : (
            <>Te enviamos un enlace de confirmación a tu correo. Ábrelo para activar tu cuenta.</>
          )}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {email ? <ResendButton email={email} /> : null}
          <Link href="/login" className="w-full">
            <Button variant="ghost" size="lg" fullWidth>
              Volver al inicio de sesión
            </Button>
          </Link>
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          ¿No lo encuentras? Revisa la carpeta de spam o correo no deseado.
        </p>
      </article>
    </main>
  );
}
