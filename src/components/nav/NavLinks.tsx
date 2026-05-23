import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

export interface NavLink {
  href: string;
  label: string;
  /** Si está activo, recibe `aria-current="page"` y estilos resaltados. */
  isActive: boolean;
}

export interface NavLinksProps {
  links: NavLink[];
  /** Estilo visual del set de links. */
  variant: 'app' | 'dashboard' | 'admin';
  className?: string;
}

/**
 * Lista horizontal de links principales del TopNav (desktop, md+).
 * En mobile el TopNav los oculta y los re-renderiza el `MobileNavDrawer`.
 */
export function NavLinks({ links, variant, className }: NavLinksProps) {
  // Variante "app" usa subrayado animado en hover; variantes
  // "dashboard" y "admin" usan un border-b-2 transparente (matching mockups).
  const useBorderUnderline = variant !== 'app';

  return (
    <ul className={cn('hidden items-center md:flex md:gap-8', className)}>
      {links.map((link) => {
        const baseClasses =
          'text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm';

        const activeClasses = useBorderUnderline
          ? 'text-primary border-b-2 border-primary px-1 py-1'
          : 'text-primary border-b-2 border-primary pb-1 px-1';

        const inactiveClasses = useBorderUnderline
          ? 'text-on-surface/60 hover:text-primary border-b-2 border-transparent hover:border-primary/30 px-1 py-1'
          : 'text-on-surface/70 hover:text-on-surface border-b-2 border-transparent hover:border-on-surface/20 pb-1 px-1';

        return (
          <li key={link.href + link.label}>
            <Link
              href={link.href}
              aria-current={link.isActive ? 'page' : undefined}
              className={cn(baseClasses, link.isActive ? activeClasses : inactiveClasses)}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
