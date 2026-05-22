import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export type IconVariant = 'material' | 'outlined';
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  variant?: IconVariant;
  size?: IconSize;
  className?: string;
}

const ICON_SIZE_MAP: Record<IconSize, string> = {
  xs: 'text-sm',
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
};

/**
 * Renderiza un glifo de Material Icons o Material Symbols Outlined.
 * @example <Icon name="favorite_border" size="md" aria-label="Favorito" />
 */
export const Icon = forwardRef<HTMLSpanElement, IconProps>(function Icon(
  { name, variant = 'material', size = 'md', className, 'aria-label': ariaLabel, ...rest },
  ref,
) {
  const fontClass = variant === 'outlined' ? 'material-symbols-outlined' : 'material-icons';
  const sizeClass = ICON_SIZE_MAP[size];
  return (
    <span
      ref={ref}
      className={cn(fontClass, sizeClass, 'leading-none select-none', className)}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
      {...rest}
    >
      {name}
    </span>
  );
});
