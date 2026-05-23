import Link from 'next/link';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

export interface EmptyPropertiesStateProps {
  /** True si el usuario tiene filtros aplicados (chips, listing toggle). */
  hasFilters: boolean;
}

/**
 * Empty state cuando "New in Market" devuelve cero. Distingue dos copys:
 * - con filtros: invita a limpiar.
 * - sin filtros (DB vacía): sólo informa.
 */
export function EmptyPropertiesState({ hasFilters }: EmptyPropertiesStateProps) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-surface-soft px-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface">
        <Icon name="apartment" size="xl" className="text-primary" aria-hidden />
      </div>
      <h3 className="mt-4 mb-2 text-xl font-medium text-on-surface">
        {hasFilters ? 'No encontramos propiedades' : 'Aún no hay propiedades publicadas'}
      </h3>
      <p className="mb-6 max-w-md text-sm text-muted">
        {hasFilters
          ? 'Probá quitar los filtros o explorar otra categoría.'
          : 'Vuelve pronto: nuestros agentes publican nuevas propiedades cada semana.'}
      </p>
      {hasFilters && (
        <Link
          href="/"
          className={cn(
            'inline-flex h-10 items-center justify-center rounded border border-outline px-4 py-2.5 text-sm font-medium text-on-surface transition-colors',
            'hover:border-primary hover:text-primary',
            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
          )}
        >
          Limpiar filtros
        </Link>
      )}
    </div>
  );
}
