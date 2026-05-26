'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/utils/cn';

export interface NotificationsToggleProps {
  label: string;
  defaultChecked?: boolean;
}

/**
 * Toggle placeholder de notificaciones. Solo persiste durante la sesión
 * local — el schema actual de `profiles` no tiene columna para guardar la
 * preferencia. La persistencia real se agregará junto con la feature
 * `notifications_dropdown` (deuda documentada en design.md §Estados).
 */
export function NotificationsToggle({ label, defaultChecked = true }: NotificationsToggleProps) {
  const [checked, setChecked] = useState(defaultChecked);
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={cn(
        'flex h-[50px] cursor-pointer items-center justify-between gap-3 rounded-lg border border-outline bg-background px-3',
        'transition-colors hover:border-primary',
        'focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-surface',
      )}
    >
      <span className="text-sm text-on-surface">{label}</span>
      <span className="relative inline-flex">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            'block h-5 w-9 rounded-full bg-neutral-200 transition-colors',
            'peer-checked:bg-primary',
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-surface shadow-card transition-transform content-['']",
            'peer-checked:translate-x-4',
          )}
        />
      </span>
    </label>
  );
}
