import { Badge, type BadgeVariant } from '@/components/ui';
import type { UserRole } from '@/lib/admin/queries';

export interface UserRoleBadgeProps {
  role: UserRole;
}

const ROLE_LABEL: Record<UserRole, string> = {
  user: 'Usuario',
  agent: 'Agente',
  broker: 'Broker',
  admin: 'Administrador',
};

const ROLE_VARIANT: Record<UserRole, BadgeVariant> = {
  user: 'neutral',
  agent: 'success',
  broker: 'neutral',
  admin: 'inverse',
};

/**
 * Badge con el rol actual del usuario. Mapeo `BadgeVariant` definido en §4
 * del spec: Admin=inverse (oscuro), Agent=success (hint-green), User y
 * Broker=neutral.
 */
export function UserRoleBadge({ role }: UserRoleBadgeProps) {
  return (
    <Badge variant={ROLE_VARIANT[role]} size="md">
      {ROLE_LABEL[role]}
    </Badge>
  );
}
