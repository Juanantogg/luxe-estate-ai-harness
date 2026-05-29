import Link from 'next/link';
import { Avatar, Icon } from '@/components/ui';
import { getPropertyUrl } from '@/lib/properties';
import type { OwnerProfileFull, UserRole } from '@/lib/properties/queries';
import { cn } from '@/lib/utils/cn';

export interface AgentBadgeProps {
  owner: OwnerProfileFull | null;
  isAuthenticated: boolean;
  /** Para construir el redirect `next=` cuando un visitante anónimo
   *  toca uno de los IconButtons de contacto. */
  propertySlug: string;
}

const ROLE_LABEL: Record<UserRole, string> = {
  user: 'Usuario',
  agent: 'Agente',
  broker: 'Broker',
  admin: 'Administrador',
};

/**
 * Bloque de presentación del agente dueño de la propiedad: avatar + nombre
 * + rol traducido + iconos de contacto (mail, call).
 *
 * Reglas:
 * - Anon → IconButtons visibles que redirigen a /login?next=/property/[id]
 *   (mismo patrón que `FavoriteButton`).
 * - Auth + email presente → ícono `mail_outline` abre `mailto:` con el
 *   título de la propiedad como subject. Si NO hay email, ícono oculto.
 * - Auth + phone presente → ícono `call` abre `tel:`. Si NO hay phone,
 *   ícono oculto.
 * - Si el `owner` es null (caso edge: trigger no corrió), muestra fallback
 *   con label "Información del agente no disponible.".
 *
 * Server Component: anchors estáticos, sin estado.
 *
 * NOTA sobre el ícono "mail_outline" en lugar de "chat": el mockup usa
 * `chat`, pero hoy NO existe mensajería interna implementada. Mostrar
 * `chat` sugiere una funcionalidad inexistente; `mail_outline` es honesto
 * con el fallback `mailto:`.
 */
export function AgentBadge({ owner, isAuthenticated, propertySlug }: AgentBadgeProps) {
  if (!owner) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted italic">
        <Avatar size="lg" />
        <span>Información del agente no disponible.</span>
      </div>
    );
  }

  const loginHref = `/login?next=${encodeURIComponent(getPropertyUrl({ slug: propertySlug }))}`;
  const mailHref = owner.email ? `mailto:${owner.email}` : null;
  const telHref = owner.phone ? `tel:${owner.phone}` : null;

  // Renderizamos siempre el botón mail (con redirect a login si anon, o
  // disabled si auth sin email). El call solo si hay tel disponible o
  // estamos en anon (donde sirve para llevar al login).
  return (
    <div className="flex items-center gap-4">
      <Avatar
        src={owner.avatar_url ?? undefined}
        name={owner.full_name ?? undefined}
        size="lg"
        alt={owner.full_name ?? 'Agente'}
      />
      <div className="min-w-0">
        <h3 className="truncate font-semibold text-on-surface">
          {owner.full_name ?? 'Agente Luxe Estate'}
        </h3>
        <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-primary">
          <Icon name="star" size="xs" />
          <span>{ROLE_LABEL[owner.role]} verificado</span>
        </p>
      </div>

      <div className="ml-auto flex gap-2">
        <ContactIcon
          icon="mail_outline"
          ariaLabel={
            isAuthenticated
              ? mailHref
                ? `Enviar correo a ${owner.full_name ?? 'el agente'}`
                : 'Correo no disponible'
              : 'Iniciar sesión para enviar correo'
          }
          href={isAuthenticated ? mailHref : loginHref}
          disabled={isAuthenticated && !mailHref}
        />
        <ContactIcon
          icon="call"
          ariaLabel={
            isAuthenticated
              ? telHref
                ? `Llamar a ${owner.full_name ?? 'el agente'}`
                : 'Teléfono no disponible'
              : 'Iniciar sesión para llamar'
          }
          href={isAuthenticated ? telHref : loginHref}
          disabled={isAuthenticated && !telHref}
        />
      </div>
    </div>
  );
}

interface ContactIconProps {
  icon: string;
  ariaLabel: string;
  href: string | null;
  disabled: boolean;
}

function ContactIcon({ icon, ariaLabel, href, disabled }: ContactIconProps) {
  const baseClasses = cn(
    'inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors',
    'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
  );

  if (disabled || !href) {
    return (
      <span
        aria-label={ariaLabel}
        title={ariaLabel}
        className={cn(baseClasses, 'bg-primary-soft text-primary/40')}
      >
        <Icon name={icon} size="sm" />
      </span>
    );
  }

  const isExternalScheme =
    href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('http');

  if (isExternalScheme) {
    return (
      <a
        href={href}
        aria-label={ariaLabel}
        className={cn(
          baseClasses,
          'bg-primary-soft text-primary hover:bg-primary hover:text-on-primary',
        )}
      >
        <Icon name={icon} size="sm" />
      </a>
    );
  }

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cn(
        baseClasses,
        'bg-primary-soft text-primary hover:bg-primary hover:text-on-primary',
      )}
    >
      <Icon name={icon} size="sm" />
    </Link>
  );
}
