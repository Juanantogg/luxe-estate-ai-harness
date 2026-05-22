import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils/cn';
import { Icon } from './Icon';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  helperText?: string;
  error?: string;
  leadingIcon?: string;
  trailingIcon?: string;
  size?: InputSize;
  fullWidth?: boolean;
  className?: string;
  wrapperClassName?: string;
}

const SIZE_CLASSES: Record<InputSize, string> = {
  sm: 'h-9 px-3 py-2 text-sm',
  md: 'h-10 px-4 py-2.5 text-sm',
  lg: 'h-12 px-4 py-3.5 text-base',
};

/**
 * Input controlado/no controlado con label, icono leading/trailing, helper y error.
 * @example <Input label="Email" type="email" leadingIcon="mail_outline" error={errors.email} />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    helperText,
    error,
    leadingIcon,
    trailingIcon,
    size = 'md',
    fullWidth = true,
    className,
    wrapperClassName,
    id,
    disabled,
    readOnly,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const descriptionId = `${inputId}-description`;
  const hasError = Boolean(error);

  return (
    <div className={cn(fullWidth && 'w-full', wrapperClassName)}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-on-surface">
          {label}
        </label>
      )}
      <div className="relative">
        {leadingIcon && (
          <Icon
            name={leadingIcon}
            size="sm"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
        )}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={hasError || undefined}
          aria-describedby={error || helperText ? descriptionId : undefined}
          className={cn(
            'block w-full rounded border bg-surface text-on-surface placeholder:text-muted',
            'transition-colors duration-200',
            'focus:ring-2 focus:outline-none',
            hasError
              ? 'border-danger focus:border-danger focus:ring-danger'
              : 'border-outline focus:border-primary focus:ring-primary',
            'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-muted',
            'read-only:bg-neutral-50 read-only:text-muted',
            SIZE_CLASSES[size],
            leadingIcon && 'pl-10',
            trailingIcon && 'pr-10',
            className,
          )}
          {...rest}
        />
        {trailingIcon && (
          <Icon
            name={trailingIcon}
            size="sm"
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
          />
        )}
      </div>
      {error ? (
        <p id={descriptionId} className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : helperText ? (
        <p id={descriptionId} className="mt-1 text-xs text-muted">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});
