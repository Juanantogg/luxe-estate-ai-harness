'use client';

import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, IconButton } from '@/components/ui';
import { restoreProperty } from '@/lib/properties/actions';
import { cn } from '@/lib/utils/cn';

export interface RestorePropertyButtonProps {
  propertyId: string;
  propertyTitle: string;
}

/**
 * Botón "Restaurar" (icono `unarchive`) que abre un confirm dialog mini.
 *
 * No requiere guard de visits (la propiedad estaba archivada y sus visits
 * ya fueron canceladas antes del archivado).
 *
 * Decisión: la restauración siempre vuelve a `active` (no preservamos el
 * status previo — decisión R3/E2). Si el agent quiere dejarla en draft,
 * edita después.
 */
export function RestorePropertyButton({ propertyId, propertyTitle }: RestorePropertyButtonProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const headingId = useId();

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  // Focus trap + Escape + scroll lock cuando el dialog está abierto.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === 'Tab') {
        if (!panelRef.current) return;
        const items = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]'),
        );
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
    const rafId = requestAnimationFrame(() => cancelButtonRef.current?.focus());

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [open, close]);

  function handleRestore() {
    setError(null);
    startTransition(async () => {
      const result = await restoreProperty({ id: propertyId });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <IconButton
        ref={triggerRef}
        icon="unarchive"
        variant="ghost"
        size="md"
        aria-label={`Restaurar ${propertyTitle}`}
        onClick={() => setOpen(true)}
        className="hover:bg-primary-soft hover:text-primary"
      />

      {open && (
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
              'relative flex w-full flex-col bg-surface text-on-surface shadow-soft-hover',
              'rounded-t-xl md:my-auto md:max-w-md md:rounded-xl',
              'duration-200 animate-in slide-in-from-bottom md:fade-in md:zoom-in-95',
            )}
          >
            <header className="border-b border-divider-soft px-6 py-4">
              <h2 id={headingId} className="text-lg font-semibold tracking-tight text-on-surface">
                Restaurar &quot;{propertyTitle}&quot;
              </h2>
            </header>
            <div className="px-6 py-5">
              <p className="text-sm text-muted">
                Volverá a publicarse como Activa. Si quieres dejarla en borrador, edítala después de
                restaurar.
              </p>
              {error && (
                <p className="mt-3 text-sm text-danger" role="alert">
                  {error}
                </p>
              )}
            </div>
            <footer className="flex items-center justify-end gap-3 border-t border-divider-soft px-6 py-4">
              <Button
                ref={cancelButtonRef}
                variant="ghost"
                size="md"
                onClick={close}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="md"
                leadingIcon="unarchive"
                onClick={handleRestore}
                loading={isPending}
              >
                Restaurar
              </Button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
