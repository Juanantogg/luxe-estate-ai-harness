import Link from 'next/link';
import { PropertyCard } from '@/components/property';
import { ListingTypeToggle } from '@/components/property';
import {
  EmptyPropertiesState,
  HeroSearch,
  LoadMoreLink,
  PropertyTypeChips,
} from '@/components/home';
import { Icon } from '@/components/ui';
import { getSessionAndProfile } from '@/lib/auth/get-session';
import {
  getFeaturedProperties,
  getNewInMarketProperties,
  getUserFavoriteIds,
  type ListingType,
} from '@/lib/properties/queries';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils/cn';

const LIMIT_MIN = 8;
const LIMIT_MAX = 48;
const LIMIT_DEFAULT = 8;
const VALID_PROPERTY_TYPES = new Set([
  'all',
  'house',
  'apartment',
  'villa',
  'penthouse',
  'condo',
  'townhouse',
  'commercial',
]);

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Home pública `/`. Tres secciones: Hero, Featured Collections y New in Market.
 * Server Component: ejecuta las dos queries en paralelo y, si hay sesión,
 * pide los IDs de favoritos del user para hidratar cada PropertyCard.
 *
 * Anónimo (sin sesión): el TopNav muestra CTAs login/signup, las cards no
 * pierden funcionalidad pero el heart redirige a /login?next=/. La política
 * `properties_select_active_anon` (migración 0013) permite el SELECT.
 */
export default async function HomePage({ searchParams }: HomePageProps) {
  const sp = await searchParams;

  const rawType = typeof sp.type === 'string' ? sp.type : 'all';
  const propertyType = VALID_PROPERTY_TYPES.has(rawType) ? rawType : 'all';

  const listingType: ListingType | undefined =
    sp.listing === 'rent' ? 'rent' : sp.listing === 'sale' ? 'sale' : undefined;

  const rawLimit = parseInt(String(sp.limit ?? ''), 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, LIMIT_MIN), LIMIT_MAX)
    : LIMIT_DEFAULT;

  const supabase = await createClient();
  const session = await getSessionAndProfile();

  const [featured, newInMarket] = await Promise.all([
    getFeaturedProperties(supabase),
    getNewInMarketProperties(supabase, {
      listingType,
      propertyType,
      limit,
      includeOlderIfEmpty: true,
    }),
  ]);

  const allIds = [...featured.map((p) => p.id), ...newInMarket.items.map((p) => p.id)];
  const favoriteIds = session?.user
    ? await getUserFavoriteIds(supabase, session.user.id, allIds)
    : new Set<string>();

  const isAuthenticated = Boolean(session?.user);
  const hasFilters = propertyType !== 'all' || Boolean(listingType);

  // searchParams como URLSearchParams para construir hrefs en hijos.
  const preserveParams = new URLSearchParams();
  if (propertyType !== 'all') preserveParams.set('type', propertyType);
  if (listingType) preserveParams.set('listing', listingType);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      {/* Hero ------------------------------------------------------------- */}
      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-3xl space-y-8 text-center">
          <h1 className="text-4xl leading-tight font-light text-on-surface md:text-5xl lg:text-6xl">
            Encuentra tu{' '}
            <span className="relative inline-block font-medium">
              refugio
              <span
                className="absolute bottom-2 left-0 -z-0 h-3 w-full -rotate-1 bg-primary/20"
                aria-hidden
              />
            </span>
            .
          </h1>

          <HeroSearch />

          <PropertyTypeChips current={propertyType} preserveParams={preserveParams} />
        </div>
      </section>

      {/* Featured Collections -------------------------------------------- */}
      {featured.length > 0 && (
        <section className="mb-16" aria-labelledby="featured-heading">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 id="featured-heading" className="text-2xl font-light text-on-surface">
                Colecciones destacadas
              </h2>
              <p className="mt-1 text-sm text-muted">Propiedades curadas para el ojo exigente.</p>
            </div>
            <Link
              href="/search?featured=true"
              className={cn(
                'hidden items-center gap-1 rounded text-sm font-medium text-primary transition-opacity hover:opacity-70 sm:flex',
                'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
              )}
            >
              Ver todas <Icon name="arrow_forward" size="sm" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {featured.map((property, index) => (
              <PropertyCard
                key={property.id}
                property={property}
                variant="featured"
                isFavorite={favoriteIds.has(property.id)}
                isAuthenticated={isAuthenticated}
                priority={index < 2}
              />
            ))}
          </div>
        </section>
      )}

      {/* New in Market --------------------------------------------------- */}
      <section id="new-in-market" aria-labelledby="new-in-market-heading">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 id="new-in-market-heading" className="text-2xl font-light text-on-surface">
              Nuevas en el mercado
            </h2>
            <p className="mt-1 text-sm text-muted">Oportunidades frescas agregadas esta semana.</p>
          </div>
          <div className="hidden md:block">
            <ListingTypeToggle />
          </div>
        </div>

        {/* Toggle en mobile, justo bajo el header */}
        <div className="mb-4 flex md:hidden">
          <ListingTypeToggle />
        </div>

        {newInMarket.items.length === 0 ? (
          <EmptyPropertiesState hasFilters={hasFilters} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {newInMarket.items.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  variant="compact"
                  isFavorite={favoriteIds.has(property.id)}
                  isAuthenticated={isAuthenticated}
                />
              ))}
            </div>

            {newInMarket.hasMore && (
              <div className="mt-12 text-center">
                <LoadMoreLink currentParams={preserveParams} currentLimit={limit} />
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
