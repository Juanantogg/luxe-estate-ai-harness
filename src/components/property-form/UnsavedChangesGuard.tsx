'use client';

import { useEffect } from 'react';

export interface UnsavedChangesGuardProps {
  /** Si está activo, el browser muestra el dialog nativo al cerrar/recargar la pestaña. */
  isDirty: boolean;
}

/**
 * Listener `beforeunload` que evita perder cambios al cerrar la pestaña o
 * recargar (spec §11 R6). Para navegación SPA interna no hay equivalente
 * en Next 16 App Router; el agente puede usar "Save Draft" como red de
 * seguridad.
 */
export function UnsavedChangesGuard({ isDirty }: UnsavedChangesGuardProps) {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome requiere setear returnValue para que aparezca el dialog
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [isDirty]);

  return null;
}
