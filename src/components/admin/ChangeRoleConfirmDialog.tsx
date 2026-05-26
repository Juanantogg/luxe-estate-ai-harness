'use client';

import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';
import { Button, IconButton } from '@/components/ui';
import { changeRole, reactivateUser, suspendUser } from '@/lib/admin/actions';
import type { AssignableRole } from '@/lib/admin/schemas';
import type { UserRole } from '@/lib/admin/queries';
import { cn } from '@/lib/utils/cn';

const ROLE_LABEL: Record<UserRole, string> = {
  user: 'Usuario',
  agent: 'Agente',
  broker: 'Broker',
  admin: 'Administrador',
};

export type ChangeRoleDialogAction =
  | { kind: 'set_role'; nextRole: AssignableRole; currentRole: UserRole }
  | { kind: 'suspend' }
  | { kind: 'reactivate'; currentRole: UserRole };

export interface ChangeRoleConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userDisplayName: string;
  action: ChangeRoleDialogAction;
}

/**
 * Modal de confirmación para los 3 flujos de mutación: cambiar rol,
 * suspender, reactivar. Patrón propio (sin Radix): focus trap, Escape,
 * click-outside, focus initial en "Cancelar" (no en destructivo).
 *
 * `useTransition` envuelve la action correspondiente. Errores se pintan
 * inline (`text-danger`). En éxito el dialog cierra y la lista se
 * revalida via `revalidatePath` desde la Server Action.
 */
export function ChangeRoleConfirmDialog({
  open,
  onClose,
  userId,
  userDisplayName,
  action,
}: ChangeRoleConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const headingId = useId();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    if (isPending) return;
    onClose();
  }, [isPending, onClose]);

  // No necesitamos `useEffect` para resetear el error: el padre solo monta
  // este componente cuando hay `dialogAction`, así que un nuevo intento
  // siempre arranca desde un mount fresco con `error === null`.

  // Scroll lock + Escape + focus trap.
  useEffect(() => {
    if (!open) return;

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

  if (!open) return null;

  // --- Copy por kind ---
  let title: string;
  let body: React.ReactNode;
  let confirmLabel: string;
  let confirmVariant: 'primary' | 'danger' = 'primary';
  let confirmIcon: string | undefined;

  if (action.kind === 'set_role') {
    title = `Cambiar rol de ${userDisplayName}`;
    body = (
      <>
        El rol pasará de{' '}
        <span className="font-medium text-on-surface">{ROLE_LABEL[action.currentRole]}</span> a{' '}
        <span className="font-medium text-on-surface">{ROLE_LABEL[action.nextRole]}</span>. El
        usuario recibirá una notificación.
      </>
    );
    confirmLabel = 'Confirmar cambio';
  } else if (action.kind === 'suspend') {
    title = `Suspender a ${userDisplayName}`;
    body = (
      <>
        El usuario no podrá realizar acciones (subir propiedades, agendar visitas).{' '}
        <span className="font-medium text-on-surface">Se cerrará su sesión inmediatamente.</span>
      </>
    );
    confirmLabel = 'Suspender';
    confirmVariant = 'danger';
    confirmIcon = 'block';
  } else {
    title = `Reactivar a ${userDisplayName}`;
    body = (
      <>
        El usuario recuperará el acceso completo de su rol actual (
        <span className="font-medium text-on-surface">{ROLE_LABEL[action.currentRole]}</span>).
      </>
    );
    confirmLabel = 'Reactivar';
    confirmIcon = 'restart_alt';
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      let result;
      if (action.kind === 'set_role') {
        result = await changeRole({ targetUserId: userId, nextRole: action.nextRole });
      } else if (action.kind === 'suspend') {
        result = await suspendUser({ targetUserId: userId });
      } else {
        result = await reactivateUser({ targetUserId: userId });
      }
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onClose();
    });
  }

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
          'rounded-t-xl md:my-auto md:max-w-md md:rounded-xl',
          'duration-200 animate-in slide-in-from-bottom md:fade-in md:zoom-in-95',
        )}
      >
        <header className="flex items-center justify-between border-b border-divider-soft px-6 py-4">
          <h2 id={headingId} className="text-lg font-bold tracking-tight text-on-surface">
            {title}
          </h2>
          <IconButton
            icon="close"
            variant="ghost"
            size="sm"
            aria-label="Cerrar diálogo"
            onClick={close}
            disabled={isPending}
          />
        </header>

        <div className="flex-1 px-6 py-5">
          <p className="text-sm leading-relaxed text-on-surface">{body}</p>
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
            variant={confirmVariant}
            size="md"
            leadingIcon={confirmIcon}
            onClick={handleConfirm}
            loading={isPending}
          >
            {confirmLabel}
          </Button>
        </footer>
      </div>
    </div>
  );
}
