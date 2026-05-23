import { redirect } from 'next/navigation';
import { getRedirectPathForRole } from '@/lib/auth/redirect';
import { getSessionAndProfile } from '@/lib/auth/get-session';

/**
 * Layout para las pantallas de autenticación (login, signup, reset).
 *
 * - Sin TopNav.
 * - Si ya hay sesión activa, redirige al home del rol para evitar volver a login.
 * - La decoración visual (blobs, cards) la pone cada página dentro de `{children}`.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionAndProfile();
  if (session?.user) {
    redirect(getRedirectPathForRole(session.profile?.role ?? 'user'));
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen flex-1 items-center justify-center bg-background"
    >
      {children}
    </main>
  );
}
