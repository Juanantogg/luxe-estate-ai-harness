import type { ProfileStats as Stats } from '@/lib/profile/queries';
import { cn } from '@/lib/utils/cn';

export interface ProfileStatsProps {
  stats: Stats;
  className?: string;
}

interface StatItem {
  label: string;
  value: number;
  accent?: boolean;
}

/**
 * Card blanca con 2 o 3 contadores (favoritos / visitas / vendidas) que vive
 * dentro del `ProfileHeader`. El número de "Visitas" se pinta con `text-primary`
 * para acentuar (replica del mockup).
 *
 * El contador "Vendidas" se omite cuando `role === 'user'`: el counter de
 * propiedades vendidas solo aplica a agent/broker/admin. Decisión humana
 * 2026-05-25.
 */
export function ProfileStats({ stats, className }: ProfileStatsProps) {
  const items: StatItem[] = [
    { label: 'Guardadas', value: stats.favoritesCount },
    { label: 'Visitas', value: stats.visitsCount, accent: true },
  ];

  if (stats.soldCount !== null) {
    items.push({ label: 'Vendidas', value: stats.soldCount });
  }

  return (
    <div
      className={cn(
        'flex w-full items-stretch gap-4 rounded-xl bg-surface px-6 py-4 shadow-card sm:gap-6 lg:gap-12',
        'border border-divider-soft',
        'md:w-auto',
        className,
      )}
      role="group"
      aria-label="Resumen de actividad"
    >
      {items.map((item, idx) => (
        <div key={item.label} className="flex items-stretch gap-4 sm:gap-6 lg:gap-12">
          {idx > 0 && <div className="w-px self-stretch bg-divider" aria-hidden="true" />}
          <div className="flex flex-1 flex-col items-center text-center">
            <div
              className={cn(
                'text-2xl font-bold tabular-nums',
                item.accent ? 'text-primary' : 'text-on-surface',
              )}
            >
              {String(item.value).padStart(2, '0')}
            </div>
            <div className="mt-1 text-xs font-medium tracking-wider text-muted uppercase">
              {item.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
