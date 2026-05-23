import { redirect } from 'next/navigation';
import { SkipLink, TopNav } from '@/components/nav';
import { getSessionAndProfile } from '@/lib/auth/get-session';

/**
 * Layout para pantallas del usuario autenticado (rol `user` y superiores).
 *
 * El middleware ya protege las rutas definidas en `protectedPaths`. Este
 * layout fetcha la sesión para pasarla al `TopNav` y blinda el caso edge
 * de "user sin profile".
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionAndProfile();
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <>
      <SkipLink />
      <TopNav variant="app" session={session} />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
    </>
  );
}
