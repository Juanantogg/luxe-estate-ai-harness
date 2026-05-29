'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useReducer, useState, useTransition } from 'react';
import { Icon } from '@/components/ui';
import type { AmenityKey } from '@/lib/properties/amenities';
import {
  createProperty,
  updateProperty,
  type CreatePropertyInput,
  type UpdatePropertyInput,
} from '@/lib/properties/actions';
import {
  getEmptyFormValues,
  MAX_IMAGES_PER_PROPERTY,
  type PropertyFormValues,
} from '@/lib/properties/form-schemas';
import type { PropertyForEdit } from '@/lib/properties/queries';
import { cn } from '@/lib/utils/cn';
import { BasicInfoSection } from './BasicInfoSection';
import { DescriptionSection } from './DescriptionSection';
import { DetailsSection } from './DetailsSection';
import { FormActions, type FormPhase } from './FormActions';
import { GallerySection, makeExistingImage, type GallerySectionImage } from './GallerySection';
import { LocationSection } from './LocationSection';
import { UnsavedChangesGuard } from './UnsavedChangesGuard';

export interface PropertyFormProps {
  mode: 'create' | 'edit';
  /** Datos iniciales (modo edit). */
  initial: PropertyForEdit | null;
  /** ID del usuario autenticado, usado para construir paths `_drafts/<userId>/`. */
  ownerId: string;
}

// =====================================================
// Reducer
// =====================================================

interface FormState {
  values: PropertyFormValues;
  images: GallerySectionImage[];
  errors: Record<string, string | undefined>;
  globalError: string | null;
  /** Marca si el usuario ha modificado algún campo (afecta beforeunload). */
  dirty: boolean;
}

type FormAction =
  | {
      type: 'set_field';
      field: keyof PropertyFormValues;
      value: PropertyFormValues[keyof PropertyFormValues];
    }
  | { type: 'toggle_amenity'; amenity: AmenityKey; checked: boolean }
  | { type: 'set_images'; images: GallerySectionImage[] }
  | { type: 'set_errors'; errors: Record<string, string | undefined>; globalError?: string | null }
  | { type: 'clear_errors' };

function reducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'set_field': {
      return {
        ...state,
        dirty: true,
        values: { ...state.values, [action.field]: action.value } as PropertyFormValues,
        errors: { ...state.errors, [action.field]: undefined },
      };
    }
    case 'toggle_amenity': {
      const set = new Set<AmenityKey>(state.values.amenities);
      if (action.checked) set.add(action.amenity);
      else set.delete(action.amenity);
      return {
        ...state,
        dirty: true,
        values: {
          ...state.values,
          amenities: Array.from(set),
        },
      };
    }
    case 'set_images': {
      return {
        ...state,
        dirty: true,
        images: action.images,
        errors: { ...state.errors, images: undefined },
      };
    }
    case 'set_errors': {
      return {
        ...state,
        errors: action.errors,
        globalError: action.globalError ?? null,
      };
    }
    case 'clear_errors': {
      return { ...state, errors: {}, globalError: null };
    }
  }
}

function buildInitialState(mode: 'create' | 'edit', initial: PropertyForEdit | null): FormState {
  if (mode === 'edit' && initial) {
    return {
      values: {
        title: initial.title,
        description: initial.description ?? '',
        price: String(initial.price),
        listing_type: initial.listing_type,
        property_type: initial.property_type,
        address_line: initial.address_line === ' ' ? '' : initial.address_line,
        city: initial.city === ' ' ? '' : initial.city,
        state: initial.state ?? '',
        country: initial.country ?? 'México',
        postal_code: initial.postal_code ?? '',
        area_sqm: initial.area_sqm == null ? '' : String(initial.area_sqm),
        year_built: initial.year_built == null ? '' : String(initial.year_built),
        bedrooms: initial.bedrooms,
        bathrooms: Math.floor(initial.bathrooms),
        parking_spaces: initial.parking_spaces ?? 0,
        amenities: initial.amenities,
      },
      images: initial.images.map((img) =>
        makeExistingImage({
          dbId: img.id,
          storagePath: img.storage_path,
          isMain: img.is_main,
          altText: img.alt_text,
          position: img.position,
        }),
      ),
      errors: {},
      globalError: null,
      dirty: false,
    };
  }
  return {
    values: getEmptyFormValues(),
    images: [],
    errors: {},
    globalError: null,
    dirty: false,
  };
}

