/**
 * Helper para resolver la URL pública de una imagen de propiedad: el seed
 * guarda URLs absolutas (placeholders de Unsplash) y los uploads reales
 * guardan paths relativos al bucket de Storage. Esta función abstrae ambos
 * casos para que los consumidores nunca tengan que ramificar.
 */

/** Nombre del bucket público donde viven las imágenes reales de propiedades. */
export const PROPERTY_IMAGES_BUCKET = 'property-images';

/**
 * Convierte un `storage_path` de `property_images` en una URL renderizable.
 *
 * - Si el path ya es una URL absoluta (`http://` o `https://`) se devuelve
 *   tal cual: corresponde a un placeholder externo del seed.
 * - Si es un path relativo (ej. `properties/<id>/<file>`), se compone la
 *   URL pública del bucket usando `NEXT_PUBLIC_SUPABASE_URL`.
 *
 * @param storagePath valor crudo de `property_images.storage_path`.
 * @returns URL absoluta lista para `<img src>` o `next/image`.
 */
export function getImageUrl(storagePath: string): string {
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
    return storagePath;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL no está definida; no se puede resolver la URL de la imagen.',
    );
  }

  const normalizedPath = storagePath.startsWith('/') ? storagePath.slice(1) : storagePath;
  const base = supabaseUrl.replace(/\/$/, '');

  return `${base}/storage/v1/object/public/${PROPERTY_IMAGES_BUCKET}/${normalizedPath}`;
}
