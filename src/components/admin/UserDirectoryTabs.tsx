import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import type { DirectoryRoleFilter } from '@/lib/admin/queries';

export interface UserDirectoryTabsProps {
  currentRole: DirectoryRoleFilter;
  currentQuery: string;
}

interface TabDef {
  value: DirectoryRoleFilter;
  label: string;
}

const TABS: ReadonlyArray<TabDef> = [
  { value: 'all', label: 'Todos' },
  { value: 'user', label: 'Usuarios' },
  { value: 'agent', label: 'Agentes' },
  { value: 'admin', label: 'Admins' },
];

function buildHref(role: DirectoryRoleFilter, query: string): string {
  const params = new URLSearchParams();
  if (role !== 'all') params.set('role', role);
  if (query) params.set('q', query);
  const qs = params.toString();
  return qs ? `/admin/users?${qs}` : '/admin/users';
}

/**
 * Tabs de filtro por rol (Todos / Usuarios / Agentes / Admins). Cada link
 * preserva `?q=` y resetea la paginación. Server Component: el estado
 * activo se deriva del searchParam que la page ya parseó.
 */
export function UserDirectoryTabs({ currentRole, currentQuery }: UserDirectoryTabsProps) {
  return (
    <div className="hide-scroll flex gap-6 overflow-x-auto border-b border-divider">
      {TABS.map((tab) => {
        const isActive = tab.value === currentRole;
        return (
          <Link
            key={tab.value}
            href={buildHref(tab.value, currentQuery)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'pb-3 whitespace-nowrap transition-colors',
              isActive
                ? 'border-b-2 border-primary text-sm font-semibold text-primary'
                : 'text-sm font-medium text-muted hover:text-on-surface',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
