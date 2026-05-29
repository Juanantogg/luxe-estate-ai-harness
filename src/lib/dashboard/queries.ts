import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { ListingStatus, ListingType } from '@/lib/properties/queries';

/**
 * Queries server-side del dashboard de gestión de propiedades (feature
 * property_management_dashboard).
 *
 * Vive separado de `src/lib/properties/queries.ts` porque el shape difiere:
 * el dashboard lista TODOS los status del owner (incluyendo `draft` y
 * `archived`), mientras que `properties/queries.ts` está orientado al
 * listing público que solo expone `active`.
 */

type SupabaseDb = SupabaseClient<Database>;

/**
 * Fila aplanada lista para alimentar `PropertyManagementRow`.
 *
 * - `main_image` se resuelve eligiendo la imagen con `is_main = true` en JS
 *   (mismo patrón que `toPropertyForCard`). Un draft sin imágenes deja el
 *   campo en `null` y el row pinta un fallback.
 * - `owner_profile` solo está poblado cuando el viewer es admin (scope
 *   global). Para el modo `mine` (agent/broker), el join se omite por
 *   completo y el campo es `null`.
 */
export interface PropertyForManagement {
  id: string;
  slug: string;
  title: string;
  address_line: string;
  city: string;
  price: number;
  listing_type: ListingType;
  listing_status: ListingStatus;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number | null;
  published_at: string | null;
  updated_at: string;
  main_image: { storage_path: string; alt_text: string | null } | null;
  owner_id: string;
  owner_profile: { full_name: string | null; avatar_url: string | null } | null;
}

export type DashboardScope = 'mine' | 'all';

export interface DashboardListOptions {
  /** Página 1-based. */
  page: number;
  /** Tamaño de página. 10 según spec. */
  pageSize: number;
  /** Filtro de status del dropdown. `null` = todos los status no archivados. */
  status: ListingStatus | null;
  /** Filtro de listing_type del dropdown. `null` = todos. */
  listingType: ListingType | null;
  /** 'mine' = filtra por owner_id = userId; 'all' = sin filtro (admin). */
  scope: DashboardScope;
  /** Owner_id a filtrar cuando scope='mine'. Ignorado cuando 'all'. */
  userId: string;
  /** Toggle "Ver archivadas": si true, NO excluye listing_status='archived'. */
  includeArchived: boolean;
}

export interface DashboardListResult {
  items: PropertyForManagement[];
  total: number;
}

const LIST_SELECT_BASE = `
  id, slug, title, address_line, city, price,
  listing_type, listing_status, bedrooms, bathrooms, area_sqm,
  published_at, updated_at, owner_id,
  property_images ( storage_path, alt_text, is_main, position )
`;

const LIST_SELECT_WITH_OWNER = `
  ${LIST_SELECT_BASE},
  owner_profile:profiles!properties_owner_id_fkey ( full_name, avatar_url )
`;

interface RawListRow {
  id: string;
  title: string;
  address_line: string;
  city: string;
  price: number | string;
  listing_type: ListingType;
  listing_status: ListingStatus;
  bedrooms: number;
  bathrooms: number | string;
  area_sqm: number | string | null;
  published_at: string | null;
  updated_at: string;
  owner_id: string;
  property_images: Array<{
    storage_path: string;
    alt_text: string | null;
    is_main: boolean;
    position: number | null;
  }>;
  owner_profile?:
    | { full_name: string | null; avatar_url: string | null }
    | Array<{ full_name: string | null; avatar_url: string | null }>
    | null;
}

function toPropertyForManagement(row: RawListRow): PropertyForManagement {
  const mainImage =
    row.property_images.find((img) => img.is_main) ?? row.property_images[0] ?? null;
  const rawOwner = Array.isArray(row.owner_profile)
    ? (row.owner_profile[0] ?? null)
    : (row.owner_profile ?? null);
  return {
    id: row.id,
    title: row.title,
    address_line: row.address_line,
    city: row.city,
    price: Number(row.price),
    listing_type: row.listing_type,
    listing_status: row.listing_status,
    bedrooms: row.bedrooms,
    bathrooms: Number(row.bathrooms),
    area_sqm: row.area_sqm == null ? null : Number(row.area_sqm),
    published_at: row.published_at,
    updated_at: row.updated_at,
    owner_id: row.owner_id,
    main_image: mainImage
      ? { storage_path: mainImage.storage_path, alt_text: mainImage.alt_text }
      : null,
    owner_profile: rawOwner ?? null,
  };
}

