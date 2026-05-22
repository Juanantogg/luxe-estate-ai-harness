import { notFound } from 'next/navigation';
import { Avatar, Badge, Button, Card, Chip, Icon, IconButton, Input } from '@/components/ui';

export const metadata = { title: 'UI Primitivas — Dev' };

const BUTTON_VARIANTS = ['primary', 'secondary', 'ghost', 'danger'] as const;
const BUTTON_SIZES = ['sm', 'md', 'lg'] as const;
const ICON_BUTTON_VARIANTS = ['primary', 'ghost', 'soft', 'inverse'] as const;
const ICON_BUTTON_SIZES = ['sm', 'md', 'lg'] as const;
const CHIP_VARIANTS = ['default', 'selected', 'outline'] as const;
const CHIP_SIZES = ['sm', 'md'] as const;
const AVATAR_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
const AVATAR_STATUSES = ['online', 'away', 'offline'] as const;
const BADGE_VARIANTS = [
  'primary',
  'inverse',
  'soft',
  'success',
  'warning',
  'danger',
  'neutral',
] as const;
const BADGE_SIZES = ['sm', 'md'] as const;
const CARD_VARIANTS = ['default', 'featured', 'inverse', 'flat'] as const;
const CARD_PADDINGS = ['none', 'sm', 'md', 'lg'] as const;
const INPUT_SIZES = ['sm', 'md', 'lg'] as const;

const ICON_CATALOG = [
  'search',
  'notifications',
  'notifications_none',
  'favorite_border',
  'favorite',
  'place',
  'location_on',
  'home',
  'apartment',
  'villa',
  'king_bed',
  'bed',
  'bathtub',
  'shower',
  'square_foot',
  'directions_car',
  'tune',
  'arrow_forward',
  'chevron_left',
  'chevron_right',
  'close',
  'calendar_today',
  'chat',
  'call',
  'mail_outline',
  'check_circle',
  'star',
  'grid_view',
  'real_estate_agent',
  'calculate',
];

function SectionHeader({ title, file }: { title: string; file: string }) {
  return (
    <header className="border-b border-divider-soft pb-4">
      <h2 className="text-2xl font-light text-on-surface">{title}</h2>
      <p className="mt-1 font-mono text-xs text-muted">{file}</p>
    </header>
  );
}

function MatrixRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="w-32 shrink-0 text-xs font-medium text-muted uppercase">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

