'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import { Button, Icon, IconButton } from '@/components/ui';
import { getMatchingPropertiesCount } from '@/lib/properties/actions';
import { type AmenityKey, AMENITY_LABEL_ES } from '@/lib/properties/amenities';
import {
  EMPTY_FILTERS,
  type Filters,
  getPriceRangeForListing,
  type ListingType,
  parseFilterParams,
  type PropertyType,
  serializeFilters,
} from '@/lib/search/filter-params';
import { cn } from '@/lib/utils/cn';
import { Constants } from '@/types/database';
import { AmenityChipGroup } from './AmenityChipGroup';
import { CounterPill } from './CounterPill';
import { RangeSlider } from './RangeSlider';

export interface FiltersModalProps {
  /**
   * Si `true`, el modal arranca abierto (uso desde `/search?filters=open`).
   * Caso contrario, arranca cerrado y `renderTrigger` se encarga de abrirlo.
   */
  initialOpen?: boolean;
  /**
   * Render prop opcional para el botón que abre el modal. Recibe el handler
   * `open()` y el count de filtros activos (para badges).
   */
  renderTrigger?: (props: { open: () => void; activeCount: number }) => React.ReactNode;
}

const PROPERTY_TYPES = Constants.public.Enums.property_type as readonly PropertyType[];
const PROPERTY_TYPE_LABEL_ES: Record<PropertyType, string> = {
  house: 'Casa',
  apartment: 'Apartamento',
  villa: 'Villa',
  penthouse: 'Penthouse',
  condo: 'Condo',
  townhouse: 'Townhouse',
  commercial: 'Comercial',
};

const COUNT_DEBOUNCE_MS = 350;

const PRICE_FORMATTER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

