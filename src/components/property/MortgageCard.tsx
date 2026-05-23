import { Button, Icon } from '@/components/ui';
import { estimateMonthlyPayment, formatPrice } from '@/lib/properties/format';
import type { ListingType } from '@/lib/properties/queries';

export interface MortgageCardProps {
  price: number;
  listingType: ListingType;
}

/**
 * Banner placeholder de la calculadora de hipoteca. NO funcional — el
 * acceptance MVP así lo pide. Para `listing_type='sale'` mostramos una
 * estimación textual del pago mensual (30 años @ 6.5% con 20% de enganche)
 * usando `estimateMonthlyPayment`. Para `rent` ocultamos la línea de
 * estimación (no aplica).
 */
export function MortgageCard({ price, listingType }: MortgageCardProps) {
  const showEstimate = listingType === 'sale';
  const monthly = showEstimate ? estimateMonthlyPayment(price) : null;

  return (
    <section className="flex flex-col items-center justify-between gap-6 rounded-xl border border-primary/10 bg-surface-soft p-6 sm:flex-row">
      <div className="flex w-full items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-primary shadow-card">
          <Icon name="calculate" />
        </div>
        <div>
          <h3 className="font-semibold text-on-surface">Calculadora de hipoteca</h3>
          {showEstimate && monthly ? (
            <p className="text-sm text-muted">
              Desde <strong className="text-primary">{formatPrice(monthly, 'sale')}/mes</strong> con
              20% de enganche.
            </p>
          ) : (
            <p className="text-sm text-muted">
              Próximamente: estimación mensual con diferentes plazos y enganche.
            </p>
          )}
        </div>
      </div>
      <Button variant="secondary" size="md" disabled className="shrink-0 whitespace-nowrap">
        Próximamente
      </Button>
    </section>
  );
}
