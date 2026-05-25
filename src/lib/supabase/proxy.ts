import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

/**
 * Refresca la sesión de Supabase en cada request y propaga las cookies.
 * Lo invoca el middleware.ts raíz del proyecto.
 *
 * También sirve para proteger rutas: si no hay user y la ruta requiere
 * auth (definida en `protectedPaths`), redirige a /login.
 */
export async function updateSession(request: NextRequest) {
  // Inyectamos `x-pathname` en los headers del request para que los
  // Server Components puedan leer el pathname actual vía `await headers()`.
  // Esto evita envolver links del TopNav en un Client wrapper.
  // Nota: el TopNav ya no lo usa (NavLinks/MobileNavDrawer leen path y
  // searchParams con hooks), pero el header se mantiene por si otros
  // Server Components lo necesitan en el futuro.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: no poner código entre createServerClient y getUser().
  // getUser() refresca el token si está por expirar y setea cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Rutas que requieren autenticación. Si crecen, se mueve a un array
  // configurable o a un matcher por regex.
  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/favorites') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/visits') ||
    pathname.startsWith('/admin');

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
