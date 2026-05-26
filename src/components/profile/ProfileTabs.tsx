'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { parseProfileTab, type ProfileTab } from './tabs-shared';

export interface ProfileTabsProps {
  tabs: ReadonlyArray<ProfileTab>;
}

/**
 * Tabs del perfil implementadas como `<Link>` (no `<button>`): preservan
 * back/forward del navegador y permiten deeplinking (`/profile?tab=visits`).
 *
 * Es Client Component porque lee `useSearchParams` para resolver la tab
 * activa al instante tras una navegación SPA (mismo patrón que `NavLinks`
 * del TopNav: el `(app)/layout.tsx` no se re-renderea al cambiar
 * `searchParams` en Next 16, así que el cálculo activo debe hacerse en el
 * cliente para no quedar desfasado).
 *
 * No usamos `role="tablist"` porque los paneles vienen de Server Components
 * vía URL — no es un tablist puro. `aria-current="page"` en el link activo
 * cubre la semántica para AT.
 */
export function ProfileTabs({ tabs }: ProfileTabsProps) {
  const searchParams = useSearchParams();
  const active = parseProfileTab(searchParams.get('tab') ?? undefined);

  return (
    <nav
      aria-label="Secciones del perfil"
      className="hide-scroll mb-8 flex items-center gap-6 overflow-x-auto border-b border-divider sm:gap-8"
    >
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <Link
            key={tab.value}
            href={`/profile?tab=${tab.value}`}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'inline-flex shrink-0 border-b-2 px-1 pb-4 text-sm transition-colors sm:px-2',
              'focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
              isActive
                ? 'border-primary font-semibold text-on-surface'
                : 'border-transparent font-medium text-muted hover:border-divider hover:text-on-surface',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
