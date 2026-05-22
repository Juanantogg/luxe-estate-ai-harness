import { cn } from '@/lib/utils/cn';
import { Icon } from './Icon';

export type BadgeVariant =
  | 'primary'
  | 'inverse'
  | 'soft'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  leadingIcon?: string;
  withDot?: boolean;
  uppercase?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  primary: 'bg-primary text-on-primary',
  inverse: 'bg-surface-inverse text-on-surface-inverse',
  soft: 'bg-surface/90 text-on-surface backdrop-blur-sm',
  success: 'bg-surface-soft text-primary border border-primary/10',
  warning: 'bg-warning-soft text-warning border border-warning/20',
  danger: 'bg-danger-soft text-danger border border-danger/20',
  neutral: 'bg-neutral-100 text-muted border border-divider',
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px] font-semibold gap-1',
  md: 'px-2.5 py-1 text-xs font-medium gap-1.5',
};

/**
 * Etiqueta inline para estados o categorías; no es interactiva.
 * @example <Badge variant="warning" uppercase withDot>Pendiente</Badge>
 */
export function Badge({
  variant = 'primary',
  size = 'md',
  leadingIcon,
  withDot = false,
  uppercase = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        uppercase && 'tracking-wider uppercase',
        className,
      )}
      {...rest}
    >
      {withDot && (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
      )}
      {leadingIcon && <Icon name={leadingIcon} size="xs" />}
      {children}
    </span>
  );
}
