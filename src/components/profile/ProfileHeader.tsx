import { Icon } from '@/components/ui';
import type { ProfileStats as Stats } from '@/lib/profile/queries';
import type { UserRole } from '@/lib/properties/queries';
import { ProfileAvatarEditor } from './ProfileAvatarEditor';
import { ProfileStats } from './ProfileStats';

export interface ProfileHeaderProps {
  profile: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    city: string | null;
    member_since: string;
    role: UserRole;
  };
  stats: Stats;
}

/**
 * Devuelve el "nombre de pantalla" del user: prioriza `full_name`, cae al
 * local-part del email si está vacío. Usado en `<h1>` y como base de las
 * iniciales del avatar.
 */
function getDisplayName(profile: { full_name: string | null; email: string }): string {
  if (profile.full_name && profile.full_name.trim()) return profile.full_name.trim();
  const local = profile.email.split('@')[0] ?? '';
  return local || 'Tu perfil';
}

/**
 * Devuelve el año de `member_since` formateado en es-MX. Falla suave (devuelve
 * `null` si la fecha es inválida) para que el header no rompa por un dato
 * corrupto.
 */
function formatMemberSinceYear(memberSince: string): string | null {
  const date = new Date(memberSince);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-MX', { year: 'numeric' }).format(date);
}

/**
 * Header verde del perfil con avatar editable, identidad (nombre + ciudad +
 * antigüedad) y stats al lado.
 *
 * Server Component que orquesta el `ProfileAvatarEditor` (client) y
 * `ProfileStats` (server). Devolvemos textos en español; el bloque de
 * ciudad se omite si `profile.city` es null para no pintar "·" suelto.
 */
export function ProfileHeader({ profile, stats }: ProfileHeaderProps) {
  const displayName = getDisplayName(profile);
  const memberYear = formatMemberSinceYear(profile.member_since);

  return (
    <header
      aria-labelledby="profile-name"
      className="mb-10 flex flex-col gap-6 rounded-2xl border border-divider-soft bg-surface-soft p-6 shadow-soft sm:p-8 md:flex-row md:items-center md:justify-between md:gap-8"
    >
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <ProfileAvatarEditor avatarUrl={profile.avatar_url} displayName={displayName} />
        <div className="min-w-0 text-center sm:text-left">
          <h1
            id="profile-name"
            className="text-3xl font-bold tracking-tight text-on-surface lg:text-4xl"
          >
            {displayName}
          </h1>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 text-sm font-light text-muted sm:justify-start">
            {profile.city && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="location_on" size="sm" />
                  {profile.city}
                </span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span>{memberYear ? `Miembro desde ${memberYear}` : 'Miembro de Luxe Estate'}</span>
          </p>
        </div>
      </div>

      <ProfileStats stats={stats} />
    </header>
  );
}
