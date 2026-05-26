import { z } from 'zod';

/**
 * Schemas zod del formulario crear/editar propiedad. Spec § 10.4.
 *
 * Dos schemas:
 *  - `draftSchema`: solo `title` requerido. Permite guardar borradores
 *    incompletos. Los campos faltantes se persisten como defaults.
 *  - `publishSchema`: TODOS los campos visibles requeridos (con sus rangos
 *    propios). Se usa al clickear "Save Property".
 *
 * El array de imágenes se valida APARTE en la Server Action (no entra en
 * `values`) porque viene como referencias a Storage, no como FormData.
 */

export const LISTING_TYPES = ['sale', 'rent'] as const;
export const PROPERTY_TYPES = [
  'house',
  'apartment',
  'villa',
  'penthouse',
  'condo',
  'townhouse',
  'commercial',
] as const;
export const AMENITY_KEYS = [
  'pool',
  'gym',
  'wifi',
  'air_conditioning',
  'garden',
  'smart_home',
  'parking',
  'patio',
  'wine_cellar',
  'ev_charging',
  'central_heating',
] as const;

/**
 * Límite duro de imágenes por propiedad. Spec § 15 decisión 3.
 * Aplica tanto en cliente (deshabilitar input) como en Server Action.
 */
export const MAX_IMAGES_PER_PROPERTY = 12;

const PROPERTY_TYPE_LABEL_ES: Record<(typeof PROPERTY_TYPES)[number], string> = {
  house: 'Casa',
  apartment: 'Apartamento',
  villa: 'Villa',
  penthouse: 'Penthouse',
  condo: 'Condominio',
  townhouse: 'Townhouse',
  commercial: 'Comercial',
};

const LISTING_TYPE_LABEL_ES: Record<(typeof LISTING_TYPES)[number], string> = {
  sale: 'En venta',
  rent: 'En alquiler',
};

export function getPropertyTypeOptions(): Array<{
  value: (typeof PROPERTY_TYPES)[number];
  label: string;
}> {
  return PROPERTY_TYPES.map((value) => ({ value, label: PROPERTY_TYPE_LABEL_ES[value] }));
}

export function getListingTypeOptions(): Array<{
  value: (typeof LISTING_TYPES)[number];
  label: string;
}> {
  return LISTING_TYPES.map((value) => ({ value, label: LISTING_TYPE_LABEL_ES[value] }));
}

// Helper: número o null. Acepta string vacío (form) y devuelve null.
const optionalNumber = z.union([z.string(), z.number(), z.null()]).transform((v) => {
  if (v === null) return null;
  if (typeof v === 'number') return v;
  const trimmed = v.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isNaN(n) ? null : n;
});

const optionalString = z.union([z.string(), z.null()]).transform((v) => {
  if (v === null) return null;
  const trimmed = v.trim();
  return trimmed === '' ? null : trimmed;
});

// ============================================================
// draftSchema — solo title obligatorio
// ============================================================
export const draftSchema = z.object({
  title: z.string().trim().min(3, 'Mínimo 3 caracteres').max(200, 'Máximo 200 caracteres'),
  description: z.string().max(2000, 'Máximo 2000 caracteres').default(''),
  price: optionalNumber.pipe(z.number().min(0, 'El precio no puede ser negativo').nullable()),
  listing_type: z.enum(LISTING_TYPES).default('sale'),
  property_type: z.enum(PROPERTY_TYPES).default('house'),
  address_line: z.string().trim().max(500).default(''),
  city: z.string().trim().max(200).default(''),
  state: optionalString,
  country: z.string().trim().max(200).default('México'),
  postal_code: optionalString,
  area_sqm: optionalNumber.pipe(z.number().min(0).nullable()),
  year_built: optionalNumber.pipe(
    z.number().int().min(1800, 'Año mínimo 1800').max(2100, 'Año máximo 2100').nullable(),
  ),
  bedrooms: optionalNumber.pipe(z.number().int().min(0).nullable()).transform((v) => v ?? 0),
  bathrooms: optionalNumber.pipe(z.number().min(0).nullable()).transform((v) => v ?? 0),
  parking_spaces: optionalNumber.pipe(z.number().int().min(0).nullable()).transform((v) => v ?? 0),
  amenities: z.array(z.enum(AMENITY_KEYS)).default([]),
});

