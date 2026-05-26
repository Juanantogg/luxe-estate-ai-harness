import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

export type DashboardStatTone = 'primary' | 'success' | 'warning';

export interface DashboardStatCardProps {
  label: string;
  value: number;
  icon: string;
  tone: DashboardStatTone;
}

const TONE_CLASSES: Record<DashboardStatTone, string> = {
  primary: 'bg-primary-soft text-primary',
  success: 'bg-surface-soft text-primary',
  warning: 'bg-warning-soft text-warning',
};

const NUMBER_FORMATTER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

/**
 * Card de overview que muestra un counter del dashboard. Tres se renderean
 * juntas: Total / Activas / Pendientes.
 *
 * Usamos `<dl><dt><dd>` para que screen readers lean el par
 * "Activas: 8" como término/valor (spec §"Notas > A11y").
 */
export function DashboardStatCard({ label, value, icon, tone }: DashboardStatCardProps) {
  return (
    <article className="flex items-center justify-between rounded-xl border border-divider-soft bg-surface p-5 shadow-card">
      <dl className="flex flex-col">
        <dt className="text-sm font-medium text-muted">{label}</dt>
        <dd className="mt-1 text-2xl font-bold text-on-surface">
          {NUMBER_FORMATTER.format(value)}
        </dd>
      </dl>
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          TONE_CLASSES[tone],
        )}
      >
        <Icon name={icon} size="md" />
      </div>
    </article>
  );
}
