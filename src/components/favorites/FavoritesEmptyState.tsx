import Link from 'next/link';
import { Button, Icon } from '@/components/ui';

export type FavoritesEmptyReason = 'never_favorited' | 'all_unavailable';

export interface FavoritesEmptyStateProps {
  reason: FavoritesEmptyReason;
}

const COPY: Record<FavoritesEmptyReason, { heading: string; body: string }> = {
  never_favorited: {
    heading: 'Aún no guardaste propiedades',
    body: 'Toca el corazón en cualquier propiedad para tenerla aquí.',
  },
  all_unavailable: {
    heading: 'Tus favoritos no están disponibles',
    body: 'Las propiedades que guardaste fueron pausadas o eliminadas por sus dueños.',
  },
};

/**
 * Empty state para `/favorites`. Full-width, centrado, con CTA hacia la
 * home pública para que el usuario siga descubriendo propiedades.
 *
 * Distinto al `EmptyPropertiesState` de Home (que habla de "no encontramos
 * propiedades" tras filtros): aquí el foco es la lista personal del user.
 */
export function FavoritesEmptyState({ reason }: FavoritesEmptyStateProps) {
  const { heading, body } = COPY[reason];

  return (
    <section
      aria-labelledby="favorites-empty-heading"
      className="rounded-xl bg-surface-soft px-4 py-16 text-center"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface text-primary">
        <Icon name="favorite_border" size="xl" />
      </div>
      <h2 id="favorites-empty-heading" className="mt-6 text-xl font-medium text-on-surface">
        {heading}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
      <div className="mt-6 flex justify-center">
        <Link href="/" aria-label="Explorar propiedades en la home">
          <Button variant="primary" size="md" leadingIcon="search" tabIndex={-1}>
            Explorar propiedades
          </Button>
        </Link>
      </div>
    </section>
  );
}
