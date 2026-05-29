import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { AmenityKey } from './amenities';

/**
 * Queries server-side de propiedades. Funciones puras (reciben el cliente)
 * para que sean fáciles de componer desde page.tsx sin acoplarse al request.
 */

type SupabaseDb = SupabaseClient<Database>;

export type PropertyType = Database['public']['Enums']['property_type'];
export type ListingType = Database['public']['Enums']['listing_type'];
export type ListingStatus = Database['public']['Enums']['listing_status'];
export type UserRole = Database['public']['Enums']['user_role'];

/**
 * Tipo aplanado que consumen las cards. `main_image` se resuelve haciendo
 * inner join contra `property_images` filtrando por `is_main = true`.
 */
export interface PropertyForCard {
  id: string;
  slug: string;
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

    // Excluir destacadas SIEMPRE: la sección "Nuevas en el mercado" tiene
    // contrato semántico complementario a "Colecciones destacadas". Sin este
    // filtro, las featured se duplicarían en ambas secciones de la home.
    q = q.eq('is_featured', false);

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

export type FavoritesSort = 'date_desc' | 'price_asc' | 'price_desc';

/**
 * Lista de favoritos del usuario (con datos de propiedad y main image)
 * lista para alimentar `PropertyCard`. Filtra a sólo propiedades `active`
 * para no mostrar fantasmas pausadas o eliminadas.
 *
 * El sort se aplica server-side via `.order(...)`:
 * - `date_desc` → favoritos más recientes primero (default).
 * - `price_asc` / `price_desc` → orden por precio de la propiedad.
 *
 * Devuelve `[]` si el usuario no tiene favoritos o si la query falla
 * (loggea la causa). El caller distingue empty vs error según corresponda
 * en la UI; en este MVP tratamos el error como empty con copy especial.
 */
export async function getUserFavorites(
  supabase: SupabaseDb,
  userId: string,
  sort: FavoritesSort = 'date_desc',
): Promise<PropertyForCard[]> {
  let q = supabase
    .from('favorites')
    .select(
      `
      created_at,
      properties!inner (
        id, slug, title, address_line, city, state, country, price, previous_price,
        listing_type, property_type, bedrooms, bathrooms, area_sqm,
        is_featured, is_premium, published_at, listing_status,
        property_images!inner ( storage_path, alt_text, is_main, position )
      )
    `,
    )
    .eq('user_id', userId)
    .eq('properties.listing_status', 'active')
    .eq('properties.property_images.is_main', true);

  if (sort === 'date_desc') {
    q = q.order('created_at', { ascending: false });
  } else if (sort === 'price_asc') {
    q = q.order('price', { ascending: true, referencedTable: 'properties' });
  } else {
    q = q.order('price', { ascending: false, referencedTable: 'properties' });
  }

  const { data, error } = await q;
  if (error) {
    console.warn('[getUserFavorites] query failed', error);
    return [];
  }

  // El embed devuelve `properties` como objeto (relación N→1). PostgREST a
  // veces lo tipa como array según la versión del schema cache; aceptamos
  // ambas formas para robustez.
  type FavoriteRow = {
    created_at: string;
    properties: RawPropertyRow | RawPropertyRow[] | null;
  };

  return (data as unknown as FavoriteRow[])
    .map((row) => {
      const property = Array.isArray(row.properties) ? row.properties[0] : row.properties;
      return property ? toPropertyForCard(property) : null;
    })
    .filter((p): p is PropertyForCard => p !== null);
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

// ============================================================
// Detalle de propiedad
// ============================================================

export interface OwnerPublicProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  city: string | null;
}

export interface OwnerProfileFull extends OwnerPublicProfile {
  email: string | null;
  phone: string | null;
}

export interface PropertyDetailImage {
  id: string;
  storage_path: string;
  alt_text: string | null;
  is_main: boolean;
  position: number;
}

export interface PropertyForDetail {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  price: number;
  previous_price: number | null;
  listing_type: ListingType;
  listing_status: ListingStatus;
  property_type: PropertyType;
  address_line: string;
  city: string;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number | null;
  parking_spaces: number | null;
  year_built: number | null;
  is_featured: boolean;
  is_premium: boolean;
  published_at: string | null;
  owner_id: string;
  /** Zona horaria IANA de la propiedad (default `America/Mexico_City`). */
  timezone: string;
  images: PropertyDetailImage[];
  amenities: AmenityKey[];
  owner: OwnerProfileFull | null;
}

/**
 * Helper público para hidratar un perfil de agente desde un contexto
 * potencialmente anónimo.
 *
 * Devuelve únicamente columnas seguras de mostrar a `anon`
 * (id, full_name, avatar_url, role, city). Email y phone NUNCA viajan por
 * esta vía para minimizar el riesgo de filtrado accidental si alguien
 * futuro hace `.select('*')` en una ruta pública.
 *
 * Es la única vía permitida para leer `profiles` desde Server Components
 * o queries que puedan ejecutarse sin sesión. En contextos autenticados
 * donde se requieren email/phone, la query debe declarar las columnas
 * explícitamente y confiar en RLS para gatear.
 */
export async function getOwnerPublicProfile(
  supabase: SupabaseDb,
  ownerId: string,
): Promise<OwnerPublicProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, city')
    .eq('id', ownerId)
    .maybeSingle();
  if (error) {
    console.warn('[getOwnerPublicProfile] profile query failed', error);
    return null;
  }
  return data ?? null;
}

