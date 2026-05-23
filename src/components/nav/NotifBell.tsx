import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

export interface NotifBellProps {
  /** Cantidad de notificaciones sin leer para el user actual. */
  unreadCount: number;
  className?: string;
}

/**
 * Botón de notificaciones del TopNav. Muestra una campana y, si hay
 * notificaciones sin leer, un dot rojo absoluto (sin número visible — eso
 * lo añadirá la feature `notifications_dropdown` que también convertirá
 * este botón en disparador del panel).
 *
 * Render puro: en esta feature el botón es no-op (no abre ningún panel).
 */
export function NotifBell({ unreadCount, className }: NotifBellProps) {
  const hasUnread = unreadCount > 0;
  const ariaLabel = hasUnread ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones';

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex h-10 w-10 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-primary-soft hover:text-primary',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
        className,
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
  );
}
