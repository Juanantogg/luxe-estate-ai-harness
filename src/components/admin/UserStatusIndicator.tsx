import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

/**
 * Estado visual del usuario en el directorio admin. Se deriva de
 * `profiles.invitation_status` + `profiles.is_active` vía `deriveUserStatus`.
 *
 *  - `'pending'`  → el usuario fue invitado pero todavía no confirmó email.
 *  - `'active'`   → usuario operativo (`is_active=true` AND
 *                   `invitation_status='accepted'`).
 *  - `'inactive'` → usuario suspendido por un admin (`is_active=false`).
 */
export type UserStatus = 'pending' | 'active' | 'inactive';

export interface UserStatusIndicatorProps {
  status: UserStatus;
  className?: string;
}

interface StatusVisual {
  icon: string;
  iconClass: string;
  label: string;
}

const STATUS_VISUAL: Record<UserStatus, StatusVisual> = {
  pending: {
    icon: 'mail_outline',
    iconClass: 'text-warning',
    label: 'Invitado pendiente',
  },
  active: {
    icon: 'check_circle',
    iconClass: 'text-primary',
    label: 'Activo',
  },
  inactive: {
    icon: 'remove_circle_outline',
    iconClass: 'text-muted',
    label: 'Inactivo',
  },
};

/**
 * Deriva el `UserStatus` visible desde las dos columnas de `profiles`.
 *
 * Prioridad: pending > inactive > active. Un user pending Y `is_active=false`
 * se ve como `'pending'`: si todavía no aceptó la invitación, "Inactivo"
 * carece de sentido — nunca tuvo acceso a perder.
 */
export function deriveUserStatus(row: {
  invitation_status: 'pending' | 'accepted';
  is_active: boolean;
}): UserStatus {
  if (row.invitation_status === 'pending') return 'pending';
  if (!row.is_active) return 'inactive';
  return 'active';
}

/**
 * Texto + icono que indica el estado del usuario. Soporta 3 estados con
 * iconos y colores distintos pero comparte tipografía `text-xs text-muted`
 * para mantener consistencia con el resto de metadatos de la fila.
 */
export function UserStatusIndicator({ status, className }: UserStatusIndicatorProps) {
  const visual = STATUS_VISUAL[status];
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-muted', className)}>
      <Icon name={visual.icon} size="xs" className={visual.iconClass} />
      <span>{visual.label}</span>
    </span>
  );
}
