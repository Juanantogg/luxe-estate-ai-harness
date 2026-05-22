import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { Icon, type IconVariant } from './Icon';

export type IconButtonVariant = 'primary' | 'ghost' | 'soft' | 'inverse';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  icon: string;
  iconVariant?: IconVariant;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  loading?: boolean;
  'aria-label': string;
  className?: string;
}

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  ghost: 'text-on-surface hover:text-primary hover:bg-primary-soft',
  soft: 'bg-primary-soft text-primary hover:bg-primary hover:text-on-primary',
  inverse: 'bg-surface/90 text-on-surface hover:bg-primary hover:text-on-primary backdrop-blur-sm',
};

const SIZE_CLASSES: Record<IconButtonSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

const ICON_SIZE_MAP: Record<IconButtonSize, 'sm' | 'md' | 'lg'> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
};

/**
 * Botón circular que solo contiene un icono. Requiere `aria-label` para accesibilidad.
 * @example <IconButton icon="favorite_border" aria-label="Guardar" />
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon,
    iconVariant,
    variant = 'ghost',
    size = 'md',
    loading = false,
    disabled,
    className,
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
        'inline-flex items-center justify-center rounded-full transition-colors duration-200',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
        'active:scale-[0.98]',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Icon
          name="progress_activity"
          variant="outlined"
          size={iconSize}
          className="animate-spin"
        />
      ) : (
        <Icon name={icon} variant={iconVariant} size={iconSize} />
      )}
    </button>
  );
});
