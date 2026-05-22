import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

/**
 * Middleware raíz. Refresca la sesión de Supabase en cada request y
 * propaga las cookies. La lógica de protección por ruta vive en
 * `updateSession` (`src/lib/supabase/proxy.ts`).
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Excluimos assets estáticos y archivos comunes para que el middleware
  // no toque cookies en cada PNG / CSS / font request.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)',
  ],
};