interface RawDetailRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  price: number | string;
  previous_price: number | string | null;
  listing_type: ListingType;
  listing_status: ListingStatus;
  property_type: PropertyType;
  address_line: string;
  city: string;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  bedrooms: number;
  bathrooms: number | string;
  area_sqm: number | string | null;
  parking_spaces: number | null;
  year_built: number | null;
  is_featured: boolean;
  is_premium: boolean;
  published_at: string | null;
  owner_id: string;
  timezone: string | null;
  property_images: Array<{
    id: string;
    storage_path: string;
    alt_text: string | null;
    is_main: boolean;
    position: number | null;
  }>;
  property_amenities: Array<{ amenity: AmenityKey }>;
}

const DETAIL_SELECT_AUTHED = `
  id, slug, title, description, price, previous_price,
  listing_type, listing_status, property_type,
  address_line, city, state, country, postal_code,
  latitude, longitude,
  bedrooms, bathrooms, area_sqm, parking_spaces, year_built,
  is_featured, is_premium, published_at, owner_id, timezone,
  property_images ( id, storage_path, alt_text, is_main, position ),
  property_amenities ( amenity ),
  owner:profiles!properties_owner_id_fkey (
    id, full_name, avatar_url, email, phone, role, city
  )
`;

const DETAIL_SELECT_ANON = `
  id, slug, title, description, price, previous_price,
  listing_type, listing_status, property_type,
  address_line, city, state, country, postal_code,
  latitude, longitude,
  bedrooms, bathrooms, area_sqm, parking_spaces, year_built,
  is_featured, is_premium, published_at, owner_id, timezone,
  property_images ( id, storage_path, alt_text, is_main, position ),
  property_amenities ( amenity )
`;

function toPropertyDetail(row: RawDetailRow, owner: OwnerProfileFull | null): PropertyForDetail {
  const images = [...row.property_images]
    .map((img) => ({
      id: img.id,
      storage_path: img.storage_path,
      alt_text: img.alt_text,
      is_main: img.is_main,
      position: img.position ?? 0,
    }))
    .sort((a, b) => {
      if (a.is_main !== b.is_main) return a.is_main ? -1 : 1;
      return a.position - b.position;
    });

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    price: Number(row.price),
    previous_price: row.previous_price == null ? null : Number(row.previous_price),
    listing_type: row.listing_type,
    listing_status: row.listing_status,
    property_type: row.property_type,
    address_line: row.address_line,
    city: row.city,
    state: row.state,
    country: row.country,
    postal_code: row.postal_code,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    bedrooms: row.bedrooms,
    bathrooms: Number(row.bathrooms),
    area_sqm: row.area_sqm == null ? null : Number(row.area_sqm),
    parking_spaces: row.parking_spaces,
    year_built: row.year_built,
    is_featured: row.is_featured,
    is_premium: row.is_premium,
    published_at: row.published_at,
    owner_id: row.owner_id,
    timezone: row.timezone ?? 'America/Mexico_City',
    images,
    amenities: row.property_amenities.map((a) => a.amenity),
    owner,
  };
}

/**
 * Lookup polimórfico para `getPropertyDetail`:
 * - `{ slug }` → query pública por slug (uso normal del page público).
 * - `{ id }`   → query por UUID (usado por el redirect 308 UUID→slug y
 *   por contextos server-internos que ya conocen el ID).
 *
 * Exclusivos via discriminated union para que TypeScript exija exactamente
 * una clave.
 */
export type PropertyLookup = { id: string } | { slug: string };

/**
 * Carga el detalle completo de una propiedad (joins con images, amenities y
 * owner profile). Devuelve `null` si RLS la oculta o no existe; el caller
 * decide entre `notFound()` o redirect.
 *
 * Estrategia según `isAuthenticated`:
 * - Autenticado → query con join completo a profiles (incluye email/phone);
 *   RLS protege el acceso a esas columnas.
 * - Anónimo     → query SIN profile, y el perfil se hidrata por separado
 *   vía `getOwnerPublicProfile` (solo columnas seguras).
 *
 * Esta separación previene que un `.select('*')` futuro filtre email/phone
 * en contextos públicos.
 */
