import { z } from 'zod';

/**
 * Schemas zod para el perfil del usuario.
 *
 * Se aplican defense-in-depth en la Server Action `uploadAvatar` para evitar
 * spoofing del tamaño / MIME. La validación client-side (en
 * `ProfileAvatarEditor`) usa los mismos límites para fallar rápido sin pegarle
 * al server.
 */

/** Límite máximo de tamaño para el avatar: 2 MB. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** MIME types permitidos para upload de avatar. */
export const AVATAR_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AvatarMime = (typeof AVATAR_ALLOWED_MIME)[number];

/**
 * Mapea un MIME válido a su extensión canónica para nombrar el blob
 * en Storage. Usamos la extensión derivada del MIME, no del nombre del
 * archivo subido — evita que un usuario suba `evil.png.exe` y termine
 * almacenado con extensión arbitraria.
 */
export const AVATAR_MIME_TO_EXT: Record<AvatarMime, 'jpg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Schema para el File subido en `uploadAvatar`. Valida tamaño y MIME.
 * No valida contenido binario (eso lo hace el browser y, en última
 * instancia, Storage rechaza si el formato es inválido).
 */
export const avatarFileSchema = z
  .instanceof(File, { message: 'Archivo inválido.' })
  .refine((f) => f.size > 0, 'El archivo está vacío.')
  .refine((f) => f.size <= AVATAR_MAX_BYTES, 'Archivo demasiado grande (máx 2 MB).')
  .refine(
    (f) => (AVATAR_ALLOWED_MIME as readonly string[]).includes(f.type),
    'Formato no soportado. Usá JPG, PNG o WEBP.',
  );

export type AvatarFile = z.infer<typeof avatarFileSchema>;
