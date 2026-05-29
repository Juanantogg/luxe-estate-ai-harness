/**
 * Skeleton del schedule_visit_screen. Espeja la estructura split
 * (sidebar 5/12 + main 7/12) en md+ y stack en mobile.
 */
export default function ScheduleVisitLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10 lg:px-8">
      <div className="mb-6 h-4 w-32 animate-pulse rounded bg-divider-soft" />

      <section className="overflow-hidden rounded-xl border border-divider-soft bg-surface shadow-soft">
        <div className="flex flex-col md:flex-row">
          <aside className="space-y-6 bg-surface-soft p-6 md:w-5/12 md:p-8 lg:p-10">
            <div className="aspect-[4/3] w-full animate-pulse rounded-lg bg-divider-soft" />
            <div className="space-y-2">
              <div className="h-6 w-2/3 animate-pulse rounded bg-divider-soft" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-divider-soft" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-divider-soft" />
            </div>
            <div className="h-px bg-divider-soft" />
            <div className="space-y-2">
              <div className="h-3 w-16 animate-pulse rounded bg-divider-soft" />
              <div className="h-8 w-1/2 animate-pulse rounded bg-divider-soft" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-divider-soft" />
            </div>
            <div className="h-px bg-divider-soft" />
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 animate-pulse rounded-full bg-divider-soft" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 animate-pulse rounded bg-divider-soft" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-divider-soft" />
              </div>
            </div>
          </aside>

          <div className="flex flex-col p-6 md:w-7/12 md:p-8 lg:p-10">
            <div className="mb-8 space-y-2">
              <div className="h-8 w-2/3 animate-pulse rounded bg-divider-soft" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-divider-soft" />
            </div>

            {/* Calendario skeleton */}
            <div className="mb-8 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 w-32 animate-pulse rounded bg-divider-soft" />
                <div className="flex gap-2">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-divider-soft" />
                  <div className="h-8 w-8 animate-pulse rounded-full bg-divider-soft" />
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 42 }).map((_, i) => (
                  <div key={i} className="h-10 w-full animate-pulse rounded-lg bg-divider-soft" />
                ))}
              </div>
            </div>

            {/* Slots skeleton */}
            <div className="mb-8 space-y-3">
              <div className="h-4 w-40 animate-pulse rounded bg-divider-soft" />
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-10 w-full animate-pulse rounded-lg bg-divider-soft" />
                ))}
              </div>
            </div>

            {/* Textarea skeleton */}
            <div className="mb-8 space-y-2">
              <div className="h-4 w-48 animate-pulse rounded bg-divider-soft" />
              <div className="h-24 w-full animate-pulse rounded-lg bg-divider-soft" />
            </div>

            <div className="flex items-center justify-end gap-4 border-t border-divider-soft pt-6">
              <div className="h-4 w-20 animate-pulse rounded bg-divider-soft" />
              <div className="h-12 w-40 animate-pulse rounded bg-divider-soft" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
