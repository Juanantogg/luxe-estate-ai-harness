import { SkipLink, TopNav } from '@/components/nav';
import { getSessionAndProfile } from '@/lib/auth/get-session';

/**
 * Layout para el shell público de la app (variant `app` del TopNav).
 *
 * NO redirige a `/login` cuando no hay sesión: a partir de la feature
 * `home_discover_screen`, las rutas `/`, `/property/[slug]` y `/search` son
 * públicas. La protección de rutas privadas (`/favorites`, `/profile`,
 * `/visits`) vive en el middleware (`proxy.ts`), no en este layout.
 *
 * Si en el futuro se agrega una ruta privada bajo `(app)/`, hay que añadirla
 * a `isProtectedPath` en `proxy.ts`.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionAndProfile();

  return (
    <>
      <SkipLink />
      <TopNav variant="app" session={session ?? null} />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
    </>
  );
}
