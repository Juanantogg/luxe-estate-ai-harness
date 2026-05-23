import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Queries server-side de propiedades. Funciones puras (reciben el cliente)
 * para que sean fáciles de componer desde page.tsx sin acoplarse al request.
 */

type SupabaseDb = SupabaseClient<Database>;

export type PropertyType = Database['public']['Enums']['property_type'];
export type ListingType = Database['public']['Enums']['listing_type'];

/**
 * Tipo aplanado que consumen las cards. `main_image` se resuelve haciendo
 * inner join contra `property_images` filtrando por `is_main = true`.
 */
export interface PropertyForCard {
  id: string;
  title: string;
  address_line: string;
  city: string;
  state: string | null;
  country: string | null;
  price: number;
  previous_price: number | null;
  listing_type: ListingType;
  property_type: PropertyType;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number | null;
  is_featured: boolean;
  is_premium: boolean;
  published_at: string | null;
  main_image: { storage_path: string; alt_text: string | null } | null;
}

const SELECT_COLUMNS = `
  id, title, address_line, city, state, country, price, previous_price,
  listing_type, property_type, bedrooms, bathrooms, area_sqm,
  is_featured, is_premium, published_at,
  property_images!inner ( storage_path, alt_text, is_main, position )
`;

interface RawPropertyRow {
  id: string;
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

/**
 * Trae hasta 2 propiedades destacadas (curaduría editorial). Inner join contra
 * `property_images` con `is_main = true` para garantizar que toda card tenga
 * imagen. Si no hay featured devuelve `[]` y el caller esconde la sección.
 */
export async function getFeaturedProperties(supabase: SupabaseDb): Promise<PropertyForCard[]> {
  const { data, error } = await supabase
    .from('properties')
    .select(SELECT_COLUMNS)
    .eq('listing_status', 'active')
    .eq('is_featured', true)
    .eq('property_images.is_main', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(2);

  if (error) throw error;
  return (data ?? []).map((row) => toPropertyForCard(row as unknown as RawPropertyRow));
}

export interface NewInMarketOptions {
  listingType?: ListingType;
  propertyType?: string;
  limit: number;
  /**
   * Si la ventana de "últimos 30 días" devuelve cero items y NO se aplicaron
   * filtros, repite la query sin la cota temporal para no mostrar empty state
   * cuando el seed esté seedeado (decisión § 14 R5).
   */
  includeOlderIfEmpty?: boolean;
}

export interface NewInMarketResult {
  items: PropertyForCard[];
  hasMore: boolean;
  fellBackToOlder: boolean;
}

const NEW_WINDOW_DAYS = 30;

/**
 * Trae el bloque "Nuevas en el mercado": propiedades activas publicadas en los
 * últimos 30 días, filtradas opcionalmente por listing_type y property_type.
 * Pide `limit + 1` para detectar `hasMore` sin contar.
 */
export async function getNewInMarketProperties(
  supabase: SupabaseDb,
  opts: NewInMarketOptions,
): Promise<NewInMarketResult> {
  const since = new Date(Date.now() - NEW_WINDOW_DAYS * 86_400_000).toISOString();
  const filtersApplied =
    Boolean(opts.listingType) || (opts.propertyType ? opts.propertyType !== 'all' : false);

  const fetchPage = async (useWindow: boolean) => {
    let q = supabase
      .from('properties')
      .select(SELECT_COLUMNS)
      .eq('listing_status', 'active')
      .eq('property_images.is_main', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(opts.limit + 1);

    if (useWindow) q = q.gte('published_at', since);
    if (opts.listingType) q = q.eq('listing_type', opts.listingType);
    if (opts.propertyType && opts.propertyType !== 'all') {
      q = q.eq('property_type', opts.propertyType as PropertyType);
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((row) => toPropertyForCard(row as unknown as RawPropertyRow));
  };

  let rows = await fetchPage(true);
  let fellBackToOlder = false;

  if (rows.length === 0 && opts.includeOlderIfEmpty && !filtersApplied) {
    rows = await fetchPage(false);
    fellBackToOlder = rows.length > 0;
  }

  return {
    items: rows.slice(0, opts.limit),
    hasMore: rows.length > opts.limit,
    fellBackToOlder,
  };
}

/**
 * Devuelve el set de IDs de propiedades que el usuario tiene favoriteadas
 * dentro del subconjunto que se pasa. Una sola query con `IN (...)` para
 * evitar N+1. Devuelve set vacío si no hay user o no hay propiedades.
 */
export async function getUserFavoriteIds(
  supabase: SupabaseDb,
  userId: string,
  propertyIds: string[],
): Promise<Set<string>> {
  if (propertyIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('favorites')
    .select('property_id')
    .eq('user_id', userId)
    .in('property_id', propertyIds);
  if (error) {
    console.warn('[getUserFavoriteIds] favorites query failed', error);
    return new Set();
  }
  return new Set((data ?? []).map((row) => row.property_id));
}
