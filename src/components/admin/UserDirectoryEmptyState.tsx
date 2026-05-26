import Link from 'next/link';
import { Icon } from '@/components/ui';

export interface UserDirectoryEmptyStateProps {
  reason: 'no_users' | 'no_matches';
}

/**
 * Empty state del directorio. Dos razones:
 *  - `no_users`: la plataforma no tiene profiles registrados.
 *  - `no_matches`: hay profiles pero ninguno cumple los filtros activos.
 *    Incluye link para limpiar filtros.
 */
export function UserDirectoryEmptyState({ reason }: UserDirectoryEmptyStateProps) {
  if (reason === 'no_users') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-divider bg-neutral-50 px-6 py-16 text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary"
          aria-hidden="true"
        >
          <Icon name="group" size="lg" />
        </div>
        <h2 className="text-base font-semibold text-on-surface">
          Aún no hay usuarios registrados.
        </h2>
        <p className="text-sm text-muted">
          Cuando alguien se registre o aceptes una invitación, aparecerá acá.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-divider bg-neutral-50 px-6 py-16 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary"
        aria-hidden="true"
      >
        <Icon name="person_search" size="lg" />
      </div>
      <h2 className="text-base font-semibold text-on-surface">
        No encontramos usuarios con los filtros aplicados.
      </h2>
      <Link
        href="/admin/users"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Limpiar filtros
      </Link>
    </div>
  );
}
