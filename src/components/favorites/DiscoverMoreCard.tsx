import Link from 'next/link';
import { Button, Icon } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

export interface DiscoverMoreCardProps {
  className?: string;
}

/**
 * Tarjeta "empty-state-soft" que se renderiza como último item del grid de
 * favoritos cuando hay al menos uno guardado. Borde discontinuo verde + CTA
 * primary que enlaza a `/`. Sirve para invitar a seguir navegando sin que
 * la pantalla quede "terminada".
 */
export function DiscoverMoreCard({ className }: DiscoverMoreCardProps) {
  return (
    <article
      className={cn(
        'group relative flex h-full min-h-[280px] flex-col items-center justify-center',
        'rounded-xl border-2 border-dashed border-primary/30 bg-surface-soft p-6 text-center',
        'transition-colors duration-300 hover:border-primary',
        'focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2',
        className,
      )}
    >
      <Link
        href="/"
        aria-label="Descubre más propiedades en la home"
        className="absolute inset-0 z-10 rounded-xl focus:outline-none"
      >
        <span className="sr-only">Descubre más propiedades</span>
      </Link>
      <div
        className={cn(
          'flex h-16 w-16 items-center justify-center rounded-full bg-surface text-primary',
          'transition-transform duration-300 group-hover:scale-110',
        )}
      >
        <Icon name="add" size="xl" />
      </div>
      <h3 className="mt-4 text-xl font-medium text-on-surface">Descubre más</h3>
      <p className="mt-2 max-w-[200px] text-sm text-muted">
        Encuentra más propiedades que se ajusten a tu estilo de vida.
      </p>
      <div className="mt-6">
        {/*
          El Link overlay (z-10) ya hace navegable toda la card. Pintamos
          aquí un CTA visual decorativo: NO debe recibir foco propio
          (tabIndex=-1) ni anunciarse como segundo botón al lector de
          pantalla — el Link ya tiene aria-label descriptivo arriba.
        */}
        <Button
          variant="primary"
          size="sm"
          tabIndex={-1}
          trailingIcon="arrow_forward"
          aria-hidden="true"
        >
          Explorar propiedades
        </Button>
      </div>
    </article>
  );
}
