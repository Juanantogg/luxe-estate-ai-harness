/**
 * Skeleton del detalle de propiedad. Espeja el layout final
 * (galería + secciones + sidebar) para evitar layout shift.
 */
export default function PropertyDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-4 pt-6 lg:hidden">
        <div className="h-4 w-16 animate-pulse rounded bg-surface-soft" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          {/* Galería */}
          <div className="space-y-4">
            <div className="aspect-[16/10] w-full animate-pulse rounded-xl bg-surface-soft" />
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[4/3] w-32 flex-none animate-pulse rounded-lg bg-surface-soft sm:w-40"
                />
              ))}
            </div>
          </div>

          {/* Título */}
          <div className="space-y-2">
            <div className="h-8 w-2/3 animate-pulse rounded bg-surface-soft" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-surface-soft" />
          </div>

          {/* Features */}
          <div className="rounded-xl border border-divider-soft bg-surface p-6 shadow-soft md:p-8">
            <div className="mb-6 h-5 w-40 animate-pulse rounded bg-surface-soft" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-lg border border-primary/10 bg-primary-soft"
                />
              ))}
            </div>
          </div>

          {/* About */}
          <div className="rounded-xl border border-divider-soft bg-surface p-6 shadow-soft md:p-8">
            <div className="mb-4 h-5 w-56 animate-pulse rounded bg-surface-soft" />
            <div className="space-y-3">
              <div className="h-3 w-full animate-pulse rounded bg-surface-soft" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-surface-soft" />
              <div className="h-3 w-4/6 animate-pulse rounded bg-surface-soft" />
            </div>
          </div>

          {/* Amenities */}
          <div className="rounded-xl border border-divider-soft bg-surface p-6 shadow-soft md:p-8">
            <div className="mb-6 h-5 w-32 animate-pulse rounded bg-surface-soft" />
            <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-4 w-3/4 animate-pulse rounded bg-surface-soft" />
              ))}
            </div>
          </div>
        </div>

        <aside className="lg:col-span-4">
          <div className="space-y-6 lg:sticky lg:top-24">
            <div className="rounded-xl border border-primary/5 bg-surface p-6 shadow-soft">
              <div className="mb-4 space-y-2">
                <div className="h-10 w-2/3 animate-pulse rounded bg-surface-soft" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-surface-soft" />
              </div>
              <div className="my-6 h-px bg-divider-soft" />
              <div className="mb-6 flex items-center gap-4">
                <div className="h-12 w-12 animate-pulse rounded-full bg-surface-soft" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-surface-soft" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-surface-soft" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-12 w-full animate-pulse rounded bg-primary-soft" />
                <div className="h-12 w-full animate-pulse rounded bg-surface-soft" />
              </div>
            </div>
            <div className="rounded-xl border border-divider-soft bg-surface p-2 shadow-card">
              <div className="aspect-[4/3] w-full animate-pulse rounded-lg bg-surface-soft" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
