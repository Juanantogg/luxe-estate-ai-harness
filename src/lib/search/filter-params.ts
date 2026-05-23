/**
 * Utilidades puras para leer/escribir/contar filtros de búsqueda.
 *
 * Sin React, sin estado de cliente: estas funciones se importan desde el
 * Server Component `/search/page.tsx` (parseo de searchParams) y desde los
 * Client Components del modal (`FiltersModal`, `FiltersTrigger`). Mantener
 * test-friendly y agnóstico.
 *
 * Spec: progress/search_filters_modal/design.md
 *  - §"Pre-población al abrir" → mapa URL ↔ control
 *  - §"URL contract — formato exacto"
 *  - §"Decisiones cerradas" → rangos de precio condicionados por listing
 */

import type { Database } from '@/types/database';
import { Constants } from '@/types/database';

export type AmenityKey = Database['public']['Enums']['amenity_key'];
export type PropertyType = Database['public']['Enums']['property_type'];
export type ListingType = Database['public']['Enums']['listing_type'];

const VALID_AMENITIES = new Set(Constants.public.Enums.amenity_key as readonly string[]);
const VALID_PROPERTY_TYPES = new Set(Constants.public.Enums.property_type as readonly string[]);
const VALID_LISTING_TYPES = new Set(Constants.public.Enums.listing_type as readonly string[]);

/**
 * Rango de precio según listing. La home pasa `listing=sale` o `rent` o
 * ninguno; en cualquier caso distinto de `rent` usamos el rango de venta.
 * Decisión humana (2026-05-23, §"Decisiones cerradas" del spec).
 */
export interface PriceRange {
  min: number;
  max: number;
  step: number;
}

const SALE_RANGE: PriceRange = { min: 0, max: 10_000_000, step: 50_000 };
const RENT_RANGE: PriceRange = { min: 0, max: 20_000, step: 100 };

export function getPriceRangeForListing(listing: ListingType | undefined | null): PriceRange {
  return listing === 'rent' ? RENT_RANGE : SALE_RANGE;
}

export interface Filters {
  /** Texto libre. Se aplica como `ilike` sobre `city`. */
  location: string;
  /** Min de precio. `null` = sin tope inferior (el extremo del rango). */
  minPrice: number | null;
  /** Max de precio. `null` = sin tope superior. */
  maxPrice: number | null;
  /** Tipo de propiedad. `null` = cualquier tipo. */
  type: PropertyType | null;
  /** Listing type preservado de la URL. NO editable desde el modal. */
  listing: ListingType | null;
  /** Texto libre de búsqueda full-text. Preservado de la URL. */
  q: string;
  /** 0 = "Cualquiera". 1..6 = N o más. */
  bedrooms: number;
  /** Idem. */
  bathrooms: number;
  /** OR: matchea propiedades con AL MENOS UNA. */
  amenities: AmenityKey[];
}

/**
 * Filters vacío: representa "sin ningún filtro aplicado". Útil para el botón
 * "Limpiar filtros" del modal (resetea el state local sin tocar la URL).
 */
export const EMPTY_FILTERS: Filters = {
  location: '',
  minPrice: null,
  maxPrice: null,
  type: null,
  listing: null,
  q: '',
  bedrooms: 0,
  bathrooms: 0,
  amenities: [],
};

/** Normaliza el shape de Next 16 (`Record<string, string | string[] | undefined>`). */
export type SearchParamsLike = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parsePositiveInt(value: string | undefined, max: number): number | null {
  if (value == null) return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(n, max);
}

function clampInt(value: string | undefined, min: number, max: number): number {
  if (value == null) return 0;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(min, Math.min(n, max));
}

/**
 * Lee los searchParams crudos y devuelve un Filters tipado y normalizado.
 * - Ignora valores fuera de enum.
 * - Clampea ranges (precio al máximo del listing, bedrooms/bathrooms 0..6).
 * - Preserva `q` y `listing` aunque no sean editables desde el modal.
 */
export function parseFilterParams(searchParams: SearchParamsLike): Filters {
  const listingRaw = pickString(searchParams.listing);
  const listing =
    listingRaw && VALID_LISTING_TYPES.has(listingRaw) ? (listingRaw as ListingType) : null;

  const range = getPriceRangeForListing(listing);

  const typeRaw = pickString(searchParams.type);
  const type =
    typeRaw && typeRaw !== 'all' && VALID_PROPERTY_TYPES.has(typeRaw)
      ? (typeRaw as PropertyType)
      : null;

  const amenitiesRaw = pickString(searchParams.amenities);
  const amenities = amenitiesRaw
    ? (amenitiesRaw
        .split(',')
        .map((a) => a.trim())
        .filter((a) => VALID_AMENITIES.has(a)) as AmenityKey[])
    : [];

  return {
    location: (pickString(searchParams.location) ?? '').trim(),
    minPrice: parsePositiveInt(pickString(searchParams.min_price), range.max),
    maxPrice: parsePositiveInt(pickString(searchParams.max_price), range.max),
    type,
    listing,
    q: (pickString(searchParams.q) ?? '').trim(),
    bedrooms: clampInt(pickString(searchParams.bedrooms), 0, 6),
    bathrooms: clampInt(pickString(searchParams.bathrooms), 0, 6),
    amenities,
  };
}

/**
 * Serializa filtros a URLSearchParams para `router.push`. Omite los params
 * cuyo valor sea el "neutro" (vacío, 0, extremo del rango). El caller decide
 * la base: si quiere preservar params ajenos al modal (p.ej. `featured=true`),
 * los pasa como base.
 */
export function serializeFilters(filters: Filters, base?: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(base?.toString() ?? '');

  // Limpieza preventiva: el modal es la única fuente de verdad para estos params.
  const ownedParams = [
    'location',
    'min_price',
    'max_price',
    'type',
    'bedrooms',
    'bathrooms',
    'amenities',
    'filters',
  ];
  ownedParams.forEach((p) => params.delete(p));

  const range = getPriceRangeForListing(filters.listing);

  if (filters.location.trim()) params.set('location', filters.location.trim());
  if (filters.minPrice != null && filters.minPrice > range.min) {
    params.set('min_price', String(filters.minPrice));
  }
  if (filters.maxPrice != null && filters.maxPrice < range.max) {
    params.set('max_price', String(filters.maxPrice));
  }
  if (filters.type) params.set('type', filters.type);
  if (filters.bedrooms > 0) params.set('bedrooms', String(filters.bedrooms));
  if (filters.bathrooms > 0) params.set('bathrooms', String(filters.bathrooms));
  if (filters.amenities.length > 0) params.set('amenities', filters.amenities.join(','));

  // Preservar listing y q (no editables desde el modal pero deben sobrevivir).
  if (filters.listing) params.set('listing', filters.listing);
  else params.delete('listing');
  if (filters.q.trim()) params.set('q', filters.q.trim());
  else params.delete('q');

  return params;
}

/**
 * Cuenta cuántos "filtros activos" representa este objeto. Se usa para pintar
 * el badge sobre el botón "Filtros" en el Hero. `listing` y `q` NO cuentan
 * porque no son editables desde el modal.
 */
export function countActiveFilters(filters: Filters): number {
  let n = 0;
  if (filters.location.trim()) n += 1;
  if (filters.minPrice != null) n += 1;
  if (filters.maxPrice != null) n += 1;
  if (filters.type) n += 1;
  if (filters.bedrooms > 0) n += 1;
  if (filters.bathrooms > 0) n += 1;
  if (filters.amenities.length > 0) n += 1;
  return n;
}