export async function getPropertyDetail(
  supabase: SupabaseDb,
  lookup: PropertyLookup,
  opts: { isAuthenticated: boolean } = { isAuthenticated: false },
): Promise<PropertyForDetail | null> {
  const select = opts.isAuthenticated ? DETAIL_SELECT_AUTHED : DETAIL_SELECT_ANON;
  let query = supabase.from('properties').select(select);
  query = 'slug' in lookup ? query.eq('slug', lookup.slug) : query.eq('id', lookup.id);
  const { data, error } = await query.maybeSingle();

  if (error) {
    console.warn('[getPropertyDetail] query failed', error);
    throw error;
  }
  if (!data) return null;

  const row = data as unknown as RawDetailRow & {
    owner?: OwnerProfileFull | OwnerProfileFull[] | null;
  };

  let owner: OwnerProfileFull | null = null;
  if (opts.isAuthenticated) {
    const rawOwner = Array.isArray(row.owner) ? (row.owner[0] ?? null) : (row.owner ?? null);
    owner = rawOwner ?? null;
  } else {
    const publicProfile = await getOwnerPublicProfile(supabase, row.owner_id);
    owner = publicProfile ? { ...publicProfile, email: null, phone: null } : null;
  }

  return toPropertyDetail(row, owner);
}

// ============================================================
// Edición de propiedad (feature add_edit_property_form)
// ============================================================

export interface PropertyForEditImage {
  id: string;
  storage_path: string;
  alt_text: string | null;
  is_main: boolean;
  position: number;
}

export interface PropertyForEdit {
  id: string;
  slug: string;
  owner_id: string;
  title: string;
  description: string | null;
  price: number;
  listing_type: ListingType;
  listing_status: ListingStatus;
  property_type: PropertyType;
  address_line: string;
  city: string;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number | null;
  parking_spaces: number | null;
  year_built: number | null;
  published_at: string | null;
  amenities: AmenityKey[];
  images: PropertyForEditImage[];
}

interface RawEditRow {
  id: string;
  slug: string;
  owner_id: string;
  title: string;
  description: string | null;
  price: number | string;
  listing_type: ListingType;
  listing_status: ListingStatus;
  property_type: PropertyType;
  address_line: string;
  city: string;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  bedrooms: number;
  bathrooms: number | string;
  area_sqm: number | string | null;
  parking_spaces: number | null;
  year_built: number | null;
  published_at: string | null;
  property_images: Array<{
    id: string;
    storage_path: string;
    alt_text: string | null;
    is_main: boolean;
    position: number | null;
  }>;
  property_amenities: Array<{ amenity: AmenityKey }>;
}

const EDIT_SELECT_COLUMNS = `
  id, slug, owner_id, title, description, price,
  listing_type, listing_status, property_type,
  address_line, city, state, country, postal_code,
  bedrooms, bathrooms, area_sqm, parking_spaces, year_built,
  published_at,
  property_images ( id, storage_path, alt_text, is_main, position ),
  property_amenities ( amenity )
`;

/**
 * Carga una propiedad con sus imágenes y amenities para pre-rellenar el form
 * de edición. RLS asegura que solo el owner o admin la verán; el caller
 * además valida ownership y devuelve `notFound()` cuando no aplica.
 *
 * Devuelve `null` si la fila no existe (o RLS la oculta). El order de
 * `images` mantiene `position` (main primero como cortesía visual, igual
 * que en `getPropertyDetail`).
 */
export async function getPropertyForEdit(
  supabase: SupabaseDb,
  id: string,
): Promise<PropertyForEdit | null> {
  const { data, error } = await supabase
    .from('properties')
    .select(EDIT_SELECT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.warn('[getPropertyForEdit] query failed', error);
    return null;
  }
  if (!data) return null;

  const row = data as unknown as RawEditRow;

  const images: PropertyForEditImage[] = [...row.property_images]
    .map((img) => ({
      id: img.id,
      storage_path: img.storage_path,
      alt_text: img.alt_text,
      is_main: img.is_main,
      position: img.position ?? 0,
    }))
    .sort((a, b) => {
      if (a.is_main !== b.is_main) return a.is_main ? -1 : 1;
      return a.position - b.position;
    });

  return {
    id: row.id,
    slug: row.slug,
    owner_id: row.owner_id,
    title: row.title,
    description: row.description,
    price: Number(row.price),
    listing_type: row.listing_type,
    listing_status: row.listing_status,
    property_type: row.property_type,
    address_line: row.address_line,
    city: row.city,
    state: row.state,
    country: row.country,
    postal_code: row.postal_code,
    bedrooms: row.bedrooms,
    bathrooms: Number(row.bathrooms),
    area_sqm: row.area_sqm == null ? null : Number(row.area_sqm),
    parking_spaces: row.parking_spaces,
    year_built: row.year_built,
    published_at: row.published_at,
    amenities: row.property_amenities.map((a) => a.amenity),
    images,
  };
}
