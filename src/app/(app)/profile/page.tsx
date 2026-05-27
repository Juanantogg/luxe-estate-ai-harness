import { redirect } from 'next/navigation';
import { FavoritesEmptyState } from '@/components/favorites';
import {
  EmailChangedFlash,
  ProfileHeader,
  ProfileTabs,
  SettingsPanel,
  VisitsList,
  parseProfileTab,
  type EmailChangedKind,
  type ProfileTab,
} from '@/components/profile';
import { PropertyCard } from '@/components/property';
import { getSessionAndProfile } from '@/lib/auth/get-session';
import {
  getProfileStats,
  getUserVisits,
  type ProfileStats,
  type VisitsBuckets,
} from '@/lib/profile/queries';
import { getUserFavorites, type PropertyForCard } from '@/lib/properties/queries';
import { createClient } from '@/lib/supabase/server';

const TABS: ReadonlyArray<ProfileTab> = [
  { value: 'saved', label: 'Propiedades guardadas' },
  { value: 'visits', label: 'Visitas programadas' },
  { value: 'settings', label: 'Preferencias y ajustes' },
];

interface ProfilePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Pantalla de perfil del usuario (`/profile`, privada). Server Component que
 * orquesta el header + tabs y solo fetchea los datos del tab activo para
 * minimizar round-trips entre navegaciones (el header viaja siempre porque
 * incluye los stats — el costo es ínfimo, son 2-3 HEAD counts).
 *
 * La ruta está protegida por middleware (`proxy.ts` `protectedPaths`). Aún
 * así hacemos un guard defensivo: si la sesión desapareció entre middleware
 * y render (race condition), redirigimos a `/login?next=/profile`.
 *
 * Defensa adicional: si el user tiene sesión pero NO tiene profile (caso
 * edge: el trigger de profile falló al signup), mostramos un fallback
 * minimal en vez de crashear — la mayor parte de la pantalla depende del
 * profile (role, city, member_since).
 */
export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const sp = await searchParams;
  const tab = parseProfileTab(sp.tab);
  const emailChangedKind = parseEmailChangedFlag(sp.email_changed);

  const session = await getSessionAndProfile();
  if (!session?.user) {
    redirect(`/login?next=${encodeURIComponent('/profile')}`);
  }
  const { user, profile } = session;

  // Detección OAuth-only: si el user no tiene identity con provider
  // `email`, no tiene password y por lo tanto no puede re-autenticarse
  // para cambiar el correo. La feature `change_email_flow` deshabilita
  // el botón "Cambiar" en este caso (defense-in-depth: la action
  // también rechaza con `oauth_only`).
  const canChangeEmail = user.identities?.some((i) => i.provider === 'email') ?? false;

  if (!profile) {
    // Caso edge: el trigger handle_new_user no creó el profile. No queremos
    // ocultar nada — pintamos un shell mínimo con un mensaje accionable.
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-on-surface">Tu perfil</h1>
        <p className="mt-2 text-sm text-muted">
          No pudimos cargar tu perfil. Cerrá sesión e ingresá nuevamente; si el problema persiste,
          contactá soporte.
        </p>
      </div>
    );
  }

  const supabase = await createClient();

  // Stats siempre se piden (alimentan el header).
  const statsPromise = getProfileStats(supabase, user.id, profile.role);

  // Solo cargamos datos del tab activo para no malgastar queries.
  const favoritesPromise: Promise<PropertyForCard[]> =
    tab === 'saved' ? getUserFavorites(supabase, user.id, 'date_desc') : Promise.resolve([]);

  const visitsPromise: Promise<VisitsBuckets> =
    tab === 'visits'
      ? getUserVisits(supabase, user.id)
      : Promise.resolve({ upcoming: [], past: [] } as VisitsBuckets);

  const [stats, favorites, visits]: [ProfileStats, PropertyForCard[], VisitsBuckets] =
    await Promise.all([statsPromise, favoritesPromise, visitsPromise]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <section className="py-8 md:py-12">
        <ProfileHeader
          profile={{
            full_name: profile.full_name,
            email: profile.email,
            avatar_url: profile.avatar_url,
            city: profile.city,
            member_since: profile.member_since,
            role: profile.role,
          }}
          stats={stats}
        />

        <ProfileTabs tabs={TABS} />

        {tab === 'saved' && <SavedPanel favorites={favorites} />}
        {tab === 'visits' && <VisitsList buckets={visits} />}
        {tab === 'settings' && (
          <SettingsPanel email={profile.email} canChangeEmail={canChangeEmail} />
        )}
      </section>

      {tab === 'settings' && <EmailChangedFlash kind={emailChangedKind} />}
    </div>
  );
}

/**
 * Parsea estrictamente `searchParams.email_changed`. Cualquier valor
 * fuera de los tres flags conocidos (`1` / `pending` / `error`) devuelve
 * `null` para evitar que un query param manipulado dispare el toast.
 */
function parseEmailChangedFlag(raw: string | string[] | undefined): EmailChangedKind {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === '1') return 'success';
  if (value === 'pending') return 'pending';
  if (value === 'error') return 'error';
  return null;
}

function SavedPanel({ favorites }: { favorites: PropertyForCard[] }) {
  if (favorites.length === 0) {
    return <FavoritesEmptyState reason="never_favorited" />;
  }

  return (
    <section aria-label="Propiedades guardadas">
      <ul className="grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8 xl:grid-cols-4">
        {favorites.map((property) => (
          <li key={property.id}>
            <PropertyCard
              property={property}
              variant="compact"
              orientation="vertical"
              isFavorite
              isAuthenticated
              showBookingCTA
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
