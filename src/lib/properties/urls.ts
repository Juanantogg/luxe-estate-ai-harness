/**
 * Construye la URL del detalle de una property. Centraliza el patrón
 * `/property/<slug>` para que un cambio futuro (p. ej. `/p/<slug>` por
 * SEO o `/property/<city>/<slug>`) sea un solo edit.
 *
 * Acepta cualquier objeto con `slug` para tolerar las proyecciones
 * acotadas de los listados (PropertyCardData, PropertyForDetail,
 * PropertyForManagement, etc.).
 */
export function getPropertyUrl(property: { slug: string }): string {
  return `/property/${property.slug}`;
}

/**
 * Variante que arma la subruta de schedule. Mismo argumento, mismo
 * dominio.
 */
export function getPropertyScheduleUrl(property: { slug: string }): string {
  return `/property/${property.slug}/schedule`;
}
