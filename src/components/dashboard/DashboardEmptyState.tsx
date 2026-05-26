import Link from 'next/link';
import { Button, Icon } from '@/components/ui';

/**
 * Empty state cuando el agent NO tiene ninguna propiedad. Renderiza en el
 * lugar de la tabla (sin sub-toolbar, sin paginación). Las stat cards
 * siguen siendo visibles con 0.
 */
export function DashboardEmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-divider bg-surface px-6 py-16 text-center shadow-card">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary"
        aria-hidden="true"
      >
        <Icon name="home_work" size="xl" />
      </div>
      <h2 className="text-xl font-bold text-on-surface">Aún no tienes propiedades</h2>
      <p className="max-w-md text-sm text-muted">
        Agrega tu primera propiedad para empezar a gestionar tu portafolio desde el dashboard.
      </p>
      <Link href="/dashboard/properties/new" className="mt-2">
        <Button variant="primary" size="md" leadingIcon="add" tabIndex={-1}>
          Agregar tu primera propiedad
        </Button>
      </Link>
    </div>
  );
}
