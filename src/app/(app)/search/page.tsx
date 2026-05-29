import Link from 'next/link';
import { EmptyPropertiesState } from '@/components/home';
import { PropertyCard } from '@/components/property';
import { FiltersModal, FiltersTrigger } from '@/components/search';
import { Icon } from '@/components/ui';
import { getSessionAndProfile } from '@/lib/auth/get-session';
import { type AmenityKey } from '@/lib/properties/amenities';
import { type PropertyForCard, getUserFavoriteIds } from '@/lib/properties/queries';
import { countActiveFilters, parseFilterParams } from '@/lib/search/filter-params';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export const dynamic = 'force-dynamic';

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type ListingType = Database['public']['Enums']['listing_type'];
type PropertyType = Database['public']['Enums']['property_type'];

const SELECT_COLUMNS = `
  id, slug, title, address_line, city, state, country, price, previous_price,
  listing_type, property_type, bedrooms, bathrooms, area_sqm,
  is_featured, is_premium, published_at,
  property_images!inner ( storage_path, alt_text, is_main, position )
`;

interface RawPropertyRow {
  id: string;
  slug: string;
  title: string;
  address_line: string;
  city: string;
  state: string | null;
  country: string | null;
  price: number | string;
  previous_price: number | string | null;
  listing_type: ListingType;
  property_type: PropertyType;
  bedrooms: number;
  bathrooms: number | string;
  area_sqm: number | string | null;
  is_featured: boolean;
  is_premium: boolean;
  published_at: string | null;
  property_images: Array<{
    storage_path: string;
    alt_text: string | null;
    is_main: boolean;
    position: number | null;
  }>;
}

function toPropertyForCard(row: RawPropertyRow): PropertyForCard {
  const mainImage =
    row.property_images.find((img) => img.is_main) ?? row.property_images[0] ?? null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    address_line: row.address_line,
    city: row.city,
    state: row.state,
    country: row.country,
    price: Number(row.price),
    previous_price: row.previous_price == null ? null : Number(row.previous_price),
    listing_type: row.listing_type,
    property_type: row.property_type,
    bedrooms: row.bedrooms,
    bathrooms: Number(row.bathrooms),
    area_sqm: row.area_sqm == null ? null : Number(row.area_sqm),
    is_featured: row.is_featured,
    is_premium: row.is_premium,
    published_at: row.published_at,
    main_image: mainImage
      ? { storage_path: mainImage.storage_path, alt_text: mainImage.alt_text }
      : null,
  };
}

const RESULT_LIMIT = 48;

/**
 * Página de resultados de búsqueda `/search`.
 *
 * Public Server Component. Lee searchParams, parsea filtros con
 * `parseFilterParams`, ejecuta la query a `properties` y renderiza el grid
 * usando `PropertyCard` (mismo patrón que home).
 *
 * Si `?filters=open` está en la URL, monta `<FiltersModal initialOpen />`
 * para soportar deep-link (decisión spec §"Lifecycle del modal").
 *
 * RLS: `properties_select_active_anon` (mig 0013) permite SELECT a anon de
 * propiedades active. `property_amenities` también está abierta a anon
 * (mig 0014), lo que valida la subquery de amenities sin sesión.
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const filters = parseFilterParams(sp);
  const isOpenDeepLink = sp.filters === 'open';
  const activeCount = countActiveFilters(filters);

  const supabase = await createClient();
  const session = await getSessionAndProfile();

  // Subquery amenities OR (decisión humana 2026-05-23).
  let amenityPropertyIds: string[] | null = null;
  if (filters.amenities.length > 0) {
    const { data: amenityRows, error: amenityErr } = await supabase
      .from('property_amenities')
      .select('property_id')
      .in('amenity', filters.amenities as AmenityKey[]);
    if (amenityErr) {
      console.warn('[SearchPage] amenities subquery failed', amenityErr);
      amenityPropertyIds = [];
    } else {
      amenityPropertyIds = Array.from(new Set((amenityRows ?? []).map((r) => r.property_id)));
    }
  }

  let properties: PropertyForCard[] = [];
  // Si tenemos filtro de amenities y la subquery devolvió cero ids, el
  // resultado es vacío sin necesidad de pegar de nuevo a Supabase.
  const willBeEmpty = amenityPropertyIds != null && amenityPropertyIds.length === 0;

  if (!willBeEmpty) {
    let q = supabase
      .from('properties')
      .select(SELECT_COLUMNS)
      .eq('listing_status', 'active')
      .eq('property_images.is_main', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(RESULT_LIMIT);

    if (filters.q) q = q.textSearch('search_vector', filters.q);
    if (filters.location) q = q.ilike('city', `%${filters.location}%`);
    if (filters.minPrice != null) q = q.gte('price', filters.minPrice);
    if (filters.maxPrice != null) q = q.lte('price', filters.maxPrice);
    if (filters.type) q = q.eq('property_type', filters.type);
    if (filters.listing) q = q.eq('listing_type', filters.listing);
    if (filters.bedrooms > 0) q = q.gte('bedrooms', filters.bedrooms);
    if (filters.bathrooms > 0) q = q.gte('bathrooms', filters.bathrooms);
    if (amenityPropertyIds) q = q.in('id', amenityPropertyIds);

    const { data, error } = await q;
    if (error) {
      console.warn('[SearchPage] properties query failed', error);
    } else {
      properties = (data ?? []).map((row) => toPropertyForCard(row as unknown as RawPropertyRow));
    }
  }

  const favoriteIds = session?.user
    ? await getUserFavoriteIds(
        supabase,
        session.user.id,
        properties.map((p) => p.id),
      )
    : new Set<string>();

  const isAuthenticated = Boolean(session?.user);
  const hasFilters = activeCount > 0 || Boolean(filters.q) || Boolean(filters.listing);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <section className="py-8 md:py-12">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-light text-on-surface md:text-4xl">Resultados</h1>
            <p className="mt-2 text-sm text-muted">
              {filters.q ? (
                <>
                  Buscando:{' '}
                  <span className="font-medium text-on-surface">&ldquo;{filters.q}&rdquo;</span>{' '}
                  ·{' '}
                </>
              ) : null}
              {properties.length === 0
                ? 'Sin coincidencias'
                : properties.length === 1
                  ? '1 propiedad'
                  : `${properties.length} propiedades`}
              {properties.length === RESULT_LIMIT && ' (mostrando los primeros 48)'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary hover:opacity-70 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <Icon name="arrow_back" size="sm" />
              Volver
            </Link>
            <FiltersTrigger />
          </div>
        </div>
      </section>

      {properties.length === 0 ? (
        <EmptyPropertiesState hasFilters={hasFilters} />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              variant="compact"
              isFavorite={favoriteIds.has(property.id)}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </div>
      )}

      {isOpenDeepLink && <FiltersModal initialOpen />}
    </div>
  );
}
