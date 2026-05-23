'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui';

export interface PropertyAboutProps {
  description: string | null;
}

const TRUNCATE_AT = 280;

/**
 * Card "Acerca de esta propiedad". Client Component mínimo: solo necesita
 * un toggle local para "Leer más" cuando la descripción excede 280 chars.
 *
 * Para descripciones multi-párrafo, splitea por `\n\n` y renderiza un `<p>`
 * por bloque. Si la descripción es vacía/null, muestra un placeholder en
 * tono suave en lugar de esconder la card (la cabecera de la sección sigue
 * siendo informativa).
 */
export function PropertyAbout({ description }: PropertyAboutProps) {
  const [expanded, setExpanded] = useState(false);
  const trimmed = description?.trim() ?? '';

  if (trimmed === '') {
    return (
      <section className="rounded-xl border border-divider-soft bg-surface p-6 shadow-soft md:p-8">
        <h2 className="mb-4 text-lg font-semibold text-on-surface md:text-xl">
          Acerca de esta propiedad
        </h2>
        <p className="text-sm text-muted italic">El agente aún no agregó una descripción.</p>
      </section>
    );
  }

  const needsTruncate = trimmed.length > TRUNCATE_AT;
  const visibleText = !needsTruncate || expanded ? trimmed : `${trimmed.slice(0, TRUNCATE_AT)}…`;
  const paragraphs = visibleText.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  return (
    <section className="rounded-xl border border-divider-soft bg-surface p-6 shadow-soft md:p-8">
      <h2 className="mb-4 text-lg font-semibold text-on-surface md:text-xl">
        Acerca de esta propiedad
      </h2>
      <div className="space-y-4 text-sm leading-relaxed text-muted">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="whitespace-pre-wrap">
            {paragraph}
          </p>
        ))}
      </div>
      {needsTruncate && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary transition-all hover:gap-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
          aria-expanded={expanded}
        >
          {expanded ? 'Leer menos' : 'Leer más'}
          <Icon name={expanded ? 'arrow_back' : 'arrow_forward'} size="sm" />
        </button>
      )}
    </section>
  );
}
