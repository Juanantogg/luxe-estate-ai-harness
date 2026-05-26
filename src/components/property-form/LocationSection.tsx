'use client';

import { memo } from 'react';
import { PropertyMapPreview } from '@/components/property/PropertyMapPreview';
import { Input } from '@/components/ui';
import type { PropertyFormValues } from '@/lib/properties/form-schemas';
import { SectionCard } from './SectionCard';

export interface LocationSectionProps {
  values: Pick<PropertyFormValues, 'address_line' | 'city' | 'state' | 'country' | 'postal_code'>;
  errors: Record<string, string | undefined>;
  onChange: <K extends keyof PropertyFormValues>(field: K, value: PropertyFormValues[K]) => void;
}

function composeAddress(values: LocationSectionProps['values']): string {
  return [values.address_line, values.city, values.state, values.country]
    .map((s) => s?.trim())
    .filter((s) => s && s.length > 0)
    .join(', ');
}

/**
 * Card 4 — Location (spec §6.3). Inputs de dirección + preview de mapa
 * placeholder. Sin geocoding (deuda §12).
 */
function LocationSectionInner({ values, errors, onChange }: LocationSectionProps) {
  const composed = composeAddress(values);

  return (
    <SectionCard title="Ubicación" icon="place">
      <div className="space-y-4">
        <Input
          label="Dirección *"
          name="address_line"
          value={values.address_line}
          onChange={(e) => onChange('address_line', e.target.value)}
          placeholder="Calle, número, colonia"
          maxLength={500}
          error={errors.address_line}
        />
        <Input
          label="Ciudad *"
          name="city"
          value={values.city}
          onChange={(e) => onChange('city', e.target.value)}
          placeholder="Ciudad de México"
          maxLength={200}
          error={errors.city}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Estado"
            name="state"
            value={values.state}
            onChange={(e) => onChange('state', e.target.value)}
            placeholder="CDMX"
            maxLength={200}
            error={errors.state}
          />
          <Input
            label="País"
            name="country"
            value={values.country}
            onChange={(e) => onChange('country', e.target.value)}
            placeholder="México"
            maxLength={200}
            error={errors.country}
          />
        </div>
        <Input
          label="Código postal"
          name="postal_code"
          value={values.postal_code}
          onChange={(e) => onChange('postal_code', e.target.value)}
          placeholder="01000"
          maxLength={20}
          error={errors.postal_code}
        />

        <div className="pt-2">
          <p className="mb-2 text-xs font-medium text-muted">Vista previa</p>
          <PropertyMapPreview latitude={null} longitude={null} address={composed || 'México'} />
        </div>
      </div>
    </SectionCard>
  );
}

export const LocationSection = memo(LocationSectionInner);
