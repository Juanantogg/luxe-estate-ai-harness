/**
 * Skeleton del dashboard mientras Next resuelve las queries en server.
 * Refleja la misma estructura: header + 3 stat cards + sub-toolbar +
 * lista de 10 filas + footer.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-10 lg:px-8">
      {/* Header skeleton */}
      <div className="mb-6 md:mb-8">
        <div className="h-9 w-64 animate-pulse rounded bg-neutral-100" aria-hidden="true" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-neutral-100" aria-hidden="true" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-6">
        <div className="h-24 animate-pulse rounded-xl bg-neutral-100" />
        <div className="h-24 animate-pulse rounded-xl bg-neutral-100" />
        <div className="h-24 animate-pulse rounded-xl bg-neutral-100" />
      </div>

      {/* Table skeleton */}
      <div className="mt-6 overflow-hidden rounded-xl border border-divider bg-surface shadow-card md:mt-8">
        <div className="border-b border-divider-soft px-4 py-3 sm:px-6">
          <div className="h-5 w-40 animate-pulse rounded bg-neutral-100" />
        </div>
        <ul className="flex flex-col">
          {Array.from({ length: 10 }, (_, i) => (
            <li key={i} className="border-b border-divider-soft px-6 py-5 last:border-b-0">
              <div className="h-20 animate-pulse rounded bg-neutral-100" />
            </li>
          ))}
        </ul>
      </div>
      <span className="sr-only">Cargando dashboard…</span>
    </div>
  );
}
