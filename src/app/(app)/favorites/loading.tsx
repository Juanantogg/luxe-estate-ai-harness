import { PropertyCardSkeleton } from '@/components/property';

/**
 * Skeleton mostrado mientras `/favorites` carga la query inicial. Mantiene
 * la huella visual del render real: header + toolbar + 4 cards verticales.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <section className="py-8 md:py-12" aria-hidden="true">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="h-9 w-56 animate-pulse rounded bg-surface-soft md:h-10 md:w-64" />
            <div className="h-4 w-72 animate-pulse rounded bg-surface-soft" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-10 w-56 animate-pulse rounded bg-surface" />
            <div className="h-10 w-20 animate-pulse rounded bg-surface" />
          </div>
        </header>
      </section>

      <section aria-hidden="true">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <PropertyCardSkeleton key={i} withCTA />
          ))}
        </div>
      </section>
    </div>
  );
}