// =====================================================
// Componente
// =====================================================

export function PropertyForm({ mode, initial, ownerId }: PropertyFormProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, undefined as never, () =>
    buildInitialState(mode, initial),
  );
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<FormPhase>('idle');
  const [showPartialUploadDialog, setShowPartialUploadDialog] = useState<{
    pendingMode: 'draft' | 'publish';
    errorCount: number;
  } | null>(null);

  const handleFieldChange = useCallback(
    <K extends keyof PropertyFormValues>(field: K, value: PropertyFormValues[K]) => {
      dispatch({ type: 'set_field', field, value });
    },
    [],
  );

  const handleToggleAmenity = useCallback((amenity: AmenityKey, checked: boolean) => {
    dispatch({ type: 'toggle_amenity', amenity, checked });
  }, []);

  const handleImagesChange = useCallback((images: GallerySectionImage[]) => {
    dispatch({ type: 'set_images', images });
  }, []);

  // Tiene uploads en curso
  const hasUploading = useMemo(
    () => state.images.some((i) => !i.deleted && i.status === 'uploading'),
    [state.images],
  );
  const hasErrors = useMemo(
    () => state.images.some((i) => !i.deleted && i.status === 'error'),
    [state.images],
  );

  const disabledReason: string | null = hasUploading ? 'Esperá a que terminen las subidas…' : null;

  const submit = useCallback(
    (submitMode: 'draft' | 'publish') => {
      if (hasUploading) return;

      // Bloqueo si hay imágenes en error: pedir decisión al user
      if (hasErrors) {
        setShowPartialUploadDialog({
          pendingMode: submitMode,
          errorCount: state.images.filter((i) => !i.deleted && i.status === 'error').length,
        });
        return;
      }

      doSubmit(submitMode);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasUploading, hasErrors, state.images],
  );

  function doSubmit(submitMode: 'draft' | 'publish', dropErrors = false) {
    setPhase('saving');
    dispatch({ type: 'clear_errors' });

    // Imágenes ready solamente (descartamos error si dropErrors)
    const filtered = state.images.filter((i) => {
      if (i.deleted) return mode === 'edit' && Boolean(i.dbId); // keep deletes
      if (dropErrors && i.status === 'error') return false;
      return true;
    });

    startTransition(async () => {
      try {
        if (mode === 'create') {
          const draftImagesPayload = filtered
            .filter((i) => !i.deleted && i.status === 'ready')
            .map((i, idx) => ({
              storagePath: i.storagePath,
              isMain: i.isMain,
              altText: i.altText,
              position: idx,
            }));
          const input: CreatePropertyInput = {
            mode: submitMode,
            values: state.values,
            draftImages: draftImagesPayload,
            amenities: [...state.values.amenities],
          };
          const result = await createProperty(input);
          if (!result.ok) {
            setPhase('idle');
            dispatch({
              type: 'set_errors',
              errors: result.error.fieldErrors ?? {},
              globalError: result.error.message,
            });
            return;
          }
          router.push('/dashboard');
        } else {
          // Edit: armar el array completo
          const payloadImages = filtered.map((i, idx) => ({
            id: i.dbId,
            storagePath: i.storagePath,
            isMain: i.isMain,
            altText: i.altText,
            position: idx,
            deleted: i.deleted,
          }));
          const input: UpdatePropertyInput = {
            id: initial!.id,
            mode: submitMode,
            values: state.values,
            images: payloadImages,
            amenities: [...state.values.amenities],
          };
          const result = await updateProperty(input);
          if (!result.ok) {
            setPhase('idle');
            dispatch({
              type: 'set_errors',
              errors: result.error.fieldErrors ?? {},
              globalError: result.error.message,
            });
            return;
          }
          router.push('/dashboard');
        }
      } catch (err) {
        console.warn('[PropertyForm] submit failed', err);
        setPhase('idle');
        dispatch({
          type: 'set_errors',
          errors: {},
          globalError: 'Ocurrió un error inesperado. Intentá de nuevo.',
        });
      }
    });
  }

  const heading = mode === 'edit' ? 'Editar propiedad' : 'Agregar propiedad';

  return (
    <>
      <UnsavedChangesGuard isDirty={state.dirty && phase !== 'saving'} />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-10 lg:px-8">
        <header className="mb-6 border-b border-divider pb-6 md:mb-8 md:pb-8">
          <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-sm text-muted">
            <Link href="/dashboard" className="hover:text-on-surface">
              Propiedades
            </Link>
            <Icon name="chevron_right" size="xs" />
            <span className="text-on-surface">{mode === 'edit' ? 'Editar' : 'Nueva'}</span>
          </nav>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-on-surface md:text-4xl">
                {heading}
              </h1>
              <p className="mt-1 text-sm text-muted md:text-base">
                Completá los detalles para publicar tu propiedad. Los campos con * son obligatorios.
              </p>
            </div>
            <FormActions
              mode={mode}
              phase={phase}
              disabledReason={disabledReason}
              onSaveDraft={() => submit('draft')}
              onPublish={() => submit('publish')}
              variant="inline"
              className="hidden md:flex"
            />
          </div>
          {state.globalError ? (
            <p
              className="mt-4 rounded border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
              role="alert"
            >
              {state.globalError}
            </p>
          ) : null}
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
          className="grid grid-cols-1 items-start gap-6 pb-24 md:pb-0 lg:gap-8 xl:grid-cols-12"
        >
          <div className="space-y-6 lg:space-y-8 xl:col-span-8">
            <BasicInfoSection
              values={state.values}
              errors={state.errors}
              onChange={handleFieldChange}
              initialSlug={mode === 'edit' ? initial?.slug : undefined}
            />
            <DescriptionSection
              value={state.values.description}
              error={state.errors.description}
              onChange={(v) => handleFieldChange('description', v)}
            />
            <GallerySection
              userId={ownerId}
              images={state.images}
              onImagesChange={handleImagesChange}
              error={state.errors.images}
              disabled={phase === 'saving'}
            />
          </div>
          <div className="space-y-6 lg:space-y-8 xl:col-span-4">
            <LocationSection
              values={state.values}
              errors={state.errors}
              onChange={handleFieldChange}
            />
            <div className="xl:sticky xl:top-24">
              <DetailsSection
                values={state.values}
                errors={state.errors}
                onChange={handleFieldChange}
                onToggleAmenity={handleToggleAmenity}
              />
            </div>
          </div>
        </form>
      </div>

      <FormActions
        mode={mode}
        phase={phase}
        disabledReason={disabledReason}
        onSaveDraft={() => submit('draft')}
        onPublish={() => submit('publish')}
        variant="sticky"
      />

      {showPartialUploadDialog ? (
        <PartialUploadDialog
          errorCount={showPartialUploadDialog.errorCount}
          onClose={() => setShowPartialUploadDialog(null)}
          onContinueWithout={() => {
            const m = showPartialUploadDialog.pendingMode;
            setShowPartialUploadDialog(null);
            doSubmit(m, true);
          }}
        />
      ) : null}

      {/* Silenciar warning de unused (isPending refleja el transition pero
          el phase es la fuente de verdad UI). */}
      <span hidden aria-hidden="true">
        {isPending ? '' : ''}
        {MAX_IMAGES_PER_PROPERTY}
      </span>
    </>
  );
}

// =====================================================
// Modal de upload parcial
// =====================================================

function PartialUploadDialog({
  errorCount,
  onClose,
  onContinueWithout,
}: {
  errorCount: number;
  onClose: () => void;
  onContinueWithout: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="partial-upload-heading"
    >
      <div className={cn('w-full max-w-md rounded-xl bg-surface p-6 shadow-soft')}>
        <h2 id="partial-upload-heading" className="text-lg font-semibold text-on-surface">
          Imágenes con error
        </h2>
        <p className="mt-2 text-sm text-muted">
          {errorCount === 1
            ? 'Hay 1 imagen que no terminó de subir. ¿Querés continuar sin ella o reintentar?'
            : `Hay ${errorCount} imágenes que no terminaron de subir. ¿Querés continuar sin ellas o reintentar?`}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onContinueWithout}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
          >
            Continuar sin ellas
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-outline px-4 py-2 text-sm font-medium text-on-surface hover:border-primary hover:text-primary"
          >
            Cancelar y reintentar
          </button>
        </div>
      </div>
    </div>
  );
}
