'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

export type FavoritesSortValue = 'date_desc' | 'price_asc' | 'price_desc';

const OPTIONS: ReadonlyArray<{ value: FavoritesSortValue; label: string }> = [
  { value: 'date_desc', label: 'Más recientes' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
] as const;

export interface FavoritesSortDropdownProps {
  current: FavoritesSortValue;
  className?: string;
}

/**
 * Dropdown nativo (`<select>` estilizado) con las 3 opciones de orden
 * para `/favorites`. Al cambiar, sincroniza el searchParam `?sort=` y
 * navega vía `router.replace({ scroll: false })` para no perder el
 * scroll de la grilla.
 *
 * `<select>` nativo en lugar de popover custom: solución más accesible,
 * consistente con `ListingTypeToggle`, y sin dependencias externas.
 */
export function FavoritesSortDropdown({ current, className }: FavoritesSortDropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as FavoritesSortValue;
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'date_desc') {
      params.delete('sort');
    } else {
      params.set('sort', next);
    }
    const qs = params.toString();
    router.replace(qs ? `/favorites?${qs}` : '/favorites', { scroll: false });
  };

  return (
    <div className={cn('relative', className)}>
      <label htmlFor="favorites-sort" className="sr-only">
        Ordenar favoritos
      </label>
      <select
        id="favorites-sort"
        value={current}
        onChange={handleChange}
        aria-label="Ordenar favoritos"
        className={cn(
          'appearance-none rounded bg-surface px-4 py-2.5 pr-10 text-sm font-medium text-on-surface',
          'border border-transparent shadow-card transition-colors hover:border-primary/30',
          'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
        )}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            Ordenar por: {option.label}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-on-surface/70"
        aria-hidden="true"
      >
        <Icon name="keyboard_arrow_down" size="md" />
      </span>
    </div>
  );
}
