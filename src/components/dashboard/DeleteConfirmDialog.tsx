'use client';

import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';
import { Button, IconButton } from '@/components/ui';
import { archiveProperty } from '@/lib/properties/actions';
import type { PendingVisitForDialog } from '@/lib/visits/actions';
import { cn } from '@/lib/utils/cn';
import { PendingVisitRow } from './PendingVisitRow';

export interface DeleteConfirmDialogProps {
  propertyId: string;
  propertyTitle: string;
  pendingVisits: PendingVisitForDialog[] | null; // null = aún cargando
  loadingPending: boolean;
  onClose: () => void;
  onArchived: () => void;
  /**
   * Callback que el dialog usa para sacar visualmente una visit cancelada
   * del array que vive en el componente padre.
   */
  onVisitCancelled: (visitId: string) => void;
}

/**
 * Diálogo modal accesible para archivar una propiedad.
 *
 * Dos modos según `pendingVisits`:
 *  - Modo "bloqueado" (`pendingVisits.length > 0`): muestra el listado de
 *    `PendingVisitRow` con botón de cancelar cada una. El botón "Archivar"
 *    NO aparece.
 *  - Modo "simple" (`pendingVisits.length === 0`): copy "Archivar X" +
 *    botones Cancelar/Archivar.
 *
 * Cuando `pendingVisits` es `null` mostramos skeleton (2 filas).
 *
 * A11y: focus trap propio (mismo patrón que `FiltersModal`), Escape cierra,
 * focus al close button al montar, devuelve foco al trigger al desmontar.
 */
export function DeleteConfirmDialog({
  propertyId,
  propertyTitle,
  pendingVisits,
  loadingPending,
  onClose,
  onArchived,
  onVisitCancelled,
}: DeleteConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const headingId = useId();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  // Scroll lock + Escape + focus trap + focus management.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function getFocusable(): HTMLElement[] {
      if (!panelRef.current) return [];
      return Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === 'Tab') {
        const items = getFocusable();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKey);
    const rafId = requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [close]);

  function handleArchive() {
    setError(null);
    startTransition(async () => {
      const result = await archiveProperty({ id: propertyId });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onArchived();
    });
  }

  const isBlocked = pendingVisits != null && pendingVisits.length > 0;
  const isLoading = pendingVisits === null || loadingPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={close}
        className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm duration-200 animate-in fade-in"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={cn(
          'relative flex max-h-[90vh] w-full flex-col bg-surface text-on-surface shadow-soft-hover',
          'rounded-t-xl md:my-auto md:max-w-lg md:rounded-xl',
          'duration-200 animate-in slide-in-from-bottom md:fade-in md:zoom-in-95',
        )}
      >
        <header className="flex items-center justify-between border-b border-divider-soft px-6 py-4">
          <h2 id={headingId} className="text-lg font-semibold tracking-tight text-on-surface">
            {isBlocked ? 'No podés archivar todavía' : `Archivar "${propertyTitle}"`}
          </h2>
          <IconButton
            ref={closeButtonRef}
            icon="close"
            variant="ghost"
            size="sm"
            aria-label="Cerrar diálogo"
            onClick={close}
          />
        </header>

        <div className="hide-scroll flex-1 overflow-y-auto px-6 py-5">
          {isLoading && pendingVisits === null && (
            <>
              <p className="text-sm text-muted">Verificando visitas pendientes…</p>
              <div className="mt-4 space-y-3" aria-hidden="true">
                <div className="h-12 animate-pulse rounded bg-neutral-100" />
                <div className="h-12 animate-pulse rounded bg-neutral-100" />
              </div>
            </>
          )}

          {!isLoading && isBlocked && pendingVisits && (
            <>
              <p className="text-sm text-muted">
                Hay <span className="font-medium text-on-surface">{pendingVisits.length}</span>{' '}
                {pendingVisits.length === 1 ? 'visita pendiente' : 'visitas pendientes'} para{' '}
                <span className="font-medium text-on-surface">&quot;{propertyTitle}&quot;</span>.
                Cancela cada una para poder archivar la propiedad.
              </p>
              <ul className="mt-4 flex flex-col">
                {pendingVisits.map((visit) => (
                  <PendingVisitRow key={visit.id} visit={visit} onCancelled={onVisitCancelled} />
                ))}
              </ul>
            </>
          )}

          {!isLoading && !isBlocked && pendingVisits != null && (
            <p className="text-sm text-muted">
              La propiedad dejará de listarse y desaparecerá del público. Puedes restaurarla más
              tarde desde el dashboard activando &quot;Ver archivadas&quot;.
            </p>
          )}

          {error && (
            <p className="mt-3 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-divider-soft px-6 py-4">
          {isBlocked ? (
            <Button variant="ghost" size="md" onClick={close}>
              Cerrar
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="md" onClick={close} disabled={isPending}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="md"
                leadingIcon="delete_outline"
                onClick={handleArchive}
                loading={isPending}
                disabled={isLoading}
              >
                Archivar
              </Button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
