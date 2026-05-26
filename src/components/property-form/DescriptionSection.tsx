'use client';

import { memo } from 'react';
import { Textarea } from '@/components/ui';
import type { PropertyFormValues } from '@/lib/properties/form-schemas';
import { SectionCard } from './SectionCard';

export interface DescriptionSectionProps {
  value: PropertyFormValues['description'];
  error?: string;
  onChange: (next: string) => void;
}

/**
 * Card 2 — Description (spec §6.3). Textarea de plain text con
 * character counter 0/2000. La toolbar de formato del mockup es decorativa
 * y queda fuera de scope (deuda §12).
 */
function DescriptionSectionInner({ value, error, onChange }: DescriptionSectionProps) {
  return (
    <SectionCard title="Descripción" icon="description">
      <Textarea
        name="description"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describí la propiedad: características, ubicación, qué la hace especial…"
        rows={8}
        maxLength={2000}
        characterLimit={2000}
        currentLength={value.length}
        error={error}
        helperText={error ? undefined : 'Recomendado mínimo 50 caracteres para publicar.'}
        className="min-h-[200px]"
      />
    </SectionCard>
  );
}

export const DescriptionSection = memo(DescriptionSectionInner);
