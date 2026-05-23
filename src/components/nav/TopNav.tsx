import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Icon } from '@/components/ui';
import { getSessionAndProfile, type Profile } from '@/lib/auth/get-session';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils/cn';
import type { User } from '@supabase/supabase-js';
import type { AvatarDropdownItem } from './AvatarDropdown';
import { AvatarDropdown } from './AvatarDropdown';
import { MobileNavDrawer } from './MobileNavDrawer';
import type { NavLink } from './NavLinks';
import { NavLinks } from './NavLinks';
import { NotifBell } from './NotifBell';

export type TopNavVariant = 'app' | 'dashboard' | 'admin';

export interface TopNavProps {
  variant: TopNavVariant;
  /**
   * Permite al layout pasar la sesión ya resuelta para evitar doble fetch.
   * Si no se provee, el TopNav la fetcha él mismo.
   */
  session?: { user: User; profile: Profile | null };
}

interface VariantConfig {
  /** Sets de links según variante. */
  links: Array<Omit<NavLink, 'isActive'>>;
  /** Ruta del logo (típicamente la "home" de cada shell). */
  homeHref: string;
  /** Altura de la nav (mobile + desktop). El HTML usa h-16 en dashboard/admin y h-20 en app. */
  heightClass: string;
  /** Fondo del nav. */
  backgroundClass: string;
  /** Si true, muestra el bloque "name + role" a la izquierda del avatar (md+). */
  showNameBlock: boolean;
}

const VARIANT_CONFIG: Record<TopNavVariant, VariantConfig> = {
  app: {
    links: [
      { href: '/', label: 'Comprar' },
      { href: '/?listing=rent', label: 'Rentar' },
      { href: '/sell', label: 'Vender' },
      { href: '/favorites', label: 'Guardados' },
    ],
    homeHref: '/',
    heightClass: 'h-16 md:h-20',
    backgroundClass: 'bg-background/95 backdrop-blur-md',
    showNameBlock: false,
  },
  dashboard: {
    links: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/dashboard/properties', label: 'Propiedades' },
      { href: '/dashboard/tenants', label: 'Inquilinos' },
      { href: '/dashboard/finance', label: 'Finanzas' },
    ],
    homeHref: '/dashboard',
    heightClass: 'h-16',
    backgroundClass: 'bg-surface/95 backdrop-blur-md',
    showNameBlock: true,
  },
  admin: {
    links: [
      { href: '/admin', label: 'Dashboard' },
      { href: '/admin/properties', label: 'Propiedades' },
      { href: '/admin/users', label: 'Usuarios' },
      { href: '/admin/inquiries', label: 'Consultas' },
    ],
    homeHref: '/admin',
    heightClass: 'h-16',
    backgroundClass: 'bg-surface/95 backdrop-blur-md',
    showNameBlock: false,
  },
};

const ROLE_LABEL: Record<string, string> = {
  user: 'Usuario',
  agent: 'Agente',
  broker: 'Broker',
  admin: 'Administrador',
};

function buildDropdownItems(role: string, variant: TopNavVariant): AvatarDropdownItem[] {
  const items: AvatarDropdownItem[] = [{ key: 'profile', label: 'Mi perfil', href: '/profile' }];

  if (role === 'user') {
    items.push({
      key: 'visits',
      label: 'Mis visitas',
      href: '/profile?tab=visits',
    });
  }

  if (role === 'agent' || role === 'broker' || role === 'admin') {
    items.push({
      key: 'dashboard',
      label: 'Dashboard',
      href: '/dashboard',
      isCurrent: variant === 'dashboard',
    });
  }

  if (role === 'admin') {
    items.push({
      key: 'admin',
      label: 'Administración',
      href: '/admin',
      isCurrent: variant === 'admin',
    });
  }

  return items;
}

function isLinkActive(pathname: string, href: string): boolean {
  // Para el link "/" sólo es activo en la home exacta (para evitar que
  // siempre se vea activo cuando estamos en `/foo`).
  if (href === '/') return pathname === '/';

  // Match exacto o prefijo seguido de `/` o `?`.
  if (pathname === href) return true;
  const [pathHref] = href.split('?');
  if (!pathHref || pathHref === '/') return false;
  return pathname.startsWith(`${pathHref}/`);
}

/**
 * Barra de navegación superior, sticky, reutilizada por los layouts
 * `(app)`, `(dashboard)` y `(admin)`. Server Component: lee la sesión y
 * el unread count de notificaciones server-side y pasa solo datos
 * serializables a los Client Components hijos.
 */
export async function TopNav({ variant, session: passedSession }: TopNavProps) {
  const session = passedSession ?? (await getSessionAndProfile());

  // Defensivo: estos shells exigen sesión. El middleware y los layouts
  // ya redirigen, pero si por composición se renderiza sin sesión, paramos.
  if (!session?.user) {
    redirect('/login');
  }

  const { user, profile } = session;
  const config = VARIANT_CONFIG[variant];
  const role = profile?.role ?? 'user';

  // Detectar pathname desde el header inyectado por el middleware.
  const requestHeaders = await headers();
  const pathname = requestHeaders.get('x-pathname') ?? '/';

  // Unread count de notificaciones. Si falla, se renderiza la campana sin dot.
  let unreadCount = 0;
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null);
    if (!error && typeof count === 'number') {
      unreadCount = count;
    }
  } catch (err) {
    console.warn('[TopNav] Error fetching unread notifications count', err);
  }

  const links: NavLink[] = config.links.map((link) => ({
    ...link,
    isActive: isLinkActive(pathname, link.href),
  }));

  const dropdownItems = buildDropdownItems(role, variant);
  const displayName = profile?.full_name?.trim() || user.email?.split('@')[0] || 'Usuario';
  const email = user.email ?? '';
  const roleLabel = ROLE_LABEL[role] ?? role;

  return (
    <nav
      aria-label="Navegación principal"
      className={cn('sticky top-0 z-50 border-b border-divider', config.backgroundClass)}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={cn('flex items-center justify-between', config.heightClass)}>
          {/* Cluster izquierdo: logo + nav links */}
          <div className="flex items-center gap-6 md:gap-10">
            <Link
              href={config.homeHref}
              aria-label="LuxeEstate, inicio"
              className={cn(
                'flex shrink-0 items-center gap-2 rounded',
                'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
              )}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded bg-surface-inverse text-on-surface-inverse">
                <Icon name="apartment" size="md" />
              </span>
              <span className="text-lg font-semibold tracking-tight text-on-surface">
                LuxeEstate
              </span>
            </Link>

            <NavLinks links={links} variant={variant} />
          </div>

          {/* Cluster derecho: acciones */}
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <Link
              href="/search"
              aria-label="Buscar"
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-primary-soft hover:text-primary',
                'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
              )}
            >
              <Icon name="search" size="md" />
            </Link>

            <NotifBell unreadCount={unreadCount} />

            {config.showNameBlock && (
              <div className="hidden flex-col items-end sm:flex">
                <span className="text-sm leading-tight font-semibold text-on-surface">
                  {displayName}
                </span>
                <span className="text-xs leading-tight text-muted">{roleLabel}</span>
              </div>
            )}

            <div className="hidden md:block">
              <AvatarDropdown
                items={dropdownItems}
                displayName={displayName}
                email={email}
                avatarUrl={profile?.avatar_url ?? null}
              />
            </div>

            <MobileNavDrawer
              links={links}
              dropdownItems={dropdownItems}
              displayName={displayName}
              email={email}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
