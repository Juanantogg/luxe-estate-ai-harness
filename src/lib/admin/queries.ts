import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type SupabaseDb = SupabaseClient<Database>;

export type UserRole = Database['public']['Enums']['user_role'];
export type DirectoryRoleFilter = 'all' | 'user' | 'agent' | 'admin';

/**
 * Fila enriquecida lista para alimentar `UserDirectoryRow`.
 *
 * `properties_count` y `sales_ytd` son `null` para `role === 'user'`
 * (no aplica). Para agent/broker/admin reflejan métricas reales.
 */
export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  properties_count: number | null;
  sales_ytd: number | null;
}

export interface ListAdminUsersOptions {
  q: string;
  role: DirectoryRoleFilter;
  page: number;
  pageSize: number;
}

export interface ListAdminUsersResult {
  items: AdminUserRow[];
  total: number;
}

/**
 * Escapa los wildcards de PostgREST `ilike` (`%`, `_`, `\`) para que el
 * término del search no se interprete como pattern. Decisión D6 del spec.
 */
function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, '\\$&');
}

/**
 * Convierte un searchParam crudo en un `DirectoryRoleFilter`. Valores
 * fuera del set (incluido `broker`, que la UI no expone) caen a `'all'`.
 */
export function parseDirectoryRoleParam(raw: string | string[] | undefined): DirectoryRoleFilter {
  if (typeof raw !== 'string') return 'all';
  if (raw === 'all' || raw === 'user' || raw === 'agent' || raw === 'admin') return raw;
  return 'all';
}

export function parseDirectoryQueryParam(raw: string | string[] | undefined): string {
  if (typeof raw !== 'string') return '';
  return raw.trim();
}

export function parseDirectoryPageParam(raw: string | string[] | undefined): number {
  if (typeof raw !== 'string') return 1;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1) return 1;
  return n;
}

/**
 * Lista paginada de profiles con métricas para el directorio admin.
 *
 * Estrategia (decisión D del spec §5):
 *   1) Query principal sobre `profiles` con `count: 'exact'`, filtros
 *      `q`/`role` y paginación.
 *   2) Si hay owners no-user en la página, dispara DOS queries agregadas
 *      a `properties` (count + sum YTD) y enriquece en JS.
 *
 * No se usa join lateral / sum-group-by porque PostgREST no los expone
 * con tipos cómodos y la cardinalidad acá es siempre ≤ pageSize.
 */
export async function listAdminUsers(
  supabase: SupabaseDb,
  opts: ListAdminUsersOptions,
): Promise<ListAdminUsersResult> {
  const { q, role, page, pageSize } = opts;
  const term = q.trim();

  // Paso 1: query principal.
  let query = supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, is_active, created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (role !== 'all') {
    query = query.eq('role', role);
  }
  if (term !== '') {
    const safe = escapeIlike(term);
    query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
  }

  const { data, count, error } = await query;
  if (error) {
    console.warn('[listAdminUsers] query failed', error);
    throw error;
  }

  const profiles = data ?? [];

  // Paso 2: enrichment de performance para owners no-user.
  const ownerIds = profiles.filter((p) => p.role !== 'user').map((p) => p.id);

  const propertiesCountByOwner = new Map<string, number>();
  const salesYtdByOwner = new Map<string, number>();

  if (ownerIds.length > 0) {
    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)).toISOString();

    const [countsRes, salesRes] = await Promise.all([
      supabase
        .from('properties')
        .select('owner_id, id')
        .in('owner_id', ownerIds)
        .neq('listing_status', 'archived'),
      supabase
        .from('properties')
        .select('owner_id, price')
        .in('owner_id', ownerIds)
        .eq('listing_status', 'sold')
        .gte('sold_at', yearStart),
    ]);

    if (countsRes.error) {
      console.warn('[listAdminUsers] counts query failed', countsRes.error);
    } else {
      for (const row of countsRes.data ?? []) {
        propertiesCountByOwner.set(
          row.owner_id,
          (propertiesCountByOwner.get(row.owner_id) ?? 0) + 1,
        );
      }
    }

    if (salesRes.error) {
      console.warn('[listAdminUsers] sales query failed', salesRes.error);
    } else {
      for (const row of salesRes.data ?? []) {
        const priceNum = Number(row.price);
        if (!Number.isFinite(priceNum)) continue;
        salesYtdByOwner.set(row.owner_id, (salesYtdByOwner.get(row.owner_id) ?? 0) + priceNum);
      }
    }
  }

  const items: AdminUserRow[] = profiles.map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    avatar_url: p.avatar_url,
    role: p.role,
    is_active: p.is_active,
    created_at: p.created_at,
    properties_count: p.role === 'user' ? null : (propertiesCountByOwner.get(p.id) ?? 0),
    sales_ytd: p.role === 'user' ? null : (salesYtdByOwner.get(p.id) ?? 0),
  }));

  return { items, total: count ?? 0 };
}
