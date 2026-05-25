'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

export type FavoritesViewValue = 'grid' | 'list';

export interface FavoritesViewToggleProps {
  current: FavoritesViewValue;
  className?: string;
}

const OPTIONS: ReadonlyArray<{
  value: FavoritesViewValue;
  icon: string;
  label: string;
}> = [
  { value: 'grid', icon: 'grid_view', label: 'Vista en cuadrícula' },
  { value: 'list', icon: 'view_list', label: 'Vista en lista' },
] as const;

/**
 * Toggle segmentado para alternar entre `?view=grid` y `?view=list` en
 * `/favorites`. Persistencia vía searchParam (sin cookie — la pantalla es
 * única y un bookmark sigue compartible).
 */
export function FavoritesViewToggle({ current, className }: FavoritesViewToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleClick = (value: FavoritesViewValue) => {
    if (value === current) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'grid') {
      params.delete('view');
    } else {
      params.set('view', value);
    }
    const qs = params.toString();
    router.replace(qs ? `/favorites?${qs}` : '/favorites', { scroll: false });
  };

  return (
    <div
      role="group"
      aria-label="Cambiar vista"
      className={cn('inline-flex items-center gap-1 rounded bg-surface p-1 shadow-card', className)}
    >
      {OPTIONS.map((option) => {
        const isActive = current === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleClick(option.value)}
            aria-pressed={isActive}
            aria-label={option.label}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded transition-colors',
              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
              isActive ? 'bg-surface-soft text-primary' : 'text-muted hover:text-on-surface/70',
            )}
          >
            <Icon name={option.icon} size="md" />
          </button>
        );
      })}
    </div>
  );
}
