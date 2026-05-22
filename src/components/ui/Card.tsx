import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export type CardVariant = 'default' | 'featured' | 'inverse' | 'flat';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  hoverable?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: 'bg-surface text-on-surface rounded-lg shadow-soft border border-divider-soft',
  featured: 'bg-surface-soft text-on-surface rounded-xl shadow-soft',
  inverse: 'bg-surface-inverse text-on-surface-inverse rounded-lg shadow-soft',
  flat: 'bg-surface text-on-surface rounded border border-divider-soft',
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-6',
  lg: 'p-8',
};

/**
 * Contenedor con padding y sombra; cuatro variantes (default/featured/inverse/flat).
 * @example <Card variant="featured" padding="md" hoverable>Contenido</Card>
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', padding = 'md', hoverable = false, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        VARIANT_CLASSES[variant],
        PADDING_CLASSES[padding],
        hoverable && 'cursor-pointer transition-shadow hover:shadow-soft-hover',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});
