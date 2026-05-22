'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { Icon } from './Icon';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'away' | 'offline';
export type AvatarRingColor = 'primary' | 'surface';

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  ring?: boolean;
  ringColor?: AvatarRingColor;
  className?: string;
}

const CONTAINER_SIZE: Record<AvatarSize, string> = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-20 w-20',
};

const INITIALS_SIZE: Record<AvatarSize, string> = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-2xl',
};

const STATUS_DOT_SIZE: Record<AvatarSize, string> = {
  xs: 'h-2 w-2',
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
  xl: 'h-3.5 w-3.5',
};

const STATUS_DOT_COLOR: Record<AvatarStatus, string> = {
  online: 'bg-success',
  away: 'bg-warning',
  offline: 'bg-neutral-400',
};

const RING_COLOR: Record<AvatarRingColor, string> = {
  primary: 'ring-primary',
  surface: 'ring-surface',
};

const ICON_SIZE_FOR_AVATAR: Record<AvatarSize, 'xs' | 'sm' | 'md' | 'lg' | 'xl'> = {
  xs: 'xs',
  sm: 'sm',
  md: 'md',
  lg: 'md',
  xl: 'xl',
};

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Avatar circular del usuario; resuelve fallback automático (imagen → iniciales → icono `person`).
 * @example <Avatar src={user.avatar_url} name={user.name} size="md" status="online" />
 */
export function Avatar({
  src,
  alt,
  name,
  size = 'md',
  status,
  ring = false,
  ringColor = 'surface',
  className,
  'aria-label': ariaLabel,
  ...rest
}: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(src) && !imgFailed;
  const initials = name ? getInitials(name) : '';
  const accessibleLabel = ariaLabel ?? name ?? alt;

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 overflow-visible rounded-full',
        CONTAINER_SIZE[size],
        ring && 'ring-2',
        ring && RING_COLOR[ringColor],
        className,
      )}
      aria-label={accessibleLabel}
      {...rest}
    >
      <span className="relative inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-primary-soft text-primary">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt ?? name ?? ''}
            className="h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : initials ? (
          <span
            className={cn('font-medium', INITIALS_SIZE[size])}
            aria-hidden={accessibleLabel ? true : undefined}
          >
            {initials}
          </span>
        ) : (
          <Icon
            name="person"
            size={ICON_SIZE_FOR_AVATAR[size]}
            aria-label={accessibleLabel ? undefined : 'Usuario'}
          />
        )}
      </span>
      {status && (
        <span
          className={cn(
            'absolute right-0 bottom-0 rounded-full ring-2 ring-surface',
            STATUS_DOT_SIZE[size],
            STATUS_DOT_COLOR[status],
          )}
          aria-label={`Estado: ${status}`}
        />
      )}
    </span>
  );
}
