import { PropertyCardSkeleton } from '@/components/property';

/**
 * Skeleton mostrado mientras `/profile` carga datos. Mantiene la huella
 * visual del render real para evitar saltos: header verde con avatar +
 * identidad skeleton, tabs estáticos, y 6 PropertyCardSkeleton (default tab
 * saved). El skeleton no varía por `?tab` para mantenerse simple — un
 * loading "exacto" requeriría leer searchParams desde el segmento, que no
 * está disponible aquí.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <section className="py-8 md:py-12" aria-hidden="true">
        <div className="mb-10 flex flex-col gap-6 rounded-2xl border border-divider-soft bg-surface-soft p-6 shadow-soft sm:p-8 md:flex-row md:items-center md:justify-between md:gap-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="h-24 w-24 animate-pulse rounded-full border-4 border-surface bg-neutral-100 lg:h-32 lg:w-32" />
            <div className="space-y-3 text-center sm:text-left">
              <div className="mx-auto h-8 w-48 animate-pulse rounded bg-neutral-100 sm:mx-0 lg:h-10 lg:w-64" />
              <div className="mx-auto h-4 w-40 animate-pulse rounded bg-neutral-100 sm:mx-0" />
            </div>
          </div>
          <div className="flex items-stretch gap-4 rounded-xl bg-surface px-6 py-4 shadow-card sm:gap-6 lg:gap-12">
            <div className="h-12 w-12 animate-pulse rounded bg-neutral-100" />
            <div className="h-12 w-12 animate-pulse rounded bg-neutral-100" />
          </div>
        </div>

        <div className="mb-8 flex items-center gap-6 border-b border-divider sm:gap-8">
          <div className="h-9 w-40 animate-pulse rounded bg-neutral-100" />
          <div className="h-9 w-40 animate-pulse rounded bg-neutral-100" />
          <div className="h-9 w-44 animate-pulse rounded bg-neutral-100" />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8 xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <PropertyCardSkeleton key={i} withCTA />
          ))}
        </div>
      </section>
    </div>
  );
}
