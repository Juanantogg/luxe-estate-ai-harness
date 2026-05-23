'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { Badge, Icon } from '@/components/ui';
import { countActiveFilters, parseFilterParams } from '@/lib/search/filter-params';
import { cn } from '@/lib/utils/cn';
import { FiltersModal } from './FiltersModal';

/**
 * Trigger del modal de filtros. Renderiza un botón "Filtros" con el icono
 * `tune` y, si hay filtros activos en la URL actual, un badge con el count.
 *
 * Reemplaza el `<Link href="/search?filters=open">` anterior del
 * `PropertyTypeChips`. Vive en cualquier página pública (home, /search).
 *
 * Al hacer click, abre `<FiltersModal>` localmente sin tocar la URL. El modal
 * navega a `/search?...` al aplicar filtros.
 */
export function FiltersTrigger() {
  const searchParams = useSearchParams();

  const activeCount = useMemo(() => {
    const sp: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      sp[key] = value;
    });
    const filters = parseFilterParams(sp);
    return countActiveFilters(filters);
  }, [searchParams]);

  return (
    <FiltersModal
      renderTrigger={({ open }) => (
        <button
          type="button"
          onClick={open}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium text-on-surface transition-colors hover:bg-primary-soft hover:text-primary',
            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
          )}
        >
          <Icon name="tune" size="sm" />
          Filtros
          {activeCount > 0 && (
            <Badge variant="primary" size="sm" aria-label={`${activeCount} filtros activos`}>
              {activeCount}
            </Badge>
          )}
        </button>
      )}
    />
  );
}
