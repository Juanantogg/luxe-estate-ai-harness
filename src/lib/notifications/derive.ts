import type { NotificationBucket, NotificationRow, NotificationType } from './types';

/**
 * Mapeo `notification_type → icono Material Icons` (spec §6.5).
 * Implementado como objeto estático para evitar `switch` y mantenerlo puro.
 */
const ICON_BY_TYPE: Record<NotificationType, string> = {
  new_property: 'home',
  visit_confirmed: 'event_available',
  visit_reminder: 'notifications_active',
  new_message: 'chat_bubble',
  price_drop: 'trending_down',
  favorite_update: 'favorite',
  system: 'info',
};

/**
 * Devuelve el nombre del icono para un tipo de notificación.
 */
export function getNotificationIcon(type: NotificationType): string {
  return ICON_BY_TYPE[type] ?? 'info';
}

/**
 * Devuelve el href destino de la notificación o `null` si no aplica
 * (spec §6.6).
 *
 * Casos sin destino útil:
 * - `system`: no tiene FK canónica.
 * - `new_message`: la ruta `/messages/[id]` no existe todavía (R1). Cuando
 *   se materialice la feature de mensajería, devolver
 *   `row.conversation_id ? \`/messages/${row.conversation_id}\` : null`.
 *
 * Cuando devuelve `null`, el click solo dispara `markAsRead` sin navegar.
 */
export function getNotificationHref(row: NotificationRow): string | null {
  switch (row.type) {
    case 'new_property':
    case 'price_drop':
    case 'favorite_update':
      return row.property_id ? `/property/${row.property_id}` : null;

    case 'visit_confirmed':
    case 'visit_reminder':
      return row.visit_id ? '/profile?tab=visits' : null;

    case 'new_message':
      // TODO(messages_screen): cuando exista `/messages/[id]`, devolver
      // `row.conversation_id ? \`/messages/${row.conversation_id}\` : null`.
      // Mientras tanto el click solo marca como leído (R1).
      return null;

    case 'system':
      return null;

    default:
      return null;
  }
}

/**
 * Devuelve el bucket visual según la antigüedad de `createdAt` respecto a
 * `now` (zona local del browser).
 *
 * Reglas (spec §6.4):
 * - `today`: misma fecha calendario que `now`.
 * - `week`: dentro de los últimos 7 días (calculado desde el inicio del
 *   día de `now`) pero no hoy.
 * - `older`: el resto.
 */
export function getNotificationBucket(createdAt: string | Date, now: Date): NotificationBucket {
  const target = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  if (Number.isNaN(target.getTime())) return 'older';

  // Inicio del día de `now` (local).
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (target.getTime() >= startOfToday.getTime()) return 'today';

  // Hace 7 días desde el inicio de hoy (cubre los 6 días previos + hoy).
  const sevenDaysAgo = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  if (target.getTime() >= sevenDaysAgo.getTime()) return 'week';

  return 'older';
}
