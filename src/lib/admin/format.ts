const NUMBER_FORMATTER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

/**
 * Formato corto para la columna "Ventas (año)" del directorio admin.
 *
 *   1_500_000 → "$1.5M"
 *   4_200_000 → "$4.2M"
 *   2_000_000 → "$2M"
 *      75_000 → "$75k"
 *         750 → "$750"
 *
 * Para valores < 1k usamos formato `es-MX` con separador local.
 */
export function formatSalesShort(amount: number): string {
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000;
    return `$${m.toFixed(m % 1 === 0 ? 0 : 1)}M`;
  }
  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}k`;
  }
  return `$${NUMBER_FORMATTER.format(amount)}`;
}
