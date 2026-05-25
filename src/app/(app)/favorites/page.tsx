import { redirect } from 'next/navigation';
import { PropertyCard } from '@/components/property';
import {
  DiscoverMoreCard,
  FavoritesEmptyState,
  FavoritesSortDropdown,
  FavoritesViewToggle,
  type FavoritesSortValue,
  type FavoritesViewValue,
} from '@/components/favorites';
import { getSessionAndProfile } from '@/lib/auth/get-session';
import { getUserFavorites } from '@/lib/properties/queries';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils/cn';

const VALID_SORTS: ReadonlyArray<FavoritesSortValue> = ['date_desc', 'price_asc', 'price_desc'];

interface FavoritesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseSort(raw: string | string[] | undefined): FavoritesSortValue {
  if (typeof raw !== 'string') return 'date_desc';
  return (VALID_SORTS as readonly string[]).includes(raw)
    ? (raw as FavoritesSortValue)
    : 'date_desc';
}

function parseView(raw: string | string[] | undefined): FavoritesViewValue {
  return raw === 'list' ? 'list' : 'grid';
}

function formatCountLabel(n: number): string {
  if (n === 0) return 'Aún no guardaste ninguna propiedad.';
  if (n === 1) return 'Tienes 1 propiedad guardada.';
  return `Tienes ${n} propiedades guardadas.`;
}

/**
 * Lista de propiedades favoriteadas por el user actual. Server Component:
 * fetch de favoritos con join a properties + main image, sort server-side.
 *
 * La ruta `/favorites` está protegida por middleware (`proxy.ts`
 * `protectedPaths`). Aún así, hacemos un guard defensivo: si la sesión
 * desapareció entre middleware y render (race condition de cookies, logout
 * en otra pestaña), redirigimos a `/login`.
 */
export default async function FavoritesPage({ searchParams }: FavoritesPageProps) {
  const sp = await searchParams;
  const sort = parseSort(sp.sort);
  const view = parseView(sp.view);

  const session = await getSessionAndProfile();
  if (!session?.user) {
    redirect(`/login?next=${encodeURIComponent('/favorites')}`);
  }

  const supabase = await createClient();
  const properties = await getUserFavorites(supabase, session.user.id, sort);

  const count = properties.length;
  const isEmpty = count === 0;

  const gridClassName =
    view === 'list'
      ? 'grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8'
      : 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8 xl:grid-cols-4';

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <section aria-labelledby="favorites-heading" className="py-8 md:py-12">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 id="favorites-heading" className="text-3xl font-light text-on-surface md:text-4xl">
              Tus favoritos
            </h1>
            <p className="mt-1 text-sm text-muted">{formatCountLabel(count)}</p>
          </div>
          {!isEmpty && (
            <div
              role="toolbar"
              aria-label="Ordenar y vista"
              className="flex flex-wrap items-center gap-3"
            >
              <FavoritesSortDropdown current={sort} />
              <FavoritesViewToggle current={view} />
            </div>
          )}
        </header>
      </section>

      {isEmpty ? (
        <FavoritesEmptyState reason="never_favorited" />
      ) : (
        <section aria-label="Propiedades guardadas">
          <ul className={cn('list-none p-0', gridClassName)}>
            {properties.map((property) => (
              <li key={property.id}>
                <PropertyCard
                  property={property}
                  variant="compact"
                  orientation={view === 'list' ? 'horizontal' : 'vertical'}
                  isFavorite
                  isAuthenticated
                  showBookingCTA
                />
              </li>
            ))}
            <li>
              <DiscoverMoreCard />
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}
