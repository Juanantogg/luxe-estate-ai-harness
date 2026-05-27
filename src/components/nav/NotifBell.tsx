'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { NotificationsDropdown } from '@/components/notifications';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

export interface NotifBellProps {
  /** Cantidad de notificaciones sin leer para el user actual (snapshot SSR). */
  unreadCount: number;
  className?: string;
}

/**
 * Botón de notificaciones del TopNav (trigger + popover, post-feature
 * `notifications_dropdown`).
 *
 * Mantiene la firma original `(unreadCount, className)` para que el
 * `TopNav` (Server Component) lo monte exactamente igual que antes. La
 * prop `unreadCount` es el snapshot server-side; internamente se sincroniza
 * con `localUnreadCount` que el `NotificationsDropdown` actualiza vía
 * polling y acciones optimistas. El dot rojo se pinta con el conteo
 * local (no con la prop) para que el optimistic UI se vea de inmediato.
 *
 * Comportamiento:
 * - Click toggle `isOpen`.
 * - El panel se monta solo cuando `isOpen` (decisión §6.2: no se mantiene
 *   polling de fondo si está cerrado).
 * - Focus restore: al cerrar, el foco vuelve al botón (handled aquí con
 *   `triggerRef.current?.focus()` cuando pasa de open→closed).
 */
export function NotifBell({ unreadCount: initialUnreadCount, className }: NotifBellProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const [isOpen, setIsOpen] = useState(false);
  // Se sincroniza con la prop si el TopNav re-renderea con nuevo conteo
  // (p. ej. tras revalidatePath('/') por una action), pero también se
  // actualiza optimistically desde el dropdown.
  //
  // Patrón "derived state": en lugar de un useEffect que llame setState
  // (regla react-hooks/set-state-in-effect), comparamos la prop con un
  // marcador local y aplicamos `setLocalUnreadCount` durante el render.
  // React deduplica un setState llamado en render con el mismo valor de
  // estado, así que la condición evita loops.
  const [lastSeenInitial, setLastSeenInitial] = useState(initialUnreadCount);
  const [localUnreadCount, setLocalUnreadCount] = useState(initialUnreadCount);
  if (initialUnreadCount !== lastSeenInitial) {
    setLastSeenInitial(initialUnreadCount);
    setLocalUnreadCount(initialUnreadCount);
  }

  // Focus restore: al cerrar, devolver foco al trigger.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      triggerRef.current?.focus();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  const handleClose = () => setIsOpen(false);

  const hasUnread = localUnreadCount > 0;
  const ariaLabel = hasUnread ? `Notificaciones, ${localUnreadCount} sin leer` : 'Notificaciones';

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          'relative inline-flex h-10 w-10 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-primary-soft hover:text-primary',
          'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
        )}
      >
        <Icon name={hasUnread ? 'notifications' : 'notifications_none'} size="md" />
        {hasUnread && (
          <span
            aria-hidden="true"
            className="absolute top-2 right-2 inline-block h-2 w-2 rounded-full bg-danger ring-2 ring-background"
          />
        )}
      </button>

      {isOpen && (
        <NotificationsDropdown
          id={panelId}
          onClose={handleClose}
          initialUnreadCount={localUnreadCount}
          onUnreadCountChange={setLocalUnreadCount}
          triggerRef={triggerRef}
        />
      )}
    </div>
  );
}
