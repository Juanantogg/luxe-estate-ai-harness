'use client';

import { useEffect } from 'react';
import { Button, Icon } from '@/components/ui';

/**
 * Error boundary del dashboard. Si las queries (stats / list) lanzan, este
 * componente lo captura y muestra una card con título + descripción +
 * botón "Reintentar" que invoca `reset`.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.warn('[dashboard] render error', error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-soft text-danger"
        aria-hidden="true"
      >
        <Icon name="error_outline" size="xl" />
      </div>
      <h2 className="text-xl font-bold text-on-surface">No pudimos cargar tu dashboard</h2>
      <p className="text-sm text-muted">
        Algo salió mal mientras leíamos tus propiedades. Reintenta en un momento; si persiste,
        avísanos.
      </p>
      <Button variant="primary" size="md" leadingIcon="refresh" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
