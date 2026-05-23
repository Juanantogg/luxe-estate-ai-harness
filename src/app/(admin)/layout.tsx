import { notFound, redirect } from 'next/navigation';
import { SkipLink, TopNav } from '@/components/nav';
import { getSessionAndProfile } from '@/lib/auth/get-session';

/**
 * Layout exclusivo del shell `(admin)`. Cualquier rol distinto a `admin`
 * recibe 404 — alineado con la regla de la feature `admin_user_directory`:
 * "no anunciar la existencia de rutas administrativas".
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionAndProfile();
  if (!session?.user) {
    redirect('/login?next=/admin');
  }

  const role = session.profile?.role ?? 'user';
  if (role !== 'admin') {
    notFound();
  }

  return (
    <>
      <SkipLink />
      <TopNav variant="admin" session={session} />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
    </>
  );
}
