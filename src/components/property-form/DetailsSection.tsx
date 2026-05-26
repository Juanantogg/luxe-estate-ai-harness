'use client';

import { memo, useId } from 'react';
import { CounterPill } from '@/components/search/CounterPill';
import { Icon } from '@/components/ui';
import { groupAmenitiesByCategory } from '@/lib/properties/amenity-categories';
import type { AmenityKey } from '@/lib/properties/amenities';
import type { PropertyFormValues } from '@/lib/properties/form-schemas';
import { cn } from '@/lib/utils/cn';
import { SectionCard } from './SectionCard';

export interface DetailsSectionProps {
  values: Pick<
    PropertyFormValues,
    'area_sqm' | 'year_built' | 'bedrooms' | 'bathrooms' | 'parking_spaces' | 'amenities'
  >;
  errors: Record<string, string | undefined>;
  onChange: <K extends keyof PropertyFormValues>(field: K, value: PropertyFormValues[K]) => void;
  onToggleAmenity: (amenity: AmenityKey, checked: boolean) => void;
}

const AMENITY_GROUPS = groupAmenitiesByCategory();

/**
 * Card 5 — Details (spec §6.3). Area + Year en sub-grid 2-cols,
 * counters de Bedrooms / Bathrooms / Parking (max=20, formato String(n))
 * y amenities agrupadas Interior / Exterior / Servicios.
 */
function DetailsSectionInner({ values, errors, onChange, onToggleAmenity }: DetailsSectionProps) {
  const areaId = useId();
  const yearId = useId();
  const selectedSet = new Set<AmenityKey>(values.amenities);

  return (
    <SectionCard title="Detalles" icon="straighten">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={areaId} className="mb-1.5 block text-sm font-medium text-on-surface">
              Área (m²) *
            </label>
            <input
              id={areaId}
              type="number"
              inputMode="decimal"
              min={0}
              step={1}
              value={values.area_sqm}
              onChange={(e) => onChange('area_sqm', e.target.value)}
              placeholder="120"
              className={cn(
                'block w-full rounded border bg-surface px-4 py-2.5 text-sm text-on-surface placeholder:text-muted',
                'transition-colors duration-200',
                'focus:ring-2 focus:outline-none',
                errors.area_sqm
                  ? 'border-danger focus:border-danger focus:ring-danger'
                  : 'border-outline focus:border-primary focus:ring-primary',
              )}
              aria-invalid={errors.area_sqm ? true : undefined}
            />
            {errors.area_sqm ? <p className="mt-1 text-xs text-danger">{errors.area_sqm}</p> : null}
          </div>
          <div>
            <label htmlFor={yearId} className="mb-1.5 block text-sm font-medium text-on-surface">
              Año construcción *
            </label>
            <input
              id={yearId}
              type="number"
              inputMode="numeric"
              min={1800}
              max={2100}
              step={1}
              value={values.year_built}
              onChange={(e) => onChange('year_built', e.target.value)}
              placeholder="2020"
              className={cn(
                'block w-full rounded border bg-surface px-4 py-2.5 text-sm text-on-surface placeholder:text-muted',
                'transition-colors duration-200',
                'focus:ring-2 focus:outline-none',
                errors.year_built
                  ? 'border-danger focus:border-danger focus:ring-danger'
                  : 'border-outline focus:border-primary focus:ring-primary',
              )}
              aria-invalid={errors.year_built ? true : undefined}
            />
            {errors.year_built ? (
              <p className="mt-1 text-xs text-danger">{errors.year_built}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 border-t border-divider-soft pt-4">
          <CounterRow
            label="Habitaciones"
            icon="bed"
            value={values.bedrooms}
            onChange={(n) => onChange('bedrooms', n)}
          />
          <CounterRow
            label="Baños"
            icon="shower"
            value={Math.floor(values.bathrooms)}
            onChange={(n) => onChange('bathrooms', n)}
          />
          <CounterRow
            label="Estacionamiento"
            icon="directions_car"
            value={values.parking_spaces}
            onChange={(n) => onChange('parking_spaces', n)}
          />
        </div>

        <div className="space-y-4 border-t border-divider-soft pt-4">
          <p className="text-sm font-semibold tracking-wider text-muted uppercase">Amenidades</p>
          {AMENITY_GROUPS.map((group) => (
            <fieldset key={group.category}>
              <legend className="mb-2 text-xs font-medium text-muted">{group.label}</legend>
              <div className="space-y-2">
                {group.items.map((item) => {
                  const checked = selectedSet.has(item.key);
                  return (
                    <label
                      key={item.key}
                      className="flex cursor-pointer items-center gap-2 text-sm text-on-surface"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => onToggleAmenity(item.key, e.target.checked)}
                        className="h-4 w-4 cursor-pointer accent-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                      />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

interface CounterRowProps {
  label: string;
  icon: string;
  value: number;
  onChange: (n: number) => void;
}

function CounterRow({ label, icon, value, onChange }: CounterRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-on-surface">
        <Icon name={icon} size="sm" className="text-muted" />
        <span className="font-medium">{label}</span>
      </div>
      <CounterPill
        label=""
        value={value}
        onChange={onChange}
        min={0}
        max={20}
        formatValue={(n) => String(n)}
        decrementLabel={`Quitar uno a ${label}`}
        incrementLabel={`Agregar uno a ${label}`}
      />
    </div>
  );
}

export const DetailsSection = memo(DetailsSectionInner);
