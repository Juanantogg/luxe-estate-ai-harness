/**
 * URL base canónica del sitio. Se usa para construir `redirectTo` en
 * Supabase Auth (OAuth, reset password, signup email).
 *
 * Precedencia:
 *  1. `NEXT_PUBLIC_SITE_URL` (recomendado en prod)
 *  2. `NEXT_PUBLIC_VERCEL_URL` (preview deployments)
 *  3. `http://localhost:3000` (dev)
 *
 * Nunca devuelve trailing slash.
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}
