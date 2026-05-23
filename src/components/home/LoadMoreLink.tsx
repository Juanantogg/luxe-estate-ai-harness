import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

export interface LoadMoreLinkProps {
  /** searchParams actuales (se preservan). */
  currentParams: URLSearchParams;
  /** Limit actual (la página espera el clamp). */
  currentLimit: number;
  /** Cuánto agregar en cada click. Default 8. */
  step?: number;
}

/**
 * `<Link>` que aumenta `?limit=` en `step` y preserva el resto de params.
 * Apunta al anchor `#new-in-market`. Como `scroll={false}` no auto-saltea,
 * pero el URL queda shareable y respeta el back-button.
 */
export function LoadMoreLink({ currentParams, currentLimit, step = 8 }: LoadMoreLinkProps) {
  const params = new URLSearchParams(currentParams.toString());
  params.set('limit', String(currentLimit + step));
  const href = `/?${params.toString()}#new-in-market`;

  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        'inline-flex h-12 items-center justify-center rounded border border-outline px-6 py-3.5 text-base font-medium text-on-surface transition-colors',
        'hover:border-primary hover:text-primary',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
      )}
    >
      Cargar más propiedades
    </Link>
  );
}
