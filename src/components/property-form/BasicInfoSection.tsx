'use client';

import { memo, useId } from 'react';
import { Icon, Input } from '@/components/ui';
import {
  getListingTypeOptions,
  getPropertyTypeOptions,
  type PropertyFormValues,
} from '@/lib/properties/form-schemas';
import { cn } from '@/lib/utils/cn';
import { SectionCard } from './SectionCard';

export interface BasicInfoSectionProps {
  values: Pick<PropertyFormValues, 'title' | 'price' | 'listing_type' | 'property_type'>;
  errors: Record<string, string | undefined>;
  onChange: <K extends keyof PropertyFormValues>(field: K, value: PropertyFormValues[K]) => void;
  /**
   * Slug actual de la property en modo edit. Si está definido, se renderiza
   * el bloque "URL pública" read-only debajo del título. En modo create
   * (slug aún no generado) se omite por completo. Ver
   * `progress/property_pretty_urls/design.md` §5.
   */
  initialSlug?: string | null;
}

/**
 * Card 1 — Basic Information (spec §6.3).
 *
 * Campos: title (text), price (number con prefix $), status=listing_type
 * (select), property_type (select). Layout: title full-width, después
 * grid 3-cols en md+.
 *
 * Si `initialSlug` viene definido (modo edit), se agrega un bloque de
 * display read-only con la URL pública de la property (no es input, no
 * participa del schema Zod — es metadata inmutable, ver design §5).
 */
function BasicInfoSectionInner({ values, errors, onChange, initialSlug }: BasicInfoSectionProps) {
  const priceId = useId();
  const listingTypeId = useId();
  const propertyTypeId = useId();
  const listingOptions = getListingTypeOptions();
  const typeOptions = getPropertyTypeOptions();

  const selectBase = cn(
    'block w-full rounded border bg-surface px-4 py-2.5 text-sm text-on-surface',
    'transition-colors duration-200',
    'focus:ring-2 focus:outline-none focus:border-primary focus:ring-primary',
  );

  return (
    <SectionCard title="Información básica" icon="info">
      <div className="space-y-6">
        <Input
          label="Título de la propiedad *"
          name="title"
          value={values.title}
          onChange={(e) => onChange('title', e.target.value)}
          placeholder="Penthouse moderno con vista al mar"
          maxLength={200}
          error={errors.title}
          autoComplete="off"
        />

        {initialSlug ? (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted" htmlFor="property-slug-display">
              URL pública
            </label>
            <div
              id="property-slug-display"
              className="flex items-center gap-2 rounded-md border border-divider-soft bg-surface-soft px-3 py-2 text-sm text-on-surface"
            >
              <Icon name="link" size="xs" className="shrink-0 text-muted" />
              <code className="truncate font-mono text-xs">/property/{initialSlug}</code>
            </div>
            <p className="text-xs text-muted">
              La URL no cambia aunque edites el título. Generada al crear la propiedad.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label htmlFor={priceId} className="mb-1.5 block text-sm font-medium text-on-surface">
              Precio *
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">
                $
              </span>
              <input
                id={priceId}
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                value={values.price}
                onChange={(e) => onChange('price', e.target.value)}
                placeholder="0"
                className={cn(
                  'block w-full rounded border bg-surface py-2.5 pr-3 pl-7 text-sm text-on-surface placeholder:text-muted',
                  'transition-colors duration-200',
                  'focus:ring-2 focus:outline-none',
                  errors.price
                    ? 'border-danger focus:border-danger focus:ring-danger'
                    : 'border-outline focus:border-primary focus:ring-primary',
                )}
                aria-invalid={errors.price ? true : undefined}
                aria-describedby={errors.price ? `${priceId}-err` : undefined}
              />
            </div>
            {errors.price ? (
              <p id={`${priceId}-err`} className="mt-1 text-xs text-danger">
                {errors.price}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor={listingTypeId}
              className="mb-1.5 block text-sm font-medium text-on-surface"
            >
              Estado *
            </label>
            <select
              id={listingTypeId}
              name="listing_type"
              value={values.listing_type}
              onChange={(e) =>
                onChange('listing_type', e.target.value as PropertyFormValues['listing_type'])
              }
              className={cn(
                selectBase,
                errors.listing_type
                  ? 'border-danger focus:border-danger focus:ring-danger'
                  : 'border-outline',
              )}
            >
              {listingOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.listing_type ? (
              <p className="mt-1 text-xs text-danger">{errors.listing_type}</p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor={propertyTypeId}
              className="mb-1.5 block text-sm font-medium text-on-surface"
            >
              Tipo de propiedad *
            </label>
            <select
              id={propertyTypeId}
              name="property_type"
              value={values.property_type}
              onChange={(e) =>
                onChange('property_type', e.target.value as PropertyFormValues['property_type'])
              }
              className={cn(
                selectBase,
                errors.property_type
                  ? 'border-danger focus:border-danger focus:ring-danger'
                  : 'border-outline',
              )}
            >
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.property_type ? (
              <p className="mt-1 text-xs text-danger">{errors.property_type}</p>
            ) : null}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export const BasicInfoSection = memo(BasicInfoSectionInner);
