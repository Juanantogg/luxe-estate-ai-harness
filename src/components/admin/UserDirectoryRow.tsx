import { Avatar, Button } from '@/components/ui';
import type { AdminUserRow } from '@/lib/admin/queries';
import { formatSalesShort } from '@/lib/admin/format';
import { cn } from '@/lib/utils/cn';
import { ChangeRoleMenu } from './ChangeRoleMenu';
import { ResendInvitationButton } from './ResendInvitationButton';
import { UserRoleBadge } from './UserRoleBadge';
import { UserStatusIndicator, deriveUserStatus } from './UserStatusIndicator';

export interface UserDirectoryRowProps {
  user: AdminUserRow;
  callerId: string;
}

const ID_PREFIX = '#';

function shortId(id: string): string {
  return `${ID_PREFIX}${id.slice(0, 8)}`;
}

/**
 * Fila/card de un usuario en el directorio admin.
 *
 * - Mobile (<md): card stacked vertical.
 * - md+: grid 12-col (5 / 3 / 2 / 2).
 *
 * Render del bloque de acciones:
 *  - Si `user.id === callerId` (decisión C3): fila pintada con
 *    `bg-surface-soft` (hint-green) sin hover override; botón disabled
 *    "No editable".
 *  - Si `status === 'pending'`:
 *    - Si `user.canResendInvitation` (last_invited_at ≥ 1h): botón activo
 *      "Reenviar invitación" que dispara la Server Action.
 *    - Si no: botón disabled "Pendiente" — el link enviado todavía es
 *      válido. Los canales visuales son el icono `mail_outline` warning
 *      + Avatar `away` + botón disabled.
 *  - En cualquier otro caso: `ChangeRoleMenu` normal.
 */
export function UserDirectoryRow({ user, callerId }: UserDirectoryRowProps) {
  const isCaller = user.id === callerId;
  const displayName = user.full_name?.trim() || user.email;
  const titleId = `admin-user-row-${user.id}`;
  const status = deriveUserStatus(user);
  const avatarStatus: 'online' | 'away' | 'offline' =
    status === 'pending' ? 'away' : status === 'active' ? 'online' : 'offline';

  const liClassName = cn(
    'border-b border-divider-soft last:border-b-0 transition-colors',
    isCaller ? 'bg-surface-soft' : 'hover:bg-surface-hover',
  );

  const avatarNode = (
    <Avatar
      size="lg"
      src={user.avatar_url ?? undefined}
      name={displayName}
      alt={`Avatar de ${displayName}`}
      status={avatarStatus}
    />
  );

  const identityNode = (
    <div className="min-w-0 flex-1">
      <p id={titleId} className="truncate text-sm font-bold text-on-surface">
        {displayName}
      </p>
      <p className="truncate text-xs text-muted">{user.email}</p>
      <span
        aria-label="ID de usuario"
        className="mt-1 inline-block rounded bg-neutral-100 px-2 py-0.5 text-[10px] text-muted"
      >
        ID: {shortId(user.id)}
      </span>
    </div>
  );

  const roleStatusNode = (
    <div className="flex flex-wrap items-center gap-3">
      <UserRoleBadge role={user.role} />
      <UserStatusIndicator status={status} />
    </div>
  );

  const performanceNode = (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="text-[10px] tracking-wider text-muted uppercase">Propiedades</div>
        <div className="text-sm font-semibold text-on-surface">{user.properties_count ?? '—'}</div>
      </div>
      <div>
        <div className="text-[10px] tracking-wider text-muted uppercase">Ventas (año)</div>
        <div className="text-sm font-semibold text-on-surface">
          {user.sales_ytd != null ? formatSalesShort(user.sales_ytd) : '—'}
        </div>
      </div>
    </div>
  );

  const actionsNode = isCaller ? (
    <Button
      variant="secondary"
      size="sm"
      disabled
      aria-disabled="true"
      title="No puedes cambiar tu propio rol"
      className="md:w-auto"
      fullWidth
    >
      No editable
    </Button>
  ) : status === 'pending' ? (
    user.canResendInvitation ? (
      <ResendInvitationButton
        userId={user.id}
        userEmail={user.email}
        userDisplayName={displayName}
      />
    ) : (
      <Button
        variant="secondary"
        size="sm"
        disabled
        aria-disabled="true"
        title="Esperando que el usuario acepte la invitación. Si pasa más de una hora podrás reenviarla."
        className="md:w-auto"
        fullWidth
      >
        Pendiente
      </Button>
    )
  ) : (
    <ChangeRoleMenu
      userId={user.id}
      currentRole={user.role}
      currentIsActive={user.is_active}
      userDisplayName={displayName}
    />
  );

  return (
    <li aria-labelledby={titleId} className={liClassName}>
      {/* Mobile card (<md) */}
      <div className="flex flex-col gap-3 p-4 md:hidden">
        <div className="flex items-start gap-3">
          {avatarNode}
          {identityNode}
        </div>
        {roleStatusNode}
        {performanceNode}
        <div className="pt-1">{actionsNode}</div>
      </div>

      {/* Desktop grid (md+) */}
      <div className="hidden grid-cols-12 items-center gap-4 px-6 py-5 md:grid">
        <div className="col-span-5 flex items-center gap-4">
          {avatarNode}
          {identityNode}
        </div>
        <div className="col-span-3">{roleStatusNode}</div>
        <div className="col-span-2">{performanceNode}</div>
        <div className="col-span-2 flex justify-end">{actionsNode}</div>
      </div>
    </li>
  );
}
