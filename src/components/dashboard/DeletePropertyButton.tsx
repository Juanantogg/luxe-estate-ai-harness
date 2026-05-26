'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconButton } from '@/components/ui';
import { getPendingVisitsForArchive, type PendingVisitForDialog } from '@/lib/visits/actions';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

export interface DeletePropertyButtonProps {
  propertyId: string;
  propertyTitle: string;
}

/**
 * Botón "Archivar" (icono delete_outline) que abre el confirm dialog.
 *
 * Flujo (spec §"Componentes > DeletePropertyButton"):
 *  1. Click → abre dialog en estado loading.
 *  2. Llama a `getPendingVisitsForArchive` (Server Action) para leer las
 *     visits pendientes futuras.
 *  3. El dialog decide modo "bloqueado" (visits > 0) vs "simple" (0).
 *  4. En modo bloqueado, cada `PendingVisitRow` puede cancelar
 *     individualmente; el callback `onVisitCancelled` actualiza el
 *     array localmente (optimistic).
 *  5. Cuando la lista llega a 0, el dialog transiciona a modo simple y
 *     aparece el botón "Archivar".
 *  6. Al archivar exitoso, `router.refresh()` recarga la lista.
 */
export function DeletePropertyButton({ propertyId, propertyTitle }: DeletePropertyButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingVisits, setPendingVisits] = useState<PendingVisitForDialog[] | null>(null);
  const [loadingPending, setLoadingPending] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleOpen = useCallback(async () => {
    setOpen(true);
    setPendingVisits(null);
    setFetchError(null);
    setLoadingPending(true);
    const result = await getPendingVisitsForArchive({ propertyId });
    setLoadingPending(false);
    if (!result.ok) {
      setFetchError(result.error.message);
      // En caso de error de lectura, dejamos el dialog en modo "simple"
      // (sin lista de visits) — el server-side guard de archiveProperty
      // hará la última verificación cuando el agent confirme.
      setPendingVisits([]);
      return;
    }
    setPendingVisits(result.visits);
  }, [propertyId]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleArchived = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);

  const handleVisitCancelled = useCallback((visitId: string) => {
    setPendingVisits((prev) => (prev ? prev.filter((v) => v.id !== visitId) : prev));
    // No hacemos router.refresh aquí: el dialog sigue abierto y queremos
    // que el contador baje sin recargar la pantalla detrás. El refresh
    // ocurre al archivar exitoso (handleArchived).
  }, []);

  return (
    <>
      <IconButton
        icon="delete_outline"
        variant="ghost"
        size="md"
        aria-label={`Archivar ${propertyTitle}`}
        onClick={handleOpen}
        className="hover:bg-danger-soft hover:text-danger"
      />
      {open && (
        <DeleteConfirmDialog
          propertyId={propertyId}
          propertyTitle={propertyTitle}
          pendingVisits={fetchError ? [] : pendingVisits}
          loadingPending={loadingPending}
          onClose={handleClose}
          onArchived={handleArchived}
          onVisitCancelled={handleVisitCancelled}
        />
      )}
    </>
  );
}
