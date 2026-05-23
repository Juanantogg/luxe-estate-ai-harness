'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

type Listing = 'all' | 'sale' | 'rent';

const OPTIONS: Array<{ value: Listing; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'sale', label: 'Comprar' },
  { value: 'rent', label: 'Rentar' },
];

export interface ListingTypeToggleProps {
  className?: string;
}

/**
 * Toggle segmentado de Buy/Rent. Client Component porque preserva el resto de
 * searchParams (`?type=`, `?limit=`) y usa `router.replace({ scroll: false })`
 * para no saltar al top en cada cambio. Implementar como `<Link>` requeriría
 * concatenar URLs y haría perder el active state instantáneo.
 */
export function ListingTypeToggle({ className }: ListingTypeToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentRaw = searchParams.get('listing');
  const current: Listing = currentRaw === 'rent' ? 'rent' : currentRaw === 'sale' ? 'sale' : 'all';

  const handleClick = (value: Listing) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete('listing');
    else params.set('listing', value);
    // Reset paginación al cambiar el filtro: si no, podrían quedar items
    // del set anterior visibles.
    params.delete('limit');
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : '/', { scroll: false });
  };

  return (
    <div
      role="group"
      aria-label="Filtrar por tipo de operación"
      className={cn('inline-flex items-center gap-1 rounded-lg bg-surface p-1', className)}
    >
      {OPTIONS.map((option) => {
        const isActive = current === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleClick(option.value)}
            aria-pressed={isActive}
            className={cn(
              'rounded px-4 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
              isActive
                ? 'bg-surface-inverse text-on-surface-inverse shadow-soft'
                : 'text-muted hover:text-on-surface',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
