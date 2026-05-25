/**
 * Devuelve `true` si el link representado por `href` debe marcarse activo
 * dado el pathname y los searchParams actuales del navegador.
 *
 * Comparamos pathname + subset de searchParams declarados en el href.
 * Esto es necesario porque links como "/" (Comprar) y "/?listing=rent"
 * (Rentar) comparten pathname y la diferencia vive en el query: un match
 * solo por pathname pondría siempre "Comprar" activo.
 *
 * El cálculo se hace client-side (usePathname + useSearchParams) porque
 * los layouts no re-renderean al cambiar searchParams y el TopNav vive
 * en un layout.
 */
export function isLinkActive(pathname: string, search: string, href: string): boolean {
  const [pathHref = '/', queryHref = ''] = href.split('?');
  const linkParams = new URLSearchParams(queryHref);
  const currentParams = new URLSearchParams(search);

  if (pathHref === '/') {
    if (pathname !== '/') return false;
    // Si el link declara `listing`, exigimos match exacto. Si no lo declara,
    // exigimos que el query actual tampoco lo tenga (así "Comprar" no
    // queda activo cuando hay ?listing=rent).
    const linkListing = linkParams.get('listing');
    const currentListing = currentParams.get('listing');
    return linkListing === currentListing;
  }

  if (pathname === pathHref) return true;
  return pathname.startsWith(`${pathHref}/`);
}
