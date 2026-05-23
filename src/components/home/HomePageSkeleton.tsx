/**
 * Skeleton de la home para `loading.tsx`. Hero (título grande + search bar)
 * + 2 featured cards + 4 compact cards. Mantiene la jerarquía visual sin
 * arrastrar interactividad.
 */
export function HomePageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-3xl space-y-8 text-center">
          <div className="mx-auto h-12 w-3/4 animate-pulse rounded bg-surface-soft md:h-16" />
          <div className="mx-auto h-14 w-full animate-pulse rounded-xl bg-surface-soft" />
          <div className="flex items-center justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-surface-soft" />
            ))}
          </div>
        </div>
      </section>

      <section className="mb-16">
        <div className="mb-8 h-8 w-72 animate-pulse rounded bg-surface-soft" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-surface-soft" />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-8 h-8 w-72 animate-pulse rounded bg-surface-soft" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl bg-surface-soft" />
          ))}
        </div>
      </section>
    </div>
  );
}
