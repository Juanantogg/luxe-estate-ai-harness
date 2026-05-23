import { redirect } from 'next/navigation';
import { SkipLink, TopNav } from '@/components/nav';
import { getSessionAndProfile } from '@/lib/auth/get-session';

const DASHBOARD_ROLES = new Set(['agent', 'broker', 'admin']);

/**
 * Layout para el dashboard de agente/broker/admin. Guarda la sesión y el
 * rol antes de renderizar; usuarios con rol distinto a {agent, broker,
 * admin} son redirigidos a `/`.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionAndProfile();
  if (!session?.user) {
    redirect('/login?next=/dashboard');
  }

  const role = session.profile?.role ?? 'user';
  if (!DASHBOARD_ROLES.has(role)) {
    redirect('/');
  }

  return (
    <>
      <SkipLink />
      <TopNav variant="dashboard" session={session} />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
    </>
  );
}
