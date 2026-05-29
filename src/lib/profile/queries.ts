import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '@/lib/properties/queries';
import type { Database } from '@/types/database';

/**
 * Queries server-side específicas de la pantalla `/profile`. Funciones puras
 * (reciben el cliente) para que sean fáciles de componer desde page.tsx sin
 * acoplarse al request actual.
 */

type SupabaseDb = SupabaseClient<Database>;

export type VisitStatus = Database['public']['Enums']['visit_status'];

// ============================================================
// Stats del header
// ============================================================

export interface ProfileStats {
  favoritesCount: number;
  visitsCount: number;
  /** `null` cuando el role es `user` (no se muestra el counter). */
  soldCount: number | null;
}

const AGENT_ROLES: ReadonlyArray<UserRole> = ['agent', 'broker', 'admin'];

/**
 * Trae los contadores del header del perfil (favoritos guardados, visitas
 * agendadas y, sólo para agent/broker/admin, propiedades vendidas).
 *
 * Se ejecutan en paralelo con `Promise.all` y se usan queries con
 * `count: 'exact', head: true` para no transferir filas — solo el header
 * `Content-Range`. Si alguna falla se loguea y devuelve `0`; preferimos
 * pintar el bloque que romper toda la pantalla por un contador.
 */
export async function getProfileStats(
  supabase: SupabaseDb,
  userId: string,
  role: UserRole,
): Promise<ProfileStats> {
  const showSold = (AGENT_ROLES as readonly string[]).includes(role);

  const favoritesPromise = supabase
    .from('favorites')
    .select('property_id', { count: 'exact', head: true })
    .eq('user_id', userId);

  const visitsPromise = supabase
    .from('visits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  const soldPromise = showSold
    ? supabase
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .eq('listing_status', 'sold')
    : Promise.resolve({ count: null, error: null } as const);

  const [favoritesRes, visitsRes, soldRes] = await Promise.all([
    favoritesPromise,
    visitsPromise,
    soldPromise,
  ]);

  if (favoritesRes.error) {
    console.warn('[getProfileStats] favorites count failed', favoritesRes.error);
  }
  if (visitsRes.error) {
    console.warn('[getProfileStats] visits count failed', visitsRes.error);
  }
  if (soldRes.error) {
    console.warn('[getProfileStats] sold count failed', soldRes.error);
  }

  return {
    favoritesCount: favoritesRes.count ?? 0,
    visitsCount: visitsRes.count ?? 0,
    soldCount: showSold ? (soldRes.count ?? 0) : null,
  };
}

// ============================================================
// Visitas del user (Próximas / Pasadas)
// ============================================================

export interface VisitForCard {
  id: string;
  /** UTC ISO. La formateación a `es-MX` ocurre en zona local de la propiedad. */
  scheduled_at: string;
  status: VisitStatus;
  property: {
    id: string;
    slug: string;
    title: string;
    address_line: string;
    city: string;
    state: string | null;
    country: string | null;
    timezone: string;
    main_image: { storage_path: string; alt_text: string | null } | null;
  };
  agent: { full_name: string | null; email: string };
}

export interface VisitsBuckets {
  upcoming: VisitForCard[];
  past: VisitForCard[];
}

/** Status que se consideran "activos" para la sección Próximas. */
const UPCOMING_STATUSES: ReadonlySet<VisitStatus> = new Set([
  'pending',
  'confirmed',
  'rescheduled',
]);

type RawVisitRow = {
  id: string;
  scheduled_at: string;
  status: VisitStatus;
  property:
    | {
        id: string;
        slug: string;
        title: string;
        address_line: string;
        city: string;
        state: string | null;
        country: string | null;
        timezone: string | null;
        property_images: Array<{
          storage_path: string;
          alt_text: string | null;
          is_main: boolean;
          position: number | null;
        }> | null;
      }
    | Array<{
        id: string;
        slug: string;
        title: string;
        address_line: string;
        city: string;
        state: string | null;
        country: string | null;
        timezone: string | null;
        property_images: Array<{
          storage_path: string;
          alt_text: string | null;
          is_main: boolean;
          position: number | null;
        }> | null;
      }>
    | null;
  agent:
    | { full_name: string | null; email: string }
    | Array<{ full_name: string | null; email: string }>
    | null;
};

function pickMainImage(
  images: Array<{
    storage_path: string;
    alt_text: string | null;
    is_main: boolean;
    position: number | null;
  }> | null,
): { storage_path: string; alt_text: string | null } | null {
  if (!images || images.length === 0) return null;
  const main = images.find((img) => img.is_main) ?? images[0];
  return main ? { storage_path: main.storage_path, alt_text: main.alt_text } : null;
}

/**
 * Trae todas las visitas del user, partidas en dos buckets:
 *
 * - `upcoming`: status ∈ {pending, confirmed, rescheduled} Y `scheduled_at > now`.
 *               Ordenadas ASC (la más próxima arriba).
 * - `past`: el resto (visitas con status final o con fecha pasada). Ordenadas
 *           DESC (la más reciente arriba).
 *
 * Se hace UNA sola query y se parte en código: menos round-trips, RLS
 * coherente, y si en el futuro se pagina `past` se aplica `.limit(20)`
 * server-side sin tocar el callsite.
 */
export async function getUserVisits(supabase: SupabaseDb, userId: string): Promise<VisitsBuckets> {
  const { data, error } = await supabase
    .from('visits')
    .select(
      `
      id,
      scheduled_at,
      status,
      property:properties!visits_property_id_fkey (
        id, slug, title, address_line, city, state, country, timezone,
        property_images ( storage_path, alt_text, is_main, position )
      ),
      agent:profiles!visits_agent_id_fkey (
        full_name, email
      )
    `,
    )
    .eq('user_id', userId);

  if (error) {
    console.warn('[getUserVisits] query failed', error);
    return { upcoming: [], past: [] };
  }

  const now = Date.now();
  const upcoming: VisitForCard[] = [];
  const past: VisitForCard[] = [];

  for (const row of (data ?? []) as unknown as RawVisitRow[]) {
    const propertyRaw = Array.isArray(row.property) ? (row.property[0] ?? null) : row.property;
    const agentRaw = Array.isArray(row.agent) ? (row.agent[0] ?? null) : row.agent;
    if (!propertyRaw || !agentRaw) continue;

    const visit: VisitForCard = {
      id: row.id,
      scheduled_at: row.scheduled_at,
      status: row.status,
      property: {
        id: propertyRaw.id,
        slug: propertyRaw.slug,
        title: propertyRaw.title,
        address_line: propertyRaw.address_line,
        city: propertyRaw.city,
        state: propertyRaw.state,
        country: propertyRaw.country,
        // Defense-in-depth: si la propiedad no tuviera timezone (no debería
        // tras migración 0016), caemos al default del proyecto.
        timezone: propertyRaw.timezone ?? 'America/Mexico_City',
        main_image: pickMainImage(propertyRaw.property_images),
      },
      agent: { full_name: agentRaw.full_name, email: agentRaw.email },
    };

    const scheduledMs = new Date(visit.scheduled_at).getTime();
    const isActive = UPCOMING_STATUSES.has(visit.status) && scheduledMs > now;
    if (isActive) upcoming.push(visit);
    else past.push(visit);
  }

  upcoming.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  past.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  return { upcoming, past };
}
