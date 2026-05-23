'use client';

import { Icon } from '@/components/ui';
import { AMENITY_ICON, AMENITY_LABEL_ES, type AmenityKey } from '@/lib/properties/amenities';
import { cn } from '@/lib/utils/cn';
import { Constants } from '@/types/database';

const AMENITY_KEYS = Constants.public.Enums.amenity_key as readonly AmenityKey[];

export interface AmenityChipGroupProps {
  /** Conjunto de amenities seleccionadas (orden no semántico). */
  selected: AmenityKey[];
  onChange: (next: AmenityKey[]) => void;
}

/**
 * Grid de chips toggleables (una por amenity del enum). Cada chip es un
 * `<label>` con un `<input type="checkbox">` `sr-only` para conservar la
 * semántica nativa de grupo de checkboxes. El estado visual se controla con
 * `peer-checked:`.
 *
 * Spec: §"Anatomía §4 Amenities" + §"Componentes → AmenityChipGroup".
 *
 * Filtro OR: el server hace `IN (...)` sobre `property_amenities.amenity` y
 * matchea propiedades con AL MENOS UNA seleccionada (decisión humana
 * 2026-05-23).
 */
export function AmenityChipGroup({ selected, onChange }: AmenityChipGroupProps) {
  const selectedSet = new Set(selected);

  const toggle = (key: AmenityKey, checked: boolean) => {
    if (checked) {
      onChange([...selected.filter((k) => k !== key), key]);
    } else {
      onChange(selected.filter((k) => k !== key));
    }
  };

  return (
    <div role="group" aria-label="Amenidades" className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {AMENITY_KEYS.map((key) => {
        const isChecked = selectedSet.has(key);
        return (
          <label
            key={key}
            className={cn(
              'relative flex h-full cursor-pointer items-center justify-center gap-2 rounded border px-3 py-3 text-sm transition-colors',
              'focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2',
              isChecked
                ? 'border-primary bg-primary-soft font-medium text-primary'
                : 'border-outline bg-surface text-muted hover:border-primary/40 hover:text-on-surface',
            )}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => toggle(key, e.target.checked)}
              className="peer sr-only"
              aria-label={AMENITY_LABEL_ES[key]}
            />
            <Icon
              name={AMENITY_ICON[key]}
              size="sm"
              className={cn(isChecked ? 'text-primary' : 'text-muted')}
            />
            <span className="truncate">{AMENITY_LABEL_ES[key]}</span>
            {isChecked && (
              <span
                aria-hidden
                className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary"
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