function formatPriceCompact(value: number, listing: ListingType | null): string {
  if (listing === 'rent') {
    return `$${PRICE_FORMATTER.format(value)}`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}K`;
  }
  return `$${PRICE_FORMATTER.format(value)}`;
}

function searchParamsToObject(searchParams: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/**
 * Modal de filtros de búsqueda. Bottom sheet en mobile, dialog centrado en
 * desktop. Pre-pobla desde `searchParams` y al aplicar navega a `/search?...`.
 *
 * Decisiones arquitectónicas (spec §"Decisiones cerradas"):
 *  1. Amenities → OR (al menos una). Server Action `getMatchingPropertiesCount`.
 *  2. Slider de precio condicionado por `?listing=rent`.
 *  3. Location → `ilike` sobre `city`.
 *  4. Div custom con focus-trap propio (sin `<dialog>` ni Radix).
 *
 * Patrón: el contenido del modal (con estado de filtros) vive en un
 * subcomponente `<FiltersModalBody>` montado solo cuando `open` es true.
 * Esto evita ejecutar `useEffect` de debounce/focus-trap cuando está cerrado
 * y permite reset trivial del state local sin sincronizar con efectos.
 */
export function FiltersModal({ initialOpen = false, renderTrigger }: FiltersModalProps) {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(initialOpen);
  // Versión del initialFilters: se incrementa cada vez que se abre el modal
  // para forzar remount del body (resetea state local sin useEffect).
  const [openVersion, setOpenVersion] = useState(0);

  const initialFilters = useMemo(
    () => parseFilterParams(searchParamsToObject(searchParams)),
    [searchParams],
  );

  // Cuenta de filtros activos para el badge del trigger.
  const activeCount = useMemo(() => {
    let n = 0;
    if (initialFilters.location.trim()) n += 1;
    if (initialFilters.minPrice != null) n += 1;
    if (initialFilters.maxPrice != null) n += 1;
    if (initialFilters.type) n += 1;
    if (initialFilters.bedrooms > 0) n += 1;
    if (initialFilters.bathrooms > 0) n += 1;
    if (initialFilters.amenities.length > 0) n += 1;
    return n;
  }, [initialFilters]);

  const handleOpen = useCallback(() => {
    setOpenVersion((v) => v + 1);
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <>
      {renderTrigger?.({ open: handleOpen, activeCount })}
      {open && (
        <FiltersModalBody key={openVersion} initialFilters={initialFilters} onClose={handleClose} />
      )}
    </>
  );
}

interface FiltersModalBodyProps {
  initialFilters: Filters;
  onClose: () => void;
}

function FiltersModalBody({ initialFilters, onClose }: FiltersModalBodyProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [count, setCount] = useState<number | null>(null);
  const [isCountLoading, setIsCountLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const headingId = useId();

  const priceRange = useMemo(() => getPriceRangeForListing(filters.listing), [filters.listing]);

  // Validación de precio: derivada, no estado. Evita efecto + setState.
  const priceError = useMemo(() => {
    if (
      filters.minPrice != null &&
      filters.maxPrice != null &&
      filters.minPrice > filters.maxPrice
    ) {
      return 'El precio mínimo no puede ser mayor al máximo.';
    }
    return null;
  }, [filters.minPrice, filters.maxPrice]);

  const close = useCallback(() => {
    // Si el modal está activo vía ?filters=open, limpiar el param.
    if (searchParams.get('filters') === 'open') {
      const next = new URLSearchParams(searchParams.toString());
      next.delete('filters');
      const qs = next.toString();
      router.replace(qs ? `/search?${qs}` : '/search');
    }
    onClose();
  }, [router, searchParams, onClose]);

  // Debounced count fetch + abort de requests previos.
  useEffect(() => {
    if (priceError) return;

    const timeoutId = setTimeout(() => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsCountLoading(true);
      getMatchingPropertiesCount(filters)
        .then((result) => {
          if (controller.signal.aborted) return;
          setCount(result.count);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          console.warn('[FiltersModal] count fetch failed', err);
          setCount(null);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsCountLoading(false);
        });
    }, COUNT_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [filters, priceError]);

  // Scroll lock + Escape + focus trap + focus management.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function getFocusable(): HTMLElement[] {
      if (!panelRef.current) return [];
      return Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === 'Tab') {
        const items = getFocusable();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKey);
    const rafId = requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      // Devolver foco al elemento que tenía foco antes de abrir (el trigger).
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [close]);

  const handleClear = useCallback(() => {
    // Resetea solo los campos editables; preserva q y listing.
    setFilters((prev) => ({
      ...EMPTY_FILTERS,
      q: prev.q,
      listing: prev.listing,
    }));
  }, []);

  const handleSubmit = useCallback(() => {
    if (priceError) return;
    const params = serializeFilters(filters);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/search?${qs}` : '/search');
      onClose();
    });
  }, [filters, priceError, router, onClose]);

  // Handlers de control individual.
  const handleLocationChange = (value: string) => {
    setFilters((prev) => ({ ...prev, location: value }));
  };
  const handlePriceSliderChange = (value: [number, number]) => {
    setFilters((prev) => ({
      ...prev,
      minPrice: value[0] === priceRange.min ? null : value[0],
      maxPrice: value[1] === priceRange.max ? null : value[1],
    }));
  };
  const handleMinPriceInput = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    if (cleaned === '') {
      setFilters((prev) => ({ ...prev, minPrice: null }));
      return;
    }
    const n = Math.min(Math.max(Number.parseInt(cleaned, 10), priceRange.min), priceRange.max);
    setFilters((prev) => ({ ...prev, minPrice: n === priceRange.min ? null : n }));
  };
  const handleMaxPriceInput = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    if (cleaned === '') {
      setFilters((prev) => ({ ...prev, maxPrice: null }));
      return;
    }
    const n = Math.min(Math.max(Number.parseInt(cleaned, 10), priceRange.min), priceRange.max);
    setFilters((prev) => ({ ...prev, maxPrice: n === priceRange.max ? null : n }));
  };
  const handleTypeChange = (value: string) => {
    if (value === 'all') {
      setFilters((prev) => ({ ...prev, type: null }));
      return;
    }
    setFilters((prev) => ({ ...prev, type: value as PropertyType }));
  };
  const handleBedroomsChange = (value: number) => {
    setFilters((prev) => ({ ...prev, bedrooms: value }));
  };
  const handleBathroomsChange = (value: number) => {
    setFilters((prev) => ({ ...prev, bathrooms: value }));
  };
  const handleAmenitiesChange = (next: AmenityKey[]) => {
    setFilters((prev) => ({ ...prev, amenities: next }));
  };

  // Slider values: si null usamos el extremo del rango.
  const sliderValue: [number, number] = [
    filters.minPrice ?? priceRange.min,
    filters.maxPrice ?? priceRange.max,
  ];

  const submitLabel = (() => {
    if (isPending) return 'Aplicando…';
    if (count == null) return 'Ver propiedades';
    return count === 1 ? 'Ver 1 propiedad' : `Ver ${PRICE_FORMATTER.format(count)} propiedades`;
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      role="presentation"
    >
      {/* Overlay */}
      <button
        type="button"
        aria-label="Cerrar filtros"
        tabIndex={-1}
        onClick={close}
        className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm duration-200 animate-in fade-in"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={cn(
          'relative flex max-h-[90vh] w-full flex-col bg-surface text-on-surface shadow-soft-hover',
          'rounded-t-xl md:my-auto md:max-w-2xl md:rounded-xl',
          'duration-200 animate-in slide-in-from-bottom md:fade-in md:zoom-in-95',
        )}
      >
        {/* Grab handle (mobile) */}
        <div className="flex justify-center pt-3 md:hidden" aria-hidden>
          <div className="h-1.5 w-10 rounded-full bg-divider" />
        </div>

        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-divider-soft bg-surface px-6 py-5 md:px-8 md:py-6">
          <h2 id={headingId} className="text-2xl font-semibold tracking-tight text-on-surface">
            Filtros
          </h2>
          <IconButton
            ref={closeButtonRef}
            icon="close"
            variant="ghost"
            size="sm"
            aria-label="Cerrar filtros"
            onClick={close}
          />
        </header>

        {/* Body */}
        <div className="hide-scroll flex-1 space-y-8 overflow-y-auto px-6 py-6 md:space-y-10 md:px-8 md:py-8">
          {/* §1 Location */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">Ubicación</h3>
            <div className="relative">
              <Icon
                name="location_on"
                size="sm"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
              />
              <input
                type="text"
                value={filters.location}
                onChange={(e) => handleLocationChange(e.target.value)}
                placeholder="Ciudad, barrio o dirección"
                className={cn(
                  'block h-12 w-full rounded border border-outline bg-surface pr-4 pl-10 text-base text-on-surface placeholder:text-muted',
                  'transition-colors duration-200',
                  'focus:border-primary focus:ring-2 focus:ring-primary focus:outline-none',
                )}
              />
            </div>
          </section>

          {/* §2 Price Range */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">Precio</h3>
              <span className="text-sm font-medium text-primary">
                {formatPriceCompact(sliderValue[0], filters.listing)} –{' '}
                {formatPriceCompact(sliderValue[1], filters.listing)}
              </span>
            </div>
            <RangeSlider
              min={priceRange.min}
              max={priceRange.max}
              step={priceRange.step}
              value={sliderValue}
              onChange={handlePriceSliderChange}
              ariaLabelMin="Precio mínimo"
              ariaLabelMax="Precio máximo"
            />
            <div className="grid grid-cols-2 gap-4">
              <PriceInputCard
                label="Precio mín"
                value={filters.minPrice}
                onChange={handleMinPriceInput}
                placeholder={String(priceRange.min)}
                hasError={Boolean(priceError)}
              />
              <PriceInputCard
                label="Precio máx"
                value={filters.maxPrice}
                onChange={handleMaxPriceInput}
                placeholder={String(priceRange.max)}
                hasError={Boolean(priceError)}
              />
            </div>
            {priceError && (
              <p className="text-xs text-danger" role="alert">
                {priceError}
              </p>
            )}
          </section>

          {/* §3 Property details */}
          <section className="space-y-6">
            <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">Detalles</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
              {/* Property Type */}
              <div className="space-y-2">
                <label htmlFor="filter-type" className="block text-sm font-medium text-on-surface">
                  Tipo de propiedad
                </label>
                <div className="relative">
                  <select
                    id="filter-type"
                    value={filters.type ?? 'all'}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className={cn(
                      'block w-full appearance-none rounded bg-background py-3 pr-10 pl-4 text-sm text-on-surface',
                      'focus:ring-2 focus:ring-primary focus:outline-none',
                    )}
                  >
                    <option value="all">Cualquier tipo</option>
                    {PROPERTY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {PROPERTY_TYPE_LABEL_ES[type]}
                      </option>
                    ))}
                  </select>
                  <Icon
                    name="expand_more"
                    size="sm"
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
                  />
                </div>
              </div>

              {/* Counters */}
              <div className="space-y-4">
                <CounterPill
                  label="Habitaciones"
                  value={filters.bedrooms}
                  onChange={handleBedroomsChange}
                  decrementLabel="Quitar una habitación"
                  incrementLabel="Agregar una habitación"
                />
                <CounterPill
                  label="Baños"
                  value={filters.bathrooms}
                  onChange={handleBathroomsChange}
                  decrementLabel="Quitar un baño"
                  incrementLabel="Agregar un baño"
                />
              </div>
            </div>
          </section>

          {/* §4 Amenities */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">
              Amenidades
            </h3>
            <AmenityChipGroup selected={filters.amenities} onChange={handleAmenitiesChange} />
            {filters.amenities.length > 0 && (
              <p className="text-xs text-muted">
                Coincide con propiedades que tengan al menos una de:{' '}
                {filters.amenities.map((a) => AMENITY_LABEL_ES[a]).join(', ')}.
              </p>
            )}
          </section>
        </div>

        {/* Footer */}
        <footer className="sticky bottom-0 z-10 flex items-center justify-between gap-4 border-t border-divider-soft bg-surface px-6 py-4 md:px-8 md:py-6">
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              'rounded-sm text-sm font-medium text-on-surface underline decoration-divider underline-offset-4 transition-colors hover:text-primary',
              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
            )}
          >
            Limpiar filtros
          </button>
          <Button
            variant="primary"
            size="lg"
            trailingIcon="arrow_forward"
            onClick={handleSubmit}
            disabled={Boolean(priceError)}
            loading={isPending}
            aria-live="polite"
          >
            <span className="inline-flex items-center gap-2">
              {isCountLoading && !isPending && (
                <Icon
                  name="progress_activity"
                  variant="outlined"
                  size="sm"
                  className="animate-spin"
                />
              )}
              {submitLabel}
            </span>
          </Button>
        </footer>
      </div>
    </div>
  );
}

interface PriceInputCardProps {
  label: string;
  value: number | null;
  onChange: (raw: string) => void;
  placeholder: string;
  hasError: boolean;
}

function PriceInputCard({ label, value, onChange, placeholder, hasError }: PriceInputCardProps) {
  return (
    <div
      className={cn(
        'rounded border bg-background px-3 py-2 transition-colors',
        hasError ? 'border-danger' : 'border-transparent focus-within:border-primary/30',
      )}
    >
      <p className="text-[10px] font-medium tracking-wider text-muted uppercase">{label}</p>
      <div className="mt-1 flex items-center gap-1">
        <span className="text-sm text-muted">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={hasError || undefined}
          className={cn(
            'w-full bg-transparent text-sm font-medium text-on-surface placeholder:text-muted',
            'focus:outline-none',
          )}
        />
      </div>
    </div>
  );
}
