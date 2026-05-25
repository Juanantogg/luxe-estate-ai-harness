import { cn } from '@/lib/utils/cn';

export type PropertyCardSkeletonOrientation = 'vertical' | 'horizontal';

export interface PropertyCardSkeletonProps {
  /**
   * Espejo de `PropertyCard.orientation`. Mantiene la huella visual del
   * loading state coherente con el render real para evitar "salto" cuando
   * los datos llegan.
   * @default 'vertical'
   */
  orientation?: PropertyCardSkeletonOrientation;
  /**
   * Reserva espacio para el CTA "Reservar visita" al pie. Coincide con la
   * prop `PropertyCard.showBookingCTA`.
   * @default false
   */
  withCTA?: boolean;
  className?: string;
}

/**
 * Placeholder animate-pulse para `PropertyCard` (variante `compact`). Vive
 * en `components/property/` para poder reutilizarse desde Home, Search y
 * Favorites cuando hagamos loading state granular.
 */
export function PropertyCardSkeleton({
  orientation = 'vertical',
  withCTA = false,
  className,
}: PropertyCardSkeletonProps) {
  const isHorizontal = orientation === 'horizontal';
  return (
    <article
      aria-hidden="true"
      className={cn(
        'overflow-hidden rounded-xl bg-surface shadow-card',
        isHorizontal
          ? 'flex h-full min-h-[180px] flex-row sm:min-h-[200px]'
          : 'flex h-full flex-col',
        className,
      )}
    >
      <div
        className={cn(
          'animate-pulse bg-surface-soft',
          isHorizontal ? 'w-2/5 shrink-0' : 'aspect-[4/3] w-full',
        )}
      />
      <div className={cn('flex flex-grow flex-col gap-3 p-4', isHorizontal && 'min-w-0 flex-1')}>
        <div className="h-5 w-1/3 animate-pulse rounded bg-surface-soft" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-surface-soft" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-surface-soft" />
        <div className="mt-auto flex items-center gap-3 border-t border-divider-soft pt-3">
          <div className="h-3 w-10 animate-pulse rounded bg-surface-soft" />
          <div className="h-3 w-10 animate-pulse rounded bg-surface-soft" />
          <div className="h-3 w-14 animate-pulse rounded bg-surface-soft" />
        </div>
        {withCTA && (
          <div className="mt-1 border-t border-divider-soft pt-3">
            <div className="h-9 w-full animate-pulse rounded bg-surface-soft" />
          </div>
        )}
      </div>
    </article>
  );
}
