/**
 * Skeleton del directorio de usuarios — coincide en alto y disposición
 * con el page real para evitar layout shift.
 */
export default function AdminUsersLoading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-6 sm:px-6 md:py-10 lg:px-8">
      {/* Header skeleton */}
      <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-72 rounded bg-neutral-200" />
          <div className="h-4 w-56 rounded bg-neutral-200" />
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="h-10 w-full rounded bg-neutral-200 md:w-80" />
          <div className="h-10 w-40 rounded bg-neutral-200" />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="mb-6 flex gap-6 border-b border-divider">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="mb-3 h-4 w-16 rounded bg-neutral-200" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-divider bg-surface shadow-card">
        <div className="hidden border-b border-divider-soft bg-neutral-50 px-6 py-3 md:block">
          <div className="h-3 w-32 rounded bg-neutral-200" />
        </div>
        <ul className="flex flex-col">
          {Array.from({ length: 10 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center gap-4 border-b border-divider-soft px-6 py-5 last:border-b-0"
            >
              <div className="h-12 w-12 rounded-full bg-neutral-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-neutral-200" />
                <div className="h-3 w-1/2 rounded bg-neutral-200" />
              </div>
              <div className="hidden h-6 w-20 rounded bg-neutral-200 md:block" />
              <div className="hidden h-9 w-32 rounded bg-neutral-200 md:block" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
