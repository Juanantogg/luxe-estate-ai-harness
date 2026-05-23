import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { authErrorMessage, type AuthErrorCode } from '@/lib/auth/errors';
import { safeNextPath } from '@/lib/auth/redirect';
import { AuthForm, type AuthMode } from './AuthForm';
import { SocialAuthButton } from './SocialAuthButton';

interface LoginPageProps {
  searchParams: Promise<{
    mode?: string;
    next?: string;
    error?: string;
    reset?: string;
  }>;
}

const KNOWN_ERROR_CODES: ReadonlySet<AuthErrorCode> = new Set<AuthErrorCode>([
  'invalid_input',
  'invalid_credentials',
  'email_not_confirmed',
  'email_taken',
  'weak_password',
  'rate_limited',
  'oauth_failed',
  'oauth_cancelled',
  'reset_token_invalid',
  'session_missing',
  'network_error',
  'unknown',
]);

function asErrorCode(raw: string | undefined): AuthErrorCode | null {
  if (!raw) return null;
  return KNOWN_ERROR_CODES.has(raw as AuthErrorCode) ? (raw as AuthErrorCode) : null;
}

/**
 * Pantalla `/login`. Renderiza el form de login o signup en función del
 * searchParam `?mode=signup`. Mantiene `/signup` como alias accesible vía
 * `permanentRedirect` desde `(auth)/signup/page.tsx`.
 *
 * Server Component: lee `searchParams` (await en Next 16), valida `next`
 * con `safeNextPath`, renderiza chrome estático (badge, banners) y delega
 * la interactividad al Client `AuthForm`.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const mode: AuthMode = params.mode === 'signup' ? 'signup' : 'login';
  const isSignup = mode === 'signup';
  const next = safeNextPath(params.next ?? null);

  const errorCode = asErrorCode(params.error);
  const errorMessage = errorCode ? authErrorMessage(errorCode) : null;
  const resetSuccess = params.reset === 'ok';

  return (
    <div className="relative flex w-full justify-center px-4 py-10 sm:py-12">
      {/* Decoración: blobs blurred. aria-hidden porque es puramente visual. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-40"
      >
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-hint-green/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <section aria-labelledby="auth-form-title" className="relative z-10 w-full max-w-md">
        <header className="mb-8 text-center sm:mb-10">
          <div
            aria-hidden="true"
            className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-on-primary shadow-soft"
          >
            <Icon name="real_estate_agent" size="xl" />
          </div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-on-surface">
            {isSignup ? 'Crea tu cuenta' : 'Te damos la bienvenida'}
          </h1>
          <p className="text-muted">
            {isSignup
              ? 'Únete para guardar propiedades y agendar visitas.'
              : 'Encuentra y agenda tu próxima propiedad.'}
          </p>
        </header>

        <Card variant="default" padding="lg" className="sm:p-10">
          {resetSuccess && (
            <div
              role="status"
              aria-live="polite"
              className="mb-6 rounded border border-success/20 bg-success-soft px-4 py-3 text-sm text-success"
            >
              Contraseña actualizada. Inicia sesión con tu nueva contraseña.
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-6 rounded border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger"
            >
              {errorMessage}
            </div>
          )}

          <SocialAuthButton provider="google" next={next} />

          <div className="my-6 flex items-center gap-3" role="presentation">
            <span aria-hidden="true" className="h-px flex-1 bg-divider" />
            <span className="text-xs text-muted">o continúa con email</span>
            <span aria-hidden="true" className="h-px flex-1 bg-divider" />
          </div>

          {/* key={mode} fuerza remount del Client Component al togglear
              login↔signup, lo cual reinicia los useActionState y limpia
              errores del modo anterior. */}
          <AuthForm key={mode} initialMode={mode} next={next} />
        </Card>

        <nav
          aria-label="Enlaces legales"
          className="mt-8 flex justify-center gap-6 text-xs text-muted"
        >
          <Link href="/privacy" className="transition-colors hover:text-on-surface">
            Privacidad
          </Link>
          <Link href="/terms" className="transition-colors hover:text-on-surface">
            Términos
          </Link>
          <Link href="/help" className="transition-colors hover:text-on-surface">
            Ayuda
          </Link>
        </nav>
      </section>
    </div>
  );
}
