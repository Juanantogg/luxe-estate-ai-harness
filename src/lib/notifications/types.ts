import type { Database } from '@/types/database';

/**
 * Tipos de notificaciones — derivados del enum DB `notification_type`.
 */
export type NotificationType = Database['public']['Enums']['notification_type'];

/**
 * Proyección de columnas usadas por el dropdown. Solo las que el panel
 * necesita renderear o derivar (icono, href). NO incluye `recipient_id`
 * porque el route handler ya filtra por user y exponer el id al cliente
 * no aporta.
 */
export interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  property_id: string | null;
  visit_id: string | null;
  conversation_id: string | null;
  read_at: string | null;
  created_at: string;
}

/**
 * Bucket visual del dropdown.
 * - `today`: misma fecha calendario que `now` (zona local del browser).
 * - `week`: en los últimos 7 días pero no hoy.
 * - `older`: más antiguas.
 */
export type NotificationBucket = 'today' | 'week' | 'older';

/**
 * Fila enriquecida con datos derivados para el render.
 * `href === null` significa que el item es clickeable (marca como leído)
 * pero no navega — caso de `system` y `new_message` (deuda /messages/[id]).
 */
export interface NotificationDisplay {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
  href: string | null;
  iconName: string;
  relativeTime: string;
  bucket: NotificationBucket;
}