/**
 * Lista paginada de propiedades del dashboard. RLS hace el trabajo pesado:
 *
 * - `scope === 'mine'`: la query agrega `.eq('owner_id', userId)`. Sirve
 *   para agent/broker. Aunque RLS permite ver más (admin), filtrar acá
 *   por owner_id es el comportamiento esperado de la pantalla.
 * - `scope === 'all'`: sin filtro de owner_id. Solo seguro si el caller
 *   es admin (RLS lo enforza igual). Trae el join a `profiles` para
 *   mostrar "Propietario" en la tabla.
 *
 * Orden default: `updated_at desc nulls last` (R2). Useful mientras el
 * agent itera precios/descripciones.
 *
 * Pagination: `range((page-1)*pageSize, page*pageSize - 1)`.
 */
export async function listManagementProperties(
  supabase: SupabaseDb,
  opts: DashboardListOptions,
): Promise<DashboardListResult> {
  const select = opts.scope === 'all' ? LIST_SELECT_WITH_OWNER : LIST_SELECT_BASE;

  let q = supabase.from('properties').select(select, { count: 'exact' });

  if (opts.scope === 'mine') {
    q = q.eq('owner_id', opts.userId);
  }

  // Toggle "Ver archivadas": si OFF, excluimos archived.
  if (!opts.includeArchived) {
    q = q.neq('listing_status', 'archived');
  }

  // Filtros del dropdown — se aplican después del archived guard.
  if (opts.status) {
    q = q.eq('listing_status', opts.status);
  }
  if (opts.listingType) {
    q = q.eq('listing_type', opts.listingType);
  }

  const from = (opts.page - 1) * opts.pageSize;
  const to = opts.page * opts.pageSize - 1;

  const { data, count, error } = await q
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .range(from, to);

  if (error) {
    console.warn('[listManagementProperties] query failed', error);
    throw error;
  }

  const items = (data ?? []).map((row) => toPropertyForManagement(row as unknown as RawListRow));

  return { items, total: count ?? 0 };
}

export interface DashboardStats {
  /** Total de propiedades del scope. INCLUYE archivadas (R1). */
  total: number;
  /** Properties con `listing_status='active'`. */
  active: number;
  /** Properties con `listing_status='pending'`. */
  pendingSale: number;
}

export interface DashboardStatsScope {
  kind: DashboardScope;
  userId: string;
}

/**
 * Counters agregados para las 3 stat cards del header.
 *
 * Tres queries en paralelo con `count: 'exact', head: true` (no transfiere
 * filas, solo el header `Content-Range`). El total INCLUYE archivadas
 * porque el delete es soft y el agent debe ver el histórico completo (R1).
 */
export async function getDashboardStats(
  supabase: SupabaseDb,
  scope: DashboardStatsScope,
): Promise<DashboardStats> {
  function base() {
    let q = supabase.from('properties').select('id', { count: 'exact', head: true });
    if (scope.kind === 'mine') q = q.eq('owner_id', scope.userId);
    return q;
  }

  const [totalRes, activeRes, pendingRes] = await Promise.all([
    base(),
    base().eq('listing_status', 'active'),
    base().eq('listing_status', 'pending'),
  ]);

  if (totalRes.error) {
    console.warn('[getDashboardStats] total query failed', totalRes.error);
  }
  if (activeRes.error) {
    console.warn('[getDashboardStats] active query failed', activeRes.error);
  }
  if (pendingRes.error) {
    console.warn('[getDashboardStats] pending query failed', pendingRes.error);
  }

  return {
    total: totalRes.count ?? 0,
    active: activeRes.count ?? 0,
    pendingSale: pendingRes.count ?? 0,
  };
}

/**
 * Mapea un valor de `?status=` del searchParam a `ListingStatus | null`.
 *
 * `archived` NO se acepta acá: el dropdown del dashboard NO lo expone
 * (se controla via el toggle separado "Ver archivadas").
 */
const VALID_DROPDOWN_STATUSES: ReadonlySet<ListingStatus> = new Set([
  'active',
  'pending',
  'sold',
  'rented',
  'draft',
] satisfies ListingStatus[]);

export function parseDashboardStatusParam(
  raw: string | string[] | undefined,
): ListingStatus | null {
  if (typeof raw !== 'string') return null;
  return VALID_DROPDOWN_STATUSES.has(raw as ListingStatus) ? (raw as ListingStatus) : null;
}

const VALID_LISTING_TYPES: ReadonlySet<ListingType> = new Set([
  'sale',
  'rent',
] satisfies ListingType[]);

export function parseDashboardListingTypeParam(
  raw: string | string[] | undefined,
): ListingType | null {
  if (typeof raw !== 'string') return null;
  return VALID_LISTING_TYPES.has(raw as ListingType) ? (raw as ListingType) : null;
}