// La ruta /dev/ui es un catálogo visual interno; en producción debe responder 404.
export default function DevUiPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div className="mx-auto max-w-7xl space-y-16 px-4 py-12 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-3xl font-light text-on-surface">UI Primitivas</h1>
        <p className="mt-2 text-sm text-muted">
          Catálogo visual de los componentes en <code>src/components/ui/</code>. Solo se renderiza
          en desarrollo.
        </p>
      </header>

      {/* Button */}
      <section className="space-y-6">
        <SectionHeader title="Button" file="src/components/ui/Button.tsx" />
        <div className="space-y-6">
          {BUTTON_VARIANTS.map((variant) => (
            <div key={variant} className="space-y-3">
              <h3 className="text-sm font-semibold text-on-surface capitalize">{variant}</h3>
              {BUTTON_SIZES.map((size) => (
                <MatrixRow key={size} label={size}>
                  <Button variant={variant} size={size}>
                    Acción
                  </Button>
                  <Button variant={variant} size={size} leadingIcon="add">
                    Crear
                  </Button>
                  <Button variant={variant} size={size} trailingIcon="arrow_forward">
                    Siguiente
                  </Button>
                  <Button variant={variant} size={size} disabled>
                    Deshabilitado
                  </Button>
                  <Button variant={variant} size={size} loading>
                    Cargando
                  </Button>
                </MatrixRow>
              ))}
            </div>
          ))}
          <MatrixRow label="fullWidth">
            <div className="w-full max-w-sm">
              <Button variant="primary" fullWidth>
                Ancho completo
              </Button>
            </div>
          </MatrixRow>
        </div>
      </section>

      {/* IconButton */}
      <section className="space-y-6">
        <SectionHeader title="IconButton" file="src/components/ui/IconButton.tsx" />
        {ICON_BUTTON_VARIANTS.map((variant) => (
          <div key={variant} className="space-y-3">
            <h3 className="text-sm font-semibold text-on-surface capitalize">{variant}</h3>
            <MatrixRow label="tamaños">
              {ICON_BUTTON_SIZES.map((size) => (
                <IconButton
                  key={size}
                  icon="favorite_border"
                  variant={variant}
                  size={size}
                  aria-label={`Guardar ${size}`}
                />
              ))}
            </MatrixRow>
            <MatrixRow label="estados">
              <IconButton icon="search" variant={variant} aria-label="Buscar" />
              <IconButton
                icon="search"
                variant={variant}
                disabled
                aria-label="Buscar deshabilitado"
              />
              <IconButton icon="search" variant={variant} loading aria-label="Buscar cargando" />
            </MatrixRow>
          </div>
        ))}
      </section>

      {/* Input */}
      <section className="space-y-6">
        <SectionHeader title="Input" file="src/components/ui/Input.tsx" />
        <div className="grid gap-6 sm:grid-cols-2">
          {INPUT_SIZES.map((size) => (
            <Input key={size} size={size} label={`Tamaño ${size}`} placeholder="Escribe algo" />
          ))}
          <Input label="Con leading icon" leadingIcon="search" placeholder="Buscar propiedades" />
          <Input label="Con trailing icon" trailingIcon="visibility" placeholder="Contraseña" />
          <Input
            label="Con helper"
            helperText="Usaremos este email para iniciar sesión."
            placeholder="email@ejemplo.com"
          />
          <Input label="Con error" error="El email no es válido." defaultValue="no-es-email" />
          <Input label="Deshabilitado" disabled placeholder="Sin acceso" />
          <Input label="Solo lectura" readOnly defaultValue="No se puede editar" />
        </div>
      </section>

      {/* Chip */}
      <section className="space-y-6">
        <SectionHeader title="Chip" file="src/components/ui/Chip.tsx" />
        {CHIP_VARIANTS.map((variant) => (
          <div key={variant} className="space-y-3">
            <h3 className="text-sm font-semibold text-on-surface capitalize">{variant}</h3>
            {CHIP_SIZES.map((size) => (
              <MatrixRow key={size} label={size}>
                <Chip variant={variant} size={size}>
                  Todos
                </Chip>
                <Chip variant={variant} size={size} leadingIcon="home">
                  Casa
                </Chip>
                <Chip variant={variant} size={size} trailingIcon="close">
                  Cerrar
                </Chip>
                <Chip variant={variant} size={size} disabled>
                  Deshabilitado
                </Chip>
              </MatrixRow>
            ))}
          </div>
        ))}
        <MatrixRow label="scroll horizontal">
          <div className="-mx-2 flex w-full max-w-md gap-2 overflow-x-auto px-2 pb-2">
            {['Todos', 'Casa', 'Apartamento', 'Villa', 'Penthouse', 'Loft'].map((label, idx) => (
              <Chip key={label} variant={idx === 0 ? 'selected' : 'default'} size="md">
                {label}
              </Chip>
            ))}
          </div>
        </MatrixRow>
      </section>

      {/* Avatar */}
      <section className="space-y-6">
        <SectionHeader title="Avatar" file="src/components/ui/Avatar.tsx" />
        <MatrixRow label="tamaños (img)">
          {AVATAR_SIZES.map((size) => (
            <Avatar
              key={size}
              size={size}
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200"
              alt="Foto de usuario"
            />
          ))}
        </MatrixRow>
        <MatrixRow label="iniciales">
          {AVATAR_SIZES.map((size) => (
            <Avatar key={size} size={size} name="Elena Vargas" />
          ))}
        </MatrixRow>
        <MatrixRow label="fallback icono">
          {AVATAR_SIZES.map((size) => (
            <Avatar key={size} size={size} />
          ))}
        </MatrixRow>
        <MatrixRow label="status">
          {AVATAR_STATUSES.map((status) => (
            <Avatar key={status} size="lg" name="Elena Vargas" status={status} />
          ))}
        </MatrixRow>
        <MatrixRow label="ring">
          <Avatar size="lg" name="Elena Vargas" ring ringColor="primary" />
          <Avatar size="lg" name="Elena Vargas" ring ringColor="surface" />
        </MatrixRow>
      </section>

      {/* Badge */}
      <section className="space-y-6">
        <SectionHeader title="Badge" file="src/components/ui/Badge.tsx" />
        {BADGE_SIZES.map((size) => (
          <MatrixRow key={size} label={size}>
            {BADGE_VARIANTS.map((variant) => (
              <Badge key={variant} variant={variant} size={size}>
                {variant}
              </Badge>
            ))}
          </MatrixRow>
        ))}
        <MatrixRow label="con dot">
          {BADGE_VARIANTS.map((variant) => (
            <Badge key={variant} variant={variant} withDot>
              {variant}
            </Badge>
          ))}
        </MatrixRow>
        <MatrixRow label="uppercase">
          <Badge variant="inverse" uppercase>
            For sale
          </Badge>
          <Badge variant="soft" uppercase>
            Exclusive
          </Badge>
          <Badge variant="primary" uppercase>
            Premium
          </Badge>
        </MatrixRow>
        <MatrixRow label="leadingIcon">
          <Badge variant="success" leadingIcon="check_circle">
            Activa
          </Badge>
          <Badge variant="warning" leadingIcon="schedule">
            Pendiente
          </Badge>
          <Badge variant="danger" leadingIcon="block">
            Suspendido
          </Badge>
        </MatrixRow>
      </section>

      {/* Card */}
      <section className="space-y-6">
        <SectionHeader title="Card" file="src/components/ui/Card.tsx" />
        <div className="grid gap-4 sm:grid-cols-2">
          {CARD_VARIANTS.map((variant) => (
            <Card key={variant} variant={variant}>
              <h3 className="text-base font-semibold capitalize">{variant}</h3>
              <p className="mt-2 text-sm opacity-80">
                Card de tipo {variant} con padding md por defecto.
              </p>
            </Card>
          ))}
        </div>
        <MatrixRow label="paddings">
          {CARD_PADDINGS.map((padding) => (
            <Card key={padding} padding={padding} className="w-40 text-xs">
              padding={padding}
            </Card>
          ))}
        </MatrixRow>
        <MatrixRow label="hoverable">
          <Card hoverable className="w-72">
            <div className="flex items-center gap-3">
              <Avatar size="md" name="Marina López" />
              <div>
                <p className="text-sm font-semibold text-on-surface">Marina López</p>
                <p className="text-xs text-muted">Agente certificada</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted">
              Card hoverable que sirve como ejemplo de composición real.
            </p>
          </Card>
        </MatrixRow>
      </section>

      {/* Icon */}
      <section className="space-y-6">
        <SectionHeader title="Icon" file="src/components/ui/Icon.tsx" />
        <p className="text-sm text-muted">
          Set confirmado en <code>docs/design-system.md</code>. Tamaño <code>md</code>.
        </p>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-6">
          {ICON_CATALOG.map((name) => (
            <div
              key={name}
              className="flex flex-col items-center gap-2 rounded border border-divider-soft p-3 text-center"
            >
              <Icon name={name} size="lg" />
              <span className="font-mono text-[11px] break-all text-muted">{name}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
