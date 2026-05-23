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
