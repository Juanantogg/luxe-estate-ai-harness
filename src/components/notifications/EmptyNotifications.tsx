import { Icon } from '@/components/ui';

/**
 * Empty state del dropdown (spec §5.5). Componente puro presentacional
 * sin estado; se renderiza dentro del scrollable cuando `items.length === 0`
 * y el primer fetch ya completó.
 */
export function EmptyNotifications() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon name="notifications_off" size="lg" />
      </span>
      <p className="text-sm font-medium text-on-surface">No tienes notificaciones</p>
      <p className="text-xs text-muted">
        Cuando recibas avisos sobre tus propiedades favoritas o visitas, aparecerán aquí.
      </p>
    </div>
  );
}
