/**
 * Reglas de derivación de badges de propiedad. Función pura sin acceso a DB.
 *
 * Reglas (de § 3.4 del spec):
 * - EXCLUSIVA: `is_premium === true` o (`is_featured === true` y `price > 3_000_000`).
 * - NUEVA: `published_at` dentro de los últimos 7 días y NO es EXCLUSIVA.
 * - PRICE DROP: `previous_price != null && price < previous_price` (no se
 *   renderiza en home pero la función la devuelve para futuros usos).
 * - EN VENTA / EN RENTA: siempre, derivado de `listing_type`.
 */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const EXCLUSIVE_PRICE_THRESHOLD = 3_000_000;

export type DerivedBadgeKind = 'exclusive' | 'new_arrival' | 'price_drop' | null;

export interface DerivedBadge {
  kind: DerivedBadgeKind;
  label: string | null;
}

export interface ListingBadge {
  kind: 'sale' | 'rent';
  label: 'EN VENTA' | 'EN RENTA';
}

interface DerivePropertyInput {
  is_featured: boolean;
  is_premium: boolean;
  price: number;
  previous_price: number | null;
  published_at: string | null;
  listing_type: 'sale' | 'rent';
}

/** Devuelve el badge principal (top-left). Prioridad: exclusive > new_arrival > price_drop. */
export function deriveBadge(property: DerivePropertyInput): DerivedBadge {
  const isExclusive =
    property.is_premium ||
    (property.is_featured && Number(property.price) > EXCLUSIVE_PRICE_THRESHOLD);

  if (isExclusive) {
    return { kind: 'exclusive', label: 'EXCLUSIVA' };
  }

  if (property.published_at) {
    const publishedAt = new Date(property.published_at).getTime();
    if (!Number.isNaN(publishedAt) && Date.now() - publishedAt < SEVEN_DAYS_MS) {
      return { kind: 'new_arrival', label: 'NUEVA' };
    }
  }

  if (property.previous_price != null && Number(property.price) < Number(property.previous_price)) {
    return { kind: 'price_drop', label: 'BAJÓ DE PRECIO' };
  }

  return { kind: null, label: null };
}

/** Devuelve el badge inferior con la operación (EN VENTA / EN RENTA). Siempre presente. */
export function deriveListingBadge(listingType: 'sale' | 'rent'): ListingBadge {
  return listingType === 'rent'
    ? { kind: 'rent', label: 'EN RENTA' }
    : { kind: 'sale', label: 'EN VENTA' };
}
