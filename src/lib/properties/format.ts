/**
 * Formateadores presentacionales para propiedades.
 *
 * Centralizamos aquí cualquier transformación de números/strings que vaya a la
 * UI para mantener consistencia entre tarjetas, listados y detalle.
 *
 * Convenciones:
 * - Locale `es-MX` (separadores de miles con coma, símbolo `$`).
 * - Sin decimales en precios (todas las propiedades del seed son enteros).
 */

const priceFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/**
 * Devuelve las partes de un precio para que la UI pueda estilizar el sufijo
 * `/mes` por separado (ej. peso/color distinto en tarjetas compactas).
 */
export function formatPriceParts(
  amount: number,
  listingType: 'sale' | 'rent',
): { base: string; suffix: string | null } {
  return {
    base: priceFormatter.format(amount),
    suffix: listingType === 'rent' ? '/mes' : null,
  };
}

/** Formatea un monto de propiedad. Si es alquiler agrega sufijo `/mes`. */
export function formatPrice(amount: number, listingType: 'sale' | 'rent'): string {
  const { base, suffix } = formatPriceParts(amount, listingType);
  return suffix ? `${base}${suffix}` : base;
}

/** Formatea el área en metros cuadrados. Devuelve `null` si el valor no existe. */
export function formatArea(areaSqm: number | null | undefined): string | null {
  if (areaSqm == null) return null;
  const formatter = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
  return `${formatter.format(areaSqm)} m²`;
}

/**
 * Mapea un `listing_status` a los props que recibe el primitivo `Badge`
 * para pintar el estado de una propiedad en el dashboard de gestión.
 *
 * Mapeo (spec §"Estado de badges"):
 * - `active` → success + dot, label "Activa"
 * - `pending` → warning + dot, label "Pendiente"
 * - `sold` → neutral + dot, label "Vendida"
 * - `rented` → neutral + dot, label "Rentada"
 * - `draft` → neutral + dot, label "Borrador"
 * - `archived` → neutral + dot, label "Archivada"
 */
export type ListingStatusForBadge = 'active' | 'pending' | 'sold' | 'rented' | 'draft' | 'archived';

export interface StatusBadgeProps {
  variant: 'success' | 'warning' | 'neutral';
  label: string;
  withDot: true;
}

export function getStatusBadgeProps(status: ListingStatusForBadge): StatusBadgeProps {
  switch (status) {
    case 'active':
      return { variant: 'success', label: 'Activa', withDot: true };
    case 'pending':
      return { variant: 'warning', label: 'Pendiente', withDot: true };
    case 'sold':
      return { variant: 'neutral', label: 'Vendida', withDot: true };
    case 'rented':
      return { variant: 'neutral', label: 'Rentada', withDot: true };
    case 'draft':
      return { variant: 'neutral', label: 'Borrador', withDot: true };
    case 'archived':
      return { variant: 'neutral', label: 'Archivada', withDot: true };
  }
}

/**
 * Estima el pago mensual de una hipoteca con cuota fija (amortización
 * francesa). NO es asesoramiento financiero — sólo un placeholder visual
 * para la `MortgageCard` del detalle de propiedad ("Desde $X/mes con 20%
 * de enganche").
 *
 * Defaults: 30 años, tasa anual 6.5%, enganche 20%.
 */
export function estimateMonthlyPayment(
  price: number,
  opts: { annualRate?: number; years?: number; downPaymentPct?: number } = {},
): number {
  const { annualRate = 0.065, years = 30, downPaymentPct = 0.2 } = opts;
  const principal = price * (1 - downPaymentPct);
  const monthlyRate = annualRate / 12;
  const n = years * 12;
  if (monthlyRate === 0) return Math.round(principal / n);
  const factor = Math.pow(1 + monthlyRate, n);
  const monthly = (principal * monthlyRate * factor) / (factor - 1);
  return Math.round(monthly);
}
