/**
 * Devuelve `true` si el link representado por `href` debe marcarse activo
 * dado el pathname y los searchParams actuales del navegador.
 *
 * Comparamos pathname + subset de searchParams declarados en el href.
 * Esto es necesario porque links como "/" (Comprar) y "/?listing=rent"
 * (Rentar) comparten pathname y la diferencia vive en el query: un match
 * solo por pathname pondría siempre "Comprar" activo.
 *
 * Semántica para el branch home (`pathHref === '/'`):
 * - Link SIN `listing` declarado (ej. `href='/'`, caso "Comprar"): activo
 *   cuando el query actual no tiene `listing` (default "Todas") o tiene
 *   `listing=sale`. Esto refleja el hecho de que el `ListingTypeToggle` de
 *   la home introduce 3 estados (`all`, `sale`, `rent`) pero el TopNav solo
 *   expone 2 links ("Comprar" y "Rentar"); "Comprar" agrupa los dos casos
 *   que no son renta. La whitelist es estricta: cualquier valor distinto
 *   de `null` / `'sale'` / `'rent'` deja a ambos links inactivos.
 * - Link CON `listing` declarado (ej. `href='/?listing=rent'`, caso
 *   "Rentar"): exige match exacto del valor del query.
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
    const linkListing = linkParams.get('listing');
    const currentListing = currentParams.get('listing');
    // Link sin `listing` declarado ("Comprar") agrupa {null, 'sale'} para
    // mantener el TopNav coherente con los 3 estados del ListingTypeToggle.
    // Link con `listing` declarado ("Rentar") exige match exacto.
    if (linkListing === null) {
      return currentListing === null || currentListing === 'sale';
    }
    return linkListing === currentListing;
  }

  if (pathname === pathHref) return true;
  return pathname.startsWith(`${pathHref}/`);
}
