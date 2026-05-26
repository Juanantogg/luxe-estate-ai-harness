import { redirect } from 'next/navigation';
import { PropertyForm } from '@/components/property-form';
import { getSessionAndProfile } from '@/lib/auth/get-session';

export const dynamic = 'force-dynamic';

const ROLES_ALLOWED = new Set(['agent', 'broker', 'admin']);

/**
 * `/dashboard/properties/new` — formulario de creación de propiedad.
 *
 * Defense-in-depth: el `(dashboard)/layout.tsx` ya valida sesión + rol,
 * pero re-chequeamos acá por si la ruta se monta directo. La redirección
 * va a `/login?next=/dashboard/properties/new` para que el OAuth callback
 * vuelva al form.
 */
export default async function NewPropertyPage() {
  const session = await getSessionAndProfile();
  if (!session?.user) {
    redirect('/login?next=/dashboard/properties/new');
  }
  const role = session.profile?.role ?? 'user';
  if (!ROLES_ALLOWED.has(role)) {
    redirect('/');
  }

  return <PropertyForm mode="create" initial={null} ownerId={session.user.id} />;
}
