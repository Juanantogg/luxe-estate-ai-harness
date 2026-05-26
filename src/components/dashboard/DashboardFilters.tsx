'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Badge, Button, Icon } from '@/components/ui';
import type { ListingStatus, ListingType } from '@/lib/properties/queries';
import { cn } from '@/lib/utils/cn';

const STATUS_OPTIONS: { value: ListingStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activa' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'sold', label: 'Vendida' },
  { value: 'rented', label: 'Rentada' },
  { value: 'draft', label: 'Borrador' },
];

const TYPE_OPTIONS: { value: ListingType | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'sale', label: 'Venta' },
  { value: 'rent', label: 'Renta' },
];

export interface DashboardFiltersProps {
  /** Status actualmente aplicado (`null` si todos). */
  currentStatus: ListingStatus | null;
  /** Listing type actualmente aplicado (`null` si todos). */
  currentListingType: ListingType | null;
}

/**
 * Botón "Filtros" con popover anclado para filtrar properties del
 * dashboard. Solo expone 2 filtros (status, listing_type) — el toggle
 * "Ver archivadas" vive aparte (decisión spec §"Sub-toolbar...").
 *
 * Pattern:
 *  - Trigger: Button secondary con icono `filter_list` y badge con
 *    `activeCount` cuando > 0.
 *  - Panel: popover absoluto `right-0 top-full mt-2` con dos bloques de
 *    radios + botones "Limpiar" / "Aplicar".
 *  - Al aplicar, navega a `/dashboard?status=&type=&page=1` preservando
 *    `archived`.
 *  - Cierra con click outside + Escape. Devuelve foco al trigger.
 *
 * El componente NO reutiliza `FiltersModal` (sería overkill para 2
 * controles; ver alternativa B en el spec).
 */
export function DashboardFilters({ currentStatus, currentListingType }: DashboardFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const headingId = useId();

  const [open, setOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState<ListingStatus | 'all'>(currentStatus ?? 'all');
  const [draftType, setDraftType] = useState<ListingType | 'all'>(currentListingType ?? 'all');

  const activeCount = (currentStatus ? 1 : 0) + (currentListingType ? 1 : 0);

  const openPanel = useCallback(() => {
    setDraftStatus(currentStatus ?? 'all');
    setDraftType(currentListingType ?? 'all');
    setOpen(true);
  }, [currentStatus, currentListingType]);

  const closePanel = useCallback(() => {
    setOpen(false);
    // Devuelve foco al trigger.
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  // Click outside + Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePanel();
      }
    }
    function onClick(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closePanel();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open, closePanel]);

  // Focus al primer radio al abrir.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const firstRadio = panelRef.current?.querySelector<HTMLInputElement>('input[type="radio"]');
      firstRadio?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  function applyFilters() {
    const next = new URLSearchParams(searchParams.toString());
    if (draftStatus === 'all') next.delete('status');
    else next.set('status', draftStatus);
    if (draftType === 'all') next.delete('type');
    else next.set('type', draftType);
    // Reset page al aplicar.
    next.delete('page');
    const qs = next.toString();
    router.replace(qs ? `/dashboard?${qs}` : '/dashboard');
    closePanel();
  }

  function clearFilters() {
    setDraftStatus('all');
    setDraftType('all');
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={open ? closePanel : openPanel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded border border-outline bg-transparent px-3 py-1.5 text-sm font-medium text-on-surface transition-colors hover:border-primary hover:text-primary',
          'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
        )}
      >
        <Icon name="filter_list" size="sm" />
        <span>Filtros</span>
        {activeCount > 0 && (
          <Badge variant="primary" size="sm" aria-label={`${activeCount} filtros activos`}>
            {activeCount}
          </Badge>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-labelledby={headingId}
          className="absolute top-full right-0 z-30 mt-2 w-72 rounded-lg border border-divider bg-surface p-4 shadow-dropdown"
        >
          <h3 id={headingId} className="sr-only">
            Filtros del dashboard
          </h3>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 block text-xs font-semibold tracking-wider text-muted uppercase">
              Estado
            </legend>
            {STATUS_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-on-surface hover:bg-surface-hover"
              >
                <input
                  type="radio"
                  name="dashboard-filter-status"
                  value={opt.value}
                  checked={draftStatus === opt.value}
                  onChange={() => setDraftStatus(opt.value)}
                  className="accent-primary"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="mt-4 flex flex-col gap-2">
            <legend className="mb-1 block text-xs font-semibold tracking-wider text-muted uppercase">
              Tipo
            </legend>
            {TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-on-surface hover:bg-surface-hover"
              >
                <input
                  type="radio"
                  name="dashboard-filter-type"
                  value={opt.value}
                  checked={draftType === opt.value}
                  onChange={() => setDraftType(opt.value)}
                  className="accent-primary"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </fieldset>

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-divider-soft pt-3">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar
            </Button>
            <Button variant="primary" size="sm" onClick={applyFilters}>
              Aplicar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
