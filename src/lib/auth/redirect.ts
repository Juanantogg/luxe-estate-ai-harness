import type { Database } from '@/types/database';

export type UserRole = Database['public']['Enums']['user_role'];

/**
 * Devuelve la ruta a la que debe ir el usuario después de iniciar sesión,
 * en función de su rol. Valores por defecto para roles desconocidos: `/`.
 *
 * Mapeo:
 *  - `admin`         → `/admin`
 *  - `agent` / `broker` → `/dashboard`
 *  - `user` (default)   → `/`
 */
export function getRedirectPathForRole(role: UserRole | null | undefined): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'agent':
    case 'broker':
      return '/dashboard';
    case 'user':
    default:
      return '/';
  }
}

/**
 * Devuelve `next` si es una ruta interna segura, o `null` si no.
 *
 * Anti open-redirect:
 *  - debe empezar con "/" pero no con "//" (protocolo-relativo)
 *  - no puede empezar con "/auth/" (evita loops del callback)
 *  - no puede contener "\n" ni "\r" (header injection)
 *  - tope de longitud 512 caracteres
 *
 * IMPORTANTE: cualquier consumo de `next` proveniente del cliente debe
 * pasar por esta función antes de usarse como destino de redirect.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (typeof raw !== 'string') return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  if (raw.startsWith('/auth/')) return null;
  if (/[\r\n]/.test(raw)) return null;
  if (raw.length > 512) return null;
  return raw;
}
