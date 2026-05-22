import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { Icon } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: string;
  trailingIcon?: string;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover shadow-soft',
  secondary:
    'bg-transparent text-on-surface border border-outline hover:border-primary hover:text-primary',
  ghost: 'bg-transparent text-on-surface hover:bg-primary-soft hover:text-primary',
  danger: 'bg-danger text-white hover:opacity-90',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 py-1.5 text-sm font-medium gap-1.5',
  md: 'h-10 px-4 py-2.5 text-sm font-medium gap-2',
  lg: 'h-12 px-6 py-3.5 text-base font-medium gap-2',
};

const ICON_SIZE_MAP: Record<ButtonSize, 'sm' | 'md' | 'lg'> = {
  sm: 'sm',
  md: 'sm',
  lg: 'md',
};

/**
 * Botón primitivo con variantes (primary/secondary/ghost/danger), tamaños y estados de carga.
 * @example <Button variant="primary" size="md" leadingIcon="add">Crear</Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    leadingIcon,
    trailingIcon,
    loading = false,
    fullWidth = false,
    className,
    disabled,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  const iconSize = ICON_SIZE_MAP[size];
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex items-center justify-center rounded transition-colors duration-200',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
        'active:scale-[0.98]',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center gap-[inherit]',
          loading && 'opacity-0',
        )}
      >
        {leadingIcon && <Icon name={leadingIcon} size={iconSize} />}
        {children}
        {trailingIcon && <Icon name={trailingIcon} size={iconSize} />}
      </span>
      {loading && (
        <span className="absolute inset-0 inline-flex items-center justify-center">
          <Icon
            name="progress_activity"
            variant="outlined"
            size={iconSize}
            className="animate-spin"
          />
        </span>
      )}
    </button>
  );
});
