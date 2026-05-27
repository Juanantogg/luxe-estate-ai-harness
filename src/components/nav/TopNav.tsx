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
   * Sesión ya resuelta:
   * - `undefined`: el TopNav la fetcha él mismo.
   * - `null`: el caller sabe que es anónimo (solo válido para `variant: 'app'`).
   * - objeto: hay sesión.
   */
  session?: { user: User; profile: Profile | null } | null;
}

/**
 * Forma extendida de los links dentro de VARIANT_CONFIG. NO se propaga al
 * Client Component `NavLinks` — los flags `enabled` y `requiresSession`
 * son de orquestación del config (qué podría renderizarse) y se
 * resuelven en este Server Component antes de pasar el array final al
 * cliente (lo que efectivamente se renderiza).
 */
type VariantLinkConfig = Omit<NavLink, 'isActive'> & {
  /** Si false, el link no se renderiza. Se usa para placeholders de
   *  features futuras que viven en el config para no perder el intent. */
  enabled?: boolean;
  /** Si true, el link solo se renderiza cuando hay sesión. */
  requiresSession?: boolean;
};

interface VariantConfig {
  /** Sets de links según variante. */
  links: VariantLinkConfig[];
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
      // TODO: feature `sell_property_flow` no implementada — la entrada
      // queda en el config para preservar el intent original; restituir
      // removiendo `enabled: false` cuando la ruta `/sell` exista.
      { href: '/sell', label: 'Vender', enabled: false },
      // /favorites existe pero es ruta privada: solo visible con sesión.
      { href: '/favorites', label: 'Guardados', requiresSession: true },
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
      // TODO: feature `agent_tenants_directory` no implementada.
      { href: '/dashboard/tenants', label: 'Inquilinos', enabled: false },
      // TODO: feature `agent_finance_dashboard` no implementada.
      { href: '/dashboard/finance', label: 'Finanzas', enabled: false },
    ],
    homeHref: '/dashboard',
    heightClass: 'h-16',
    backgroundClass: 'bg-surface/95 backdrop-blur-md',
    showNameBlock: true,
  },
  admin: {
    links: [
      { href: '/admin', label: 'Dashboard' },
      // TODO: feature `admin_properties_directory` no implementada.
      { href: '/admin/properties', label: 'Propiedades', enabled: false },
      { href: '/admin/users', label: 'Usuarios' },
      // TODO: feature `admin_inquiries_inbox` no implementada.
      { href: '/admin/inquiries', label: 'Consultas', enabled: false },
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

// Clases helper que replican Button variants para los CTAs anónimos.
// No se introduce un primitivo nuevo (`buttonClasses`) porque solo se usa
// aquí; si crece, se promueve a helper compartido.
const ANON_CTA_BASE =
  'inline-flex h-10 items-center justify-center rounded px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none';
const ANON_CTA_GHOST = 'bg-transparent text-on-surface hover:bg-primary-soft hover:text-primary';
const ANON_CTA_PRIMARY = 'bg-primary text-on-primary shadow-soft hover:bg-primary-hover';

/**
 * Barra de navegación superior, sticky, reutilizada por los layouts
 * `(app)`, `(dashboard)` y `(admin)`. Server Component: lee la sesión y
 * el unread count de notificaciones server-side y pasa solo datos
 * serializables a los Client Components hijos.
 *
 * Para `variant === 'app'` soporta el caso anónimo (`session === null`):
 * renderiza CTAs "Iniciar sesión" + "Registrarse" en lugar del avatar y
 * omite el query de notificaciones. Las variantes `dashboard` y `admin`
 * siguen requiriendo sesión y redirigen a `/login` si no la hay.
 */
export async function TopNav({ variant, session: passedSession }: TopNavProps) {
  const session = passedSession === undefined ? await getSessionAndProfile() : passedSession;

  // Defensivo: dashboard y admin asumen sesión. La variant `app` ahora
  // soporta anónimo (decisión de la feature `home_discover_screen`).
  if (!session?.user && variant !== 'app') {
    redirect('/login');
  }

  const config = VARIANT_CONFIG[variant];
  const profile = session?.profile ?? null;
  const user = session?.user ?? null;
  const role = profile?.role ?? 'user';

  // Unread count de notificaciones. Solo se consulta si hay sesión —
  // sin user el filtro `recipient_id` no tiene sentido y dispararía
  // queries inútiles (ver § 18 R10 del spec).
  let unreadCount = 0;
  if (user) {
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
  }

  // Los links se pasan plain (sin isActive precomputado). NavLinks y
  // MobileNavDrawer son Client Components que calculan `isActive` con
  // usePathname + useSearchParams; el TopNav vive en un layout y los
  // layouts no re-renderean al cambiar searchParams.
  //
  // Filtrado del config → array final que recibe el cliente:
  // 1) descarta links con `enabled: false` (placeholders de features
  //    futuras que viven en el config para preservar el intent).
  // 2) descarta links con `requiresSession: true` si no hay user.
  // 3) proyecta a `{ href, label }` para soltar `enabled` /
  //    `requiresSession` antes de pasar el objeto al cliente: NavLink
  //    no los espera.
  const links: NavLink[] = config.links
    .filter((link) => link.enabled !== false)
    .filter((link) => !link.requiresSession || Boolean(user))
    .map((link) => ({ href: link.href, label: link.label }));

  const dropdownItems = user ? buildDropdownItems(role, variant) : [];
  const displayName = user
    ? profile?.full_name?.trim() || user.email?.split('@')[0] || 'Usuario'
    : '';
  const email = user?.email ?? '';
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

            {user ? (
              <>
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
              </>
            ) : (
              <>
                <Link href="/login" className={cn(ANON_CTA_BASE, ANON_CTA_GHOST)}>
                  Iniciar sesión
                </Link>
                <Link
                  href="/login?mode=signup"
                  className={cn('hidden sm:inline-flex', ANON_CTA_BASE, ANON_CTA_PRIMARY)}
                >
                  Registrarse
                </Link>
                <MobileNavDrawer
                  links={links}
                  dropdownItems={[]}
                  displayName=""
                  email=""
                  anonymous
                />
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
