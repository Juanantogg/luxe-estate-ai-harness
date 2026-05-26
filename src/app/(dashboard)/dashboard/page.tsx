import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArchivedToggle,
  DashboardEmptyState,
  DashboardFilters,
  DashboardPagination,
  DashboardStatCard,
  PropertyManagementRow,
} from '@/components/dashboard';
import { Button } from '@/components/ui';
import { getSessionAndProfile } from '@/lib/auth/get-session';
import {
  getDashboardStats,
  listManagementProperties,
  parseDashboardListingTypeParam,
  parseDashboardStatusParam,
} from '@/lib/dashboard/queries';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 10;

type SearchParamsValue = string | string[] | undefined;
type SearchParams = Promise<{
  page?: SearchParamsValue;
  status?: SearchParamsValue;
  type?: SearchParamsValue;
  archived?: SearchParamsValue;
}>;

function parsePage(raw: SearchParamsValue): number {
  if (typeof raw !== 'string') return 1;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1) return 1;
  return n;
}

function searchParamsToPlainRecord(sp: {
  page?: SearchParamsValue;
  status?: SearchParamsValue;
  type?: SearchParamsValue;
  archived?: SearchParamsValue;
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
 * Dashboard de gestión de propiedades (feature
 * `property_management_dashboard`).
 *
 * Server Component. Lee la sesión, parsea searchParams defensivamente,
 * lanza queries en paralelo (stats + list) y delega los detalles
 * presentacionales en los componentes de `@/components/dashboard/`.
 *
 * Scope:
 *  - `agent`/`broker`: ven solo sus propiedades (filtro `owner_id`).
 *  - `admin`: ve TODAS las properties (`scope='all'`) y la tabla muestra
 *    una columna extra "Propietario".
 *
 * Estados especiales:
 *  - Sin properties en total → empty state full + stats con 0.
 *  - Con properties pero filtros vacíos → mensaje compacto + link
 *    "Limpiar filtros".
 *  - Toggle ON sin archivadas → mensaje compacto + link "Volver a activas".
 */
export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  const page = parsePage(sp.page);
  const includeArchived = sp.archived === '1';
  const status = parseDashboardStatusParam(sp.status);
  const listingType = parseDashboardListingTypeParam(sp.type);

  const session = await getSessionAndProfile();
  if (!session?.user) {
    // El layout ya redirige, pero defensa adicional en el page.
    redirect('/login?next=/dashboard');
  }

  const role = session.profile?.role ?? 'user';
  const isAdmin = role === 'admin';
  const scope = isAdmin ? 'all' : 'mine';
  const viewerMode = isAdmin ? 'admin' : 'agent';

  const supabase = await createClient();

  const [stats, listResult] = await Promise.all([
    getDashboardStats(supabase, { kind: scope, userId: session.user.id }),
    listManagementProperties(supabase, {
      page,
      pageSize: PAGE_SIZE,
      status,
      listingType,
      scope,
      userId: session.user.id,
      includeArchived,
    }),
  ]);

  const { items, total } = listResult;
  const hasAnyProperty = stats.total > 0;
  const hasResults = items.length > 0;
  const hasActiveFilters = status !== null || listingType !== null;

  // Para preservar searchParams al paginar.
  const currentSpRecord = searchParamsToPlainRecord(sp);

  const subToolbarCopy = includeArchived
    ? 'Mostrando todas las propiedades, incluyendo archivadas.'
    : 'Mostrando propiedades activas.';

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-10 lg:px-8">
      {/* Header de página */}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between md:mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Mis propiedades</h1>
          <p className="mt-1 text-sm text-muted">Gestiona tu portafolio y revisa rendimiento.</p>
        </div>
        <div
          role="toolbar"
          aria-label="Acciones del dashboard"
          className="flex items-center gap-2 sm:gap-3"
        >
          <DashboardFilters currentStatus={status} currentListingType={listingType} />
          <Link href="/dashboard/properties/new" className="inline-flex">
            <Button variant="primary" size="md" leadingIcon="add" tabIndex={-1}>
              Agregar propiedad
            </Button>
          </Link>
        </div>
      </header>

      {/* Stats overview */}
      <section aria-label="Resumen" className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-6">
        <DashboardStatCard label="Total" value={stats.total} icon="apartment" tone="primary" />
        <DashboardStatCard
          label="Activas"
          value={stats.active}
          icon="check_circle"
          tone="success"
        />
        <DashboardStatCard
          label="Pendientes"
          value={stats.pendingSale}
          icon="pending"
          tone="warning"
        />
      </section>

      {/* Tabla / cards / empty */}
      <section aria-label="Propiedades" className="mt-6 md:mt-8">
        {!hasAnyProperty ? (
          <DashboardEmptyState />
        ) : (
          <div className="overflow-hidden rounded-xl border border-divider bg-surface shadow-card">
            {/* Sub-toolbar */}
            <div className="flex flex-col gap-3 border-b border-divider-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-sm text-muted">{subToolbarCopy}</p>
              <ArchivedToggle initial={includeArchived} />
            </div>

            {/* Header de columnas (md+ solamente) */}
            {hasResults && (
              <div
                className={
                  'hidden grid-cols-12 gap-4 border-b border-divider-soft bg-neutral-50 px-6 py-3 text-xs font-semibold tracking-wider text-muted uppercase md:grid'
                }
                aria-hidden="true"
              >
                <div className={isAdmin ? 'col-span-4' : 'col-span-6'}>Propiedad</div>
                {isAdmin && <div className="col-span-2">Propietario</div>}
                <div className="col-span-2">Precio</div>
                <div className="col-span-2">Estado</div>
                <div className="col-span-2 text-right">Acciones</div>
              </div>
            )}

            {/* Resultados / mensajes compactos */}
            {hasResults ? (
              <ul role="list" className="flex flex-col">
                {items.map((property) => (
                  <PropertyManagementRow
                    key={property.id}
                    property={property}
                    viewerMode={viewerMode}
                  />
                ))}
              </ul>
            ) : includeArchived ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <p className="text-sm text-muted">No tienes propiedades archivadas.</p>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Volver a activas
                </Link>
              </div>
            ) : hasActiveFilters ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <p className="text-sm text-muted">
                  No se encontraron propiedades con los filtros aplicados.
                </p>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Limpiar filtros
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <p className="text-sm text-muted">No hay propiedades para mostrar.</p>
              </div>
            )}

            {/* Footer paginación */}
            {hasResults && total > PAGE_SIZE && (
              <DashboardPagination
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                currentSearchParams={currentSpRecord}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
