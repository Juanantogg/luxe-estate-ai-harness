import Link from 'next/link';
import { Chip, Icon } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

const CHIPS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'house', label: 'Casa' },
  { value: 'apartment', label: 'Apartamento' },
  { value: 'villa', label: 'Villa' },
  { value: 'penthouse', label: 'Penthouse' },
];

export interface PropertyTypeChipsProps {
  /** Tipo activo según `?type=`. Default `all`. */
  current: string;
  /** searchParams crudos para preservarlos al hacer link a otro tipo. */
  preserveParams?: URLSearchParams;
}

/**
 * Fila de chips de filtro rápido por `property_type`. Cada chip es un `<Link>`
 * que reemplaza `?type=...` preservando los demás searchParams. El chip
 * activo lleva `aria-current="page"` y la variant `selected`. En mobile la
 * fila hace scroll horizontal con `hide-scroll` (utility en globals.css).
 */
export function PropertyTypeChips({ current, preserveParams }: PropertyTypeChipsProps) {
  const buildHref = (value: string) => {
    const params = new URLSearchParams(preserveParams?.toString() ?? '');
    if (value === 'all') params.delete('type');
    else params.set('type', value);
    params.delete('limit');
    const qs = params.toString();
    return qs ? `/?${qs}` : '/';
  };

  return (
    <div className="hide-scroll flex items-center justify-start gap-3 overflow-x-auto px-4 py-2 sm:justify-center md:overflow-visible">
      {CHIPS.map((chip) => {
        const isActive = current === chip.value;
        return (
          <Link
            key={chip.value}
            href={buildHref(chip.value)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-full',
              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
            )}
          >
            <Chip asStatic variant={isActive ? 'selected' : 'default'} size="md">
              {chip.label}
            </Chip>
          </Link>
        );
      })}

      <div className="mx-2 h-6 w-px shrink-0 bg-divider" aria-hidden />

      <Link
        href="/search?filters=open"
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium text-on-surface transition-colors hover:bg-primary-soft hover:text-primary',
          'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
        )}
      >
        <Icon name="tune" size="sm" />
        Filtros
      </Link>
    </div>
  );
}
