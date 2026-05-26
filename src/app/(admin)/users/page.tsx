import { notFound } from 'next/navigation';
import {
  InviteUserButton,
  UserDirectoryEmptyState,
  UserDirectoryRow,
  UserDirectorySearch,
  UserDirectoryTabs,
} from '@/components/admin';
import { DashboardPagination } from '@/components/dashboard';
import { getSessionAndProfile } from '@/lib/auth/get-session';
import {
  listAdminUsers,
  parseDirectoryPageParam,
  parseDirectoryQueryParam,
  parseDirectoryRoleParam,
} from '@/lib/admin/queries';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

type SearchParamsValue = string | string[] | undefined;
type SearchParams = Promise<{
  q?: SearchParamsValue;
  role?: SearchParamsValue;
  page?: SearchParamsValue;
}>;

function searchParamsToPlainRecord(sp: {
  q?: SearchParamsValue;
  role?: SearchParamsValue;
  page?: SearchParamsValue;
}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string' && value.length > 0) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Directorio de usuarios — solo accesible para role `admin`. Triple guard
 * (middleware + layout + page) según §2 del spec.
 *
 * Server Component:
 *  - Parsea searchParams defensivamente (q / role / page).
 *  - Llama `listAdminUsers` con `count: 'exact'` + enrichment de performance.
 *  - Renderiza header + tabs + tabla/cards stacked + paginación.
 */
export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  const session = await getSessionAndProfile();
  if (!session?.user) {
    notFound();
  }
  if (session.profile?.role !== 'admin') {
    notFound();
  }

  const q = parseDirectoryQueryParam(sp.q);
  const role = parseDirectoryRoleParam(sp.role);
  const page = parseDirectoryPageParam(sp.page);

  const supabase = await createClient();
  const { items, total } = await listAdminUsers(supabase, {
    q,
    role,
    page,
    pageSize: PAGE_SIZE,
  });

  const hasResults = items.length > 0;
  const hasFilters = q.length > 0 || role !== 'all';
  const showPagination = total > PAGE_SIZE;
  const currentSpRecord = searchParamsToPlainRecord(sp);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-10 lg:px-8">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">
            Directorio de usuarios
          </h1>
          <p className="mt-1 text-sm text-muted">
            Gestiona el acceso y los roles de la plataforma.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center md:w-auto">
          <UserDirectorySearch key={q} initialQuery={q} />
          <InviteUserButton />
        </div>
      </header>

      {/* Tabs */}
      <nav aria-label="Filtrar por rol" className="mb-6">
        <UserDirectoryTabs currentRole={role} currentQuery={q} />
      </nav>

      {/* Tabla / empty */}
      <section aria-label="Listado de usuarios">
        {!hasResults ? (
          <UserDirectoryEmptyState reason={hasFilters ? 'no_matches' : 'no_users'} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-divider bg-surface shadow-card">
            {/* Header de columnas (md+) */}
            <div
              aria-hidden="true"
              className="hidden grid-cols-12 gap-4 border-b border-divider-soft bg-neutral-50 px-6 py-3 text-xs font-semibold tracking-wider text-muted uppercase md:grid"
            >
              <div className="col-span-5">Datos del usuario</div>
              <div className="col-span-3">Rol y estado</div>
              <div className="col-span-2">Desempeño</div>
              <div className="col-span-2 text-right">Acciones</div>
            </div>

            <ul role="list" className="flex flex-col">
              {items.map((user) => (
                <UserDirectoryRow key={user.id} user={user} callerId={session.user.id} />
              ))}
            </ul>

            {showPagination && (
              <DashboardPagination
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                currentSearchParams={currentSpRecord}
                baseHref="/admin/users"
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
