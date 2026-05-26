'use client';

import { useEffect } from 'react';
import { Button, Icon } from '@/components/ui';

/**
 * Error boundary del directorio admin. No expone detalles internos al
 * usuario; los loguea en consola/observabilidad y ofrece reintento.
 */
export default function AdminUsersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin/users] error boundary:', error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6 lg:px-8">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger"
        aria-hidden="true"
      >
        <Icon name="error_outline" size="lg" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-on-surface">
        No pudimos cargar el directorio
      </h1>
      <p className="max-w-md text-sm text-muted">
        Algo salió mal al consultar la base de datos. Intenta de nuevo en unos segundos. Si el
        problema persiste, contacta al equipo técnico.
      </p>
      <Button variant="primary" size="md" leadingIcon="refresh" onClick={() => reset()}>
        Reintentar
      </Button>
    </div>
  );
}
