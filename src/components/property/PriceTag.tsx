import { formatPrice, formatPriceParts } from '@/lib/properties/format';
import { cn } from '@/lib/utils/cn';

export type PriceTagVariant = 'featured' | 'compact';

export interface PriceTagProps {
  amount: number;
  listingType: 'sale' | 'rent';
  variant: PriceTagVariant;
  className?: string;
}

/**
 * Presentacional puro. Para `featured` usa el color primario y peso semi-bold;
 * para `compact` usa `text-on-surface bold` con el sufijo `/mes` en gris
 * cuando aplica.
 */
export function PriceTag({ amount, listingType, variant, className }: PriceTagProps) {
  if (variant === 'featured') {
    return (
      <p className={cn('text-xl font-semibold text-primary', className)}>
        {formatPrice(amount, listingType)}
      </p>
    );
  }

  const { base, suffix } = formatPriceParts(amount, listingType);
  return (
    <p className={cn('text-lg font-bold text-on-surface', className)}>
      {base}
      {suffix && <span className="text-sm font-normal text-muted">{suffix}</span>}
    </p>
  );
}
