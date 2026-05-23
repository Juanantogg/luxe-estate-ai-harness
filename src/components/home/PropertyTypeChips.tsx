import Link from 'next/link';
import { FiltersTrigger } from '@/components/search';
import { Chip } from '@/components/ui';
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
 *
 * Al final de la fila va `FiltersTrigger`, que es un Client Component que
 * abre el modal de filtros completos (`<FiltersModal>`). Reemplaza al
 * `<Link href="/search?filters=open">` anterior para evitar un viaje
 * innecesario a `/search` cuando el usuario todavía no aplicó filtros.
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

      <FiltersTrigger />
    </div>
  );
}
