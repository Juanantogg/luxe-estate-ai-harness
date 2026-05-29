'use client';

import { useRouter } from 'next/navigation';
import { useOptimistic, useTransition } from 'react';
import { Icon } from '@/components/ui';
import { toggleFavorite } from '@/lib/properties/actions';
import { cn } from '@/lib/utils/cn';

export interface FavoriteButtonProps {
  propertyId: string;
  initialIsFavorite: boolean;
  /** Si false, el click redirige a `/login?next=...` sin invocar al server. */
  isAuthenticated: boolean;
  /**
   * Path destino tras login cuando el visitante es anónimo. Default `/`
   * para listados; el detalle de propiedad pasa `/property/[slug]` para que
   * el usuario vuelva al mismo lugar tras autenticarse.
   */
  redirectNext?: string;
  /** `md` para variant compact, `lg` para variant featured. */
  size?: 'md' | 'lg';
  className?: string;
}

/**
 * Botón corazón con optimistic UI. Vive sobre `PropertyCard` con `z-20` para
 * quedar encima del `<Link>` absoluto (z-10) que cubre la card; usa
 * `e.preventDefault()` + `e.stopPropagation()` para que el click no propague
 * a la navegación del card.
 */
export function FavoriteButton({
  propertyId,
  initialIsFavorite,
  isAuthenticated,
  redirectNext = '/',
  size = 'md',
  className,
}: FavoriteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(initialIsFavorite);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(redirectNext)}`);
      return;
    }

    startTransition(async () => {
      setOptimistic(!optimistic);
      const result = await toggleFavorite({ propertyId });
      if (!result.ok) {
        // El optimistic se resetea al re-renderizar el padre tras
        // `revalidatePath`. Para errores que no revalidan (ej. servidor),
        // logueamos.
        // TODO(toast): reemplazar por componente Toast cuando exista (decidido en spec §5.1).
        console.error('[FavoriteButton]', result.error.message);
      }
    });
  };

  const ariaLabel = !isAuthenticated
    ? 'Inicia sesión para guardar'
    : optimistic
      ? 'Quitar de favoritos'
      : 'Guardar en favoritos';

  const iconName = optimistic ? 'favorite' : 'favorite_border';
  const sizeClasses = size === 'lg' ? 'h-10 w-10' : 'h-9 w-9';
  const iconSize = size === 'lg' ? 'md' : 'sm';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isAuthenticated ? optimistic : undefined}
      aria-label={ariaLabel}
      disabled={isPending}
      className={cn(
        'inline-flex items-center justify-center rounded-full backdrop-blur-sm transition-all',
        'bg-surface/90 text-on-surface hover:bg-primary hover:text-on-primary',
        optimistic && 'bg-primary text-on-primary',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
        'disabled:opacity-70',
        sizeClasses,
        className,
      )}
    >
      <Icon name={iconName} size={iconSize} />
    </button>
  );
}
