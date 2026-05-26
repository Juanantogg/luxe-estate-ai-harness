import Link from 'next/link';
import { Button } from '@/components/ui';

const NUMBER_FORMATTER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

export interface DashboardPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  /**
   * SearchParams actuales de la página. Se preservan al cambiar de página
   * (filtros, archived, etc.).
   */
  currentSearchParams: Record<string, string>;
  /** Base URL al que apuntan los links (típicamente `/dashboard`). */
  baseHref?: string;
}

function buildHref(baseHref: string, params: Record<string, string>, pageOverride: number): string {
  const next = new URLSearchParams(params);
  next.set('page', String(pageOverride));
  const qs = next.toString();
  return qs ? `${baseHref}?${qs}` : baseHref;
}

/**
 * Footer de paginación de la tabla. Renderiza copy "Mostrando X a Y de Z
 * resultados" + dos botones "Anterior" / "Siguiente".
 *
 * Server Component que envuelve los Buttons en `<Link>` cuando aplican
 * (page > 1, page * pageSize < total). Cuando un extremo no aplica,
 * renderiza el Button con `disabled` sin Link.
 *
 * Si `total === 0` el componente padre debe evitar montar este componente
 * (no aplica paginación).
 */
export function DashboardPagination({
  page,
  pageSize,
  total,
  currentSearchParams,
  baseHref = '/dashboard',
}: DashboardPaginationProps) {
  const from = Math.min((page - 1) * pageSize + 1, total);
  const to = Math.min(page * pageSize, total);

  const hasPrev = page > 1;
  const hasNext = page * pageSize < total;

  const prevHref = buildHref(baseHref, currentSearchParams, page - 1);
  const nextHref = buildHref(baseHref, currentSearchParams, page + 1);

  return (
    <nav
      aria-label="Paginación"
      className="flex flex-col gap-3 border-t border-divider-soft bg-neutral-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
    >
      <p className="text-sm text-muted">
        Mostrando{' '}
        <span className="font-medium text-on-surface">{NUMBER_FORMATTER.format(from)}</span> a{' '}
        <span className="font-medium text-on-surface">{NUMBER_FORMATTER.format(to)}</span> de{' '}
        <span className="font-medium text-on-surface">{NUMBER_FORMATTER.format(total)}</span>{' '}
        resultados
      </p>
      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link href={prevHref}>
            <Button variant="secondary" size="sm" leadingIcon="chevron_left" tabIndex={-1}>
              Anterior
            </Button>
          </Link>
        ) : (
          <Button variant="secondary" size="sm" leadingIcon="chevron_left" disabled>
            Anterior
          </Button>
        )}
        {hasNext ? (
          <Link href={nextHref}>
            <Button variant="secondary" size="sm" trailingIcon="chevron_right" tabIndex={-1}>
              Siguiente
            </Button>
          </Link>
        ) : (
          <Button variant="secondary" size="sm" trailingIcon="chevron_right" disabled>
            Siguiente
          </Button>
        )}
      </div>
    </nav>
  );
}
