import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

export interface SectionCardProps {
  /** Título visible en el header (texto en español). */
  title: string;
  /** Nombre del Material Icon usado en el círculo de la izquierda. */
  icon: string;
  /** Elemento opcional alineado a la derecha del header (Badge, contador, etc.). */
  trailing?: React.ReactNode;
  /** Texto descriptivo bajo el título. */
  description?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Card de sección del formulario crear/editar propiedad (spec §6.3).
 * Header con ícono circular + título + descripción opcional. El body
 * tiene padding propio.
 *
 * Usado por las 5 secciones (Basic Info, Description, Gallery, Location,
 * Details). El componente es agnóstico al contenido.
 */
export function SectionCard({
  title,
  icon,
  trailing,
  description,
  className,
  children,
}: SectionCardProps) {
  return (
    <section
      className={cn('rounded-xl border border-divider-soft bg-surface shadow-soft', className)}
    >
      <header className="flex items-start justify-between gap-3 rounded-t-xl bg-gradient-to-r from-surface-soft/40 to-transparent px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-soft text-on-surface">
            <Icon name={icon} size="sm" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-on-surface sm:text-lg">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-muted sm:text-sm">{description}</p>
            ) : null}
          </div>
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </header>
      <div className="px-5 pb-6 sm:px-6">{children}</div>
    </section>
  );
}
