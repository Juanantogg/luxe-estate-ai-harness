import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

export interface UserStatusIndicatorProps {
  isActive: boolean;
  className?: string;
}

/**
 * Texto + icono que indica si el usuario está activo. MVP simple
 * (decisión §7 del spec): sin tracking real de presencia, solo deriva
 * de `profiles.is_active`.
 */
export function UserStatusIndicator({ isActive, className }: UserStatusIndicatorProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs',
        isActive ? 'text-muted' : 'text-muted',
        className,
      )}
    >
      <Icon
        name={isActive ? 'check_circle' : 'remove_circle_outline'}
        size="xs"
        className={isActive ? 'text-primary' : 'text-muted'}
      />
      <span>{isActive ? 'Activo' : 'Inactivo'}</span>
    </span>
  );
}