export type DraftValues = z.infer<typeof draftSchema>;
export type DraftInput = z.input<typeof draftSchema>;

// ============================================================
// publishSchema — todos los campos requeridos
// ============================================================
export const publishSchema = z.object({
  title: z.string().trim().min(3, 'Mínimo 3 caracteres').max(200, 'Máximo 200 caracteres'),
  description: z
    .string()
    .trim()
    .min(50, 'Mínimo 50 caracteres')
    .max(2000, 'Máximo 2000 caracteres'),
  price: optionalNumber.pipe(z.number().positive('El precio debe ser mayor a 0')),
  listing_type: z.enum(LISTING_TYPES),
  property_type: z.enum(PROPERTY_TYPES),
  address_line: z.string().trim().min(3, 'Ingresá la dirección').max(500),
  city: z.string().trim().min(2, 'Ingresá la ciudad').max(200),
  state: optionalString,
  country: z.string().trim().min(2, 'Ingresá el país').max(200),
  postal_code: optionalString,
  area_sqm: optionalNumber.pipe(z.number().positive('El área debe ser mayor a 0')),
  year_built: optionalNumber.pipe(
    z.number().int().min(1800, 'Año mínimo 1800').max(2100, 'Año máximo 2100'),
  ),
  bedrooms: optionalNumber.pipe(z.number().int().min(0)).transform((v) => v ?? 0),
  bathrooms: optionalNumber.pipe(z.number().min(0)).transform((v) => v ?? 0),
  parking_spaces: optionalNumber.pipe(z.number().int().min(0)).transform((v) => v ?? 0),
  amenities: z.array(z.enum(AMENITY_KEYS)).default([]),
});

export type PublishValues = z.infer<typeof publishSchema>;
export type PublishInput = z.input<typeof publishSchema>;

// ============================================================
// Tipo unificado de valores de form (lo que el client mantiene en estado)
// ============================================================
export interface PropertyFormImage {
  /** ID en `property_images` si la imagen ya existe en DB (modo edit). */
  id?: string;
  /** Path dentro del bucket `property-images`. */
  storagePath: string;
  isMain: boolean;
  altText: string | null;
  position: number;
  /** Marca para borrar en update (solo afecta imágenes con `id`). */
  deleted?: boolean;
}

export interface PropertyFormValues {
  title: string;
  description: string;
  price: string; // se mantiene como string en el form
  listing_type: (typeof LISTING_TYPES)[number];
  property_type: (typeof PROPERTY_TYPES)[number];
  address_line: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  area_sqm: string;
  year_built: string;
  bedrooms: number;
  bathrooms: number;
  parking_spaces: number;
  amenities: ReadonlyArray<(typeof AMENITY_KEYS)[number]>;
}

export function getEmptyFormValues(): PropertyFormValues {
  return {
    title: '',
    description: '',
    price: '',
    listing_type: 'sale',
    property_type: 'house',
    address_line: '',
    city: '',
    state: '',
    country: 'México',
    postal_code: '',
    area_sqm: '',
    year_built: '',
    bedrooms: 0,
    bathrooms: 0,
    parking_spaces: 0,
    amenities: [],
  };
}

/**
 * Aplana los `fieldErrors` de un `safeParse` fallido a un mapa
 * `field → primer mensaje`. La Server Action y el client lo usan para
 * pintar errores inline.
 */
export function flattenFieldErrors(err: z.ZodError): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_root';
    if (!flat[key]) flat[key] = issue.message;
  }
  return flat;
}
