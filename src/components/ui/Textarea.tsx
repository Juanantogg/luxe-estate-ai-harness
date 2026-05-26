import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils/cn';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  /**
   * Si se pasa, pinta un contador `length / maxLength` alineado a la derecha.
   * No fuerza el máximo (el `maxLength` lo controla el browser); sirve para
   * dar feedback visual durante el tipeo.
   */
  characterLimit?: number;
  /**
   * Valor actual del textarea — necesario para calcular `length` cuando
   * `characterLimit` está activo. Si el componente es controlado se pasa
   * `value`; si no, podés pasar `currentLength` directamente.
   */
  currentLength?: number;
  fullWidth?: boolean;
  className?: string;
  wrapperClassName?: string;
}

/**
 * Textarea controlado/no controlado con label, helper, error y character
 * counter opcional. Mismo patrón visual que `Input` (border-outline,
 * focus ring primary, danger en estado error).
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    helperText,
    error,
    characterLimit,
    currentLength,
    fullWidth = true,
    className,
    wrapperClassName,
    id,
    disabled,
    readOnly,
    rows = 4,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const descriptionId = `${inputId}-description`;
  const hasError = Boolean(error);

  // Cuando `currentLength` no se pasa explícito, intentamos derivarlo del
  // `value` si el caller lo controla. En no-controlado (defaultValue) el
  // contador puede quedar a 0 al montar; eso es aceptable como feedback
  // inicial — el caller que necesite precisión usa `currentLength`.
  const length = currentLength ?? (typeof rest.value === 'string' ? rest.value.length : 0);

  const overLimit = characterLimit != null && length > characterLimit;

  return (
    <div className={cn(fullWidth && 'w-full', wrapperClassName)}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-on-surface">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={hasError || undefined}
        aria-describedby={error || helperText ? descriptionId : undefined}
        className={cn(
          'block w-full rounded border bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-muted',
          'transition-colors duration-200',
          'focus:ring-2 focus:outline-none',
          hasError
            ? 'border-danger focus:border-danger focus:ring-danger'
            : 'border-outline focus:border-primary focus:ring-primary',
          'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-muted',
          'read-only:bg-neutral-50 read-only:text-muted',
          'resize-y',
          className,
        )}
        {...rest}
      />
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="flex-1">
          {error ? (
            <p id={descriptionId} className="text-xs text-danger">
              {error}
            </p>
          ) : helperText ? (
            <p id={descriptionId} className="text-xs text-muted">
              {helperText}
            </p>
          ) : null}
        </div>
        {characterLimit != null && (
          <p
            className={cn(
              'shrink-0 text-xs tabular-nums',
              overLimit ? 'text-danger' : 'text-muted',
            )}
            aria-live="polite"
          >
            {length} / {characterLimit}
          </p>
        )}
      </div>
    </div>
  );
});
