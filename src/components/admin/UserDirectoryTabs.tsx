import Link from 'next/link';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import type { DirectoryTab } from '@/lib/admin/queries';

export interface UserDirectoryTabsProps {
  currentTab: DirectoryTab;
  currentQuery: string;
  pendingCount: number;
}

interface TabDef {
  value: DirectoryTab;
  label: string;
}

/**
 * Tab "Invitaciones" al final (decisión §5.3 del spec): las primeras 4 son
 * "el universo permanente" por rol; "Invitaciones" es transitoria — se
 * vacía a medida que los pending aceptan.
 */
const TABS: ReadonlyArray<TabDef> = [
  { value: 'all', label: 'Todos' },
  { value: 'user', label: 'Usuarios' },
  { value: 'agent', label: 'Agentes' },
  { value: 'admin', label: 'Admins' },
  { value: 'pending', label: 'Invitaciones' },
];

function buildHref(tab: DirectoryTab, query: string): string {
  const params = new URLSearchParams();
  if (tab !== 'all') params.set('tab', tab);
  if (query) params.set('q', query);
  const qs = params.toString();
  return qs ? `/admin/users?${qs}` : '/admin/users';
}

/**
 * Tabs del directorio (Todos / Usuarios / Agentes / Admins / Invitaciones).
 *
 * Cada link preserva `?q=` y resetea la paginación. Server Component:
 * el estado activo se deriva del searchParam que la page ya parseó.
 *
 * La tab "Invitaciones" muestra un badge `variant="warning"` con el count
 * cuando `pendingCount > 0`; queda visible (sin badge) cuando hay cero
 * pending — el admin necesita poder confirmar que no hay nada que atender.
 */
export function UserDirectoryTabs({
  currentTab,
  currentQuery,
  pendingCount,
}: UserDirectoryTabsProps) {
  return (
    <div className="hide-scroll flex gap-6 overflow-x-auto border-b border-divider">
      {TABS.map((tab) => {
        const isActive = tab.value === currentTab;
        const showBadge = tab.value === 'pending' && pendingCount > 0;
        return (
          <Link
            key={tab.value}
            href={buildHref(tab.value, currentQuery)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={showBadge ? `${tab.label} (${pendingCount} pendientes)` : undefined}
            className={cn(
              'inline-flex items-center gap-2 pb-3 whitespace-nowrap transition-colors',
              isActive
                ? 'border-b-2 border-primary text-sm font-semibold text-primary'
                : 'text-sm font-medium text-muted hover:text-on-surface',
            )}
          >
            {tab.label}
            {showBadge && (
              <Badge variant="warning" size="sm" aria-hidden="true">
                {pendingCount}
              </Badge>
            )}
          </Link>
        );
      })}
    </div>
  );
}
