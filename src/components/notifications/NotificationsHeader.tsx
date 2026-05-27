'use client';

import { cn } from '@/lib/utils/cn';

export interface NotificationsHeaderProps {
  /** Cantidad de notificaciones sin leer (controla habilitación del botón). */
  unreadCount: number;
  /** Callback al click en "Marcar todas como leídas". */
  onMarkAll: () => void;
  /** True mientras la action `markAllAsRead` está en curso. */
  isMarkingAll: boolean;
  /** ref para auto-focus al abrir el panel. */
  markAllRef?: React.RefObject<HTMLButtonElement | null>;
}

/**
 * Header del dropdown de notificaciones (spec §5.3). Sticky para que el
 * botón "Marcar todas" se mantenga accesible mientras el user scrollea la
 * lista.
 */
export function NotificationsHeader({
  unreadCount,
  onMarkAll,
  isMarkingAll,
  markAllRef,
}: NotificationsHeaderProps) {
  const disabled = unreadCount === 0 || isMarkingAll;

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-divider bg-surface px-4 py-3">
      <h2 id="notifications-title" className="text-base font-semibold text-on-surface">
        Notificaciones
      </h2>
      <button
        ref={markAllRef}
        type="button"
        onClick={onMarkAll}
        disabled={disabled}
        className={cn(
          'rounded px-1 text-sm font-medium transition-colors',
          'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
          disabled ? 'cursor-not-allowed text-muted' : 'text-primary hover:text-primary-hover',
        )}
      >
        Marcar todas como leídas
      </button>
    </header>
  );
}
