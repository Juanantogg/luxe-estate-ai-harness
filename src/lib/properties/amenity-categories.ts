import type { AmenityKey } from './amenities';
import { AMENITY_LABEL_ES } from './amenities';

/**
 * Agrupación visual de amenities por categoría en el formulario de crear/editar
 * propiedad. El enum `amenity_key` NO tiene columna de categoría — este mapeo
 * vive solo aquí porque es decisión presentacional.
 *
 * Spec § 3.4: tres grupos Interior / Exterior / Servicios. Ítems ambiguos
 * (Wi-Fi, EV charging) caen en Servicios.
 */

export type AmenityCategory = 'interior' | 'exterior' | 'services';

export const AMENITY_CATEGORY_LABEL_ES: Record<AmenityCategory, string> = {
  interior: 'Interior',
  exterior: 'Exterior',
  services: 'Servicios',
};

/**
 * Categoría asignada a cada amenity. Convención:
 *  - `interior` → atributos físicos del edificio que están dentro del
 *    espacio habitable (climatización, cava, smart home).
 *  - `exterior` → atributos físicos al aire libre (pool, jardín, patio).
 *  - `services` → infraestructura/servicios contratados o compartidos
 *    (wifi, gimnasio, parking, EV charging). Wifi y EV charging caen acá
 *    aunque son físicos porque su valor para el comprador es contractual.
 */
export const AMENITY_TO_CATEGORY: Record<AmenityKey, AmenityCategory> = {
  // Interior
  air_conditioning: 'interior',
  smart_home: 'interior',
  central_heating: 'interior',
  wine_cellar: 'interior',
  // Exterior
  pool: 'exterior',
  garden: 'exterior',
  patio: 'exterior',
  // Services
  gym: 'services',
  wifi: 'services',
  parking: 'services',
  ev_charging: 'services',
};

const CATEGORY_ORDER: AmenityCategory[] = ['interior', 'exterior', 'services'];

/**
 * Devuelve un mapa `AmenityCategory → AmenityKey[]` con todos los items
 * agrupados, en el orden visual definido. Útil para iterar en el render
 * del form sin perder el orden estable.
 */
export function groupAmenitiesByCategory(): Array<{
  category: AmenityCategory;
  label: string;
  items: Array<{ key: AmenityKey; label: string }>;
}> {
  const map = new Map<AmenityCategory, Array<{ key: AmenityKey; label: string }>>();
  for (const cat of CATEGORY_ORDER) {
    map.set(cat, []);
  }
  for (const [key, cat] of Object.entries(AMENITY_TO_CATEGORY) as Array<
    [AmenityKey, AmenityCategory]
  >) {
    map.get(cat)?.push({ key, label: AMENITY_LABEL_ES[key] });
  }
  return CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: AMENITY_CATEGORY_LABEL_ES[cat],
    items: map.get(cat) ?? [],
  }));
}
