import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { Icon } from './Icon';

export type ChipVariant = 'default' | 'selected' | 'outline';
export type ChipSize = 'sm' | 'md';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ChipVariant;
  size?: ChipSize;
  leadingIcon?: string;
  trailingIcon?: string;
  asStatic?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<ChipVariant, string> = {
  default:
    'bg-surface border border-divider-soft text-muted hover:text-on-surface hover:border-primary',
  selected: 'bg-primary text-on-primary shadow-soft border border-transparent',
  outline:
    'bg-transparent border border-outline text-on-surface hover:bg-primary-soft hover:border-primary hover:text-primary',
};

const SIZE_CLASSES: Record<ChipSize, string> = {
  sm: 'px-3 py-1 text-xs font-medium gap-1',
  md: 'px-5 py-2 text-sm font-medium gap-1.5',
};

const ICON_SIZE_MAP: Record<ChipSize, 'xs' | 'sm'> = {
  sm: 'xs',
  md: 'sm',
};

/**
 * Pill seleccionable o decorativa para filtros y categorías; renderiza `<button>` o `<span>` con `asStatic`.
 * @example <Chip variant="selected" size="md" leadingIcon="check">Todos</Chip>
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  {
    variant = 'default',
    size = 'md',
    leadingIcon,
    trailingIcon,
    asStatic = false,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  const iconSize = ICON_SIZE_MAP[size];
  const content = (
    <>
      {leadingIcon && <Icon name={leadingIcon} size={iconSize} />}
      <span>{children}</span>
      {trailingIcon && <Icon name={trailingIcon} size={iconSize} />}
    </>
  );

  const baseClasses = cn(
    'inline-flex items-center justify-center rounded-full transition-colors duration-200',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  );

  if (asStatic) {
    return (
      <span className={baseClasses} aria-disabled={disabled || undefined}>
        {content}
      </span>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={cn(
        baseClasses,
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
      )}
      {...rest}
    >
      {content}
    </button>
  );
});
