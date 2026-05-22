# Design Spec — ui_primitives

## Resumen

Primer paquete de primitivas reutilizables (`src/components/ui/`) que el
resto de pantallas consume. Sin lógica de dominio, sin datos: 8
componentes (Button, IconButton, Input, Chip, Avatar, Badge, Card, Icon)
cubriendo variantes y estados que aparecen en los 10 mockups.

- Stack: React + TypeScript + Tailwind 4 con tokens semánticos ya
  declarados en `src/app/globals.css`.
- Mobile-first. Hit area mínima 40×40px.
- Cero hex en JSX: solo utilidades Tailwind apoyadas en tokens.
- Cada componente exporta tipos públicos + acepta `className` (merged con
  `clsx`/`tailwind-merge` — ver Riesgos) y `ref` con `forwardRef` cuando
  envuelve un elemento DOM nativo.
- Una página `/dev/ui` Server Component renderiza la matriz completa para
  inspección visual en desarrollo.

Fuentes de referencia consultadas:
`social_login_and_registration`, `home_discover_screen`,
`property_details_screen`, `property_management_dashboard`,
`admin_user_directory_cards`, `add_edit_property_form`.

---

## Decisiones de diseño

| Decisión                   | Resolución                                                                                                                                                                                                         | Justificación                                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Carga de fuentes de iconos | Dos familias: `material-icons` (default) + `material-symbols-outlined` (fallback). Cargadas vía `<link>` en `src/app/layout.tsx` `<head>`.                                                                         | Es lo que hacen 9/10 mockups. Cargar por `next/font` no aplica para Material (no está en `next/font/google` con CSS de glyphs). `<link>` permite que el navegador cachee la fuente compartida. |
| `Icon` API                 | `<Icon name="favorite_border" variant="outlined" size="md" />`. `variant` default `material` (clásicos), explícito `outlined` para Material Symbols.                                                               | Permite escapar a Symbols cuando un glifo no existe en clásicos, sin proliferar componentes.                                                                                                   |
| Botón loading              | El label se **oculta visualmente** (mantiene su ancho con `opacity-0`) y un `Icon` spinner `progress_activity` con clase `animate-spin` se posiciona absoluto centrado. `aria-busy="true"`, `disabled` automático. | Evita "layout shift" cuando el botón pasa a loading. Es el patrón de los CTA del mockup (botón estable).                                                                                       |
| Spinner icon               | `progress_activity` de Material Symbols Outlined con `animate-spin`.                                                                                                                                               | Existe en la fuente que ya cargamos. No requiere SVG inline ni dep externa.                                                                                                                    |
| `Input` error              | Prop `error?: string`. Cuando presente, el componente pinta `border-danger`, `aria-invalid="true"`, y renderiza un `<p>` con `text-danger text-xs mt-1` debajo. El caller no maneja el mensaje.                    | Reduce boilerplate y unifica el patrón visual.                                                                                                                                                 |
| `Input` label              | Prop `label?: string` opcional. Si se pasa, se renderiza `<label>` arriba con `htmlFor` automático (UUID interno con `useId`). Si no, el caller renderiza su propio label.                                         | Cubre el 80% de casos sin obligar al caller a duplicar markup.                                                                                                                                 |
| `Avatar` fallback          | Sin `src`: 1) si `name` se pasa, calcular iniciales (máx 2, uppercase); 2) si no hay `name`, icono `person` de Material Icons sobre `bg-primary-soft text-primary`.                                                | Iniciales son lo que el mockup `admin_user_directory_cards` insinúa y es accesible. Icono `person` cubre estados sin metadata.                                                                 |
| `Avatar` status dot        | Prop opcional `status?: 'online' \| 'away' \| 'offline'`. Renderiza dot absoluto bottom-right con `ring-2 ring-surface`.                                                                                           | Aparece en `admin_user_directory_cards` (dot verde/amarillo/gris).                                                                                                                             |
| `Card` `featured`          | `bg-surface-soft` (hint-green) + `text-on-surface` + `shadow-soft`. Sin invertir texto.                                                                                                                            | Coincide con la mortgage card del mockup `property_details_screen` y los banners "destacados".                                                                                                 |
| `Card` `inverse`           | `bg-surface-inverse` (nordic) + `text-on-surface-inverse` (white) + `shadow-soft`.                                                                                                                                 | Para footers/banners oscuros (mockup `property_details_screen` footer).                                                                                                                        |
| Página `/dev/ui` guard     | Server Component: en el top del archivo, `if (process.env.NODE_ENV === 'production') notFound()`.                                                                                                                  | Es server-side (no se ve siquiera el bundle en prod), simple, no requiere env vars nuevas, y `notFound()` devuelve 404 real. Alternativa con middleware sería más invasiva.                    |
| Composición de clases      | Util `cn()` en `src/lib/utils/cn.ts` que combina `clsx` + `tailwind-merge`. **Requiere aprobación humana** para añadir esas 2 deps (ver Riesgos).                                                                  | Es el patrón estándar para merge de Tailwind classes con overrides via prop `className`. Sin esto, `className` de prop puede chocar con clases internas.                                       |

---

## Tokens nuevos requeridos

Todos los tokens ya están en `globals.css` excepto los siguientes que
**recomiendo añadir** (el implementer los agrega; el designer no edita
globals.css):

| Token                   | Valor                     | Uso justificado                                                                                                                                                           |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--color-warning-soft`  | `rgba(217, 119, 6, 0.12)` | Fondo de `Badge` variante `warning` (mockup `property_management_dashboard` muestra orange-100 background para "Pending Sale"). Hoy solo existe `--color-warning` sólido. |
| `--color-danger-soft`   | `rgba(220, 38, 38, 0.12)` | Punto de notificación / badge danger soft, simétrico a `primary-soft`.                                                                                                    |
| `--color-success-soft`  | `rgba(0, 102, 85, 0.12)`  | Alias semántico de `primary-soft` para legibilidad cuando el contexto es "status: completed". Mismo valor, distinto nombre.                                               |
| `--color-surface-hover` | `rgba(25, 50, 47, 0.04)`  | Hover muy sutil de Card y rows de tabla (`hover:bg-black/5` aparece en varios HTML).                                                                                      |

Si el humano prefiere no añadirlos, el implementer puede usar
`bg-warning/10`, `bg-danger/10`, etc. con la sintaxis Tailwind 4 de
opacidades sobre tokens. Mi recomendación: añadirlos como nombres
explícitos para que el JSX sea legible.

---

## Iconografía (carga + uso)

### Carga

En `src/app/layout.tsx`, dentro de `<head>` (Next 16 `metadata` o
`<link>` directo en el `RootLayout`):

```tsx
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
<link
  href="https://fonts.googleapis.com/icon?family=Material+Icons"
  rel="stylesheet"
/>
<link
  href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL,GRAD,opsz@400,0,0,24&display=swap"
  rel="stylesheet"
/>
```

No usamos `next/font` para estas fuentes porque su API está pensada para
fuentes con glyphs latinos, no para fuentes-icono que devuelven CSS con
ligatures + glyph names.

### Componente `Icon`

```tsx
type IconVariant = 'material' | 'outlined';
type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string; // 'favorite_border', 'place', 'search'…
  variant?: IconVariant; // default 'material'
  size?: IconSize; // default 'md'
  className?: string;
  'aria-label'?: string;
}
```

Implementación: render `<span class="material-icons|material-symbols-outlined text-{size}">{name}</span>`.

Tabla de tamaños:

| Size | Clase Tailwind | px aprox |
| ---- | -------------- | -------- |
| `xs` | `text-sm`      | 14       |
| `sm` | `text-base`    | 16       |
| `md` | `text-xl`      | 20       |
| `lg` | `text-2xl`     | 24       |
| `xl` | `text-3xl`     | 30       |

Accesibilidad: si el icono es **decorativo**, el caller debe pasar
`aria-hidden="true"` (lo aplicamos por default si no se pasa
`aria-label`). Si es informativo, se pasa `aria-label="<descripción>"` y
`role="img"`.

---

## Componentes

### Button

Componente base para acciones. Envuelve `<button>` nativo con
`forwardRef<HTMLButtonElement>`.

```ts
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  leadingIcon?: string; // nombre Material icon
  trailingIcon?: string;
  loading?: boolean;
  fullWidth?: boolean;
  asChild?: boolean; // opcional, ver Riesgos
  className?: string;
}
```

#### Variantes

| Variante    | Uso                                                        | Clases base                                                                                    |
| ----------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `primary`   | CTAs principales (Schedule Visit, Save Property, Continue) | `bg-primary text-on-primary hover:bg-primary-hover shadow-soft`                                |
| `secondary` | Acciones secundarias outline                               | `bg-transparent text-on-surface border border-outline hover:border-primary hover:text-primary` |
| `ghost`     | Acciones terciarias text-only                              | `bg-transparent text-on-surface hover:bg-primary-soft hover:text-primary`                      |
| `danger`    | Eliminar, destructivas                                     | `bg-danger text-white hover:opacity-90`                                                        |

#### Tamaños

| Size | Padding       | Tipografía              | Min-height    |
| ---- | ------------- | ----------------------- | ------------- |
| `sm` | `px-3 py-1.5` | `text-sm font-medium`   | `h-9` (36px)  |
| `md` | `px-4 py-2.5` | `text-sm font-medium`   | `h-10` (40px) |
| `lg` | `px-6 py-3.5` | `text-base font-medium` | `h-12` (48px) |

Radius común: `rounded` (8px) para todas las variantes. Transición:
`transition-colors duration-200`.

#### Estados

| Estado        | Clases adicionales                                                                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| default       | (base)                                                                                                                                                                 |
| hover         | ver variante                                                                                                                                                           |
| focus-visible | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background`                          |
| active        | `active:scale-[0.98]`                                                                                                                                                  |
| disabled      | `disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none`                                                                                         |
| loading       | `aria-busy="true"`, `disabled` true, label en `opacity-0`, spinner absoluto centrado (`<Icon name="progress_activity" variant="outlined" className="animate-spin" />`) |

#### Accesibilidad

- Hereda `<button>` nativo (rol, keyboard).
- Si solo `leadingIcon`/`trailingIcon` sin children: forzar prop
  `aria-label` (TS warning) y recomendar `IconButton`.

#### Mobile-first

- `lg` se reserva para CTAs principales (Save Property sticky en
  Add/Edit form).
- `fullWidth` recomendado en móvil para CTAs primarios de formularios.

---

### IconButton

Botón que solo contiene un icono. Envuelve `<button>`, `forwardRef`.

```ts
interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: string; // nombre del icon
  iconVariant?: 'material' | 'outlined';
  variant?: 'primary' | 'ghost' | 'soft' | 'inverse';
  size?: 'sm' | 'md' | 'lg';
  'aria-label': string; // OBLIGATORIO
  loading?: boolean;
  className?: string;
}
```

#### Variantes

| Variante  | Uso                                                                        | Clases                                                                                  |
| --------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `primary` | Acción destacada circular (heart card hover)                               | `bg-primary text-on-primary hover:bg-primary-hover`                                     |
| `ghost`   | Acciones de TopNav (search, notifications)                                 | `text-on-surface hover:text-primary hover:bg-primary-soft`                              |
| `soft`    | Acciones secundarias en card (mockup property_details ronda con mosque/10) | `bg-primary-soft text-primary hover:bg-primary hover:text-on-primary`                   |
| `inverse` | Heart sobre imagen (mockup home cards)                                     | `bg-surface/90 text-on-surface hover:bg-primary hover:text-on-primary backdrop-blur-sm` |

#### Tamaños

| Size | Container   | Icon size   |
| ---- | ----------- | ----------- |
| `sm` | `h-8 w-8`   | `sm` (16px) |
| `md` | `h-10 w-10` | `md` (20px) |
| `lg` | `h-12 w-12` | `lg` (24px) |

Todos `rounded-full`. Hit area mínima `h-10 w-10` (40px) — para `sm` agregar `before:` pseudo o aceptar como riesgo de a11y (preferible no usar `sm` para targets táctiles primarios).

#### Estados

Como Button: focus-visible ring, disabled, loading (icon swap por
`progress_activity` animado).

#### Mobile-first

`md` es el default táctil. `sm` reservado para chips/inline actions
secundarios.

---

### Input

Wrapper sobre `<input>` con label, icono opcional, error opcional.
`forwardRef<HTMLInputElement>`.

```ts
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  helperText?: string; // texto gris debajo, neutral
  error?: string; // si presente, pinta estado error y mensaje
  leadingIcon?: string;
  trailingIcon?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean; // default true
  className?: string; // se aplica al input, no al wrapper
  wrapperClassName?: string;
}
```

#### Variantes / tamaños

Solo un estilo visual; `size` solo cambia padding/typography.

| Size | Padding       | Tipografía  | Min-height |
| ---- | ------------- | ----------- | ---------- |
| `sm` | `px-3 py-2`   | `text-sm`   | `h-9`      |
| `md` | `px-4 py-2.5` | `text-sm`   | `h-10`     |
| `lg` | `px-4 py-3.5` | `text-base` | `h-12`     |

Si `leadingIcon`: padding-left aumenta a `pl-10`.
Si `trailingIcon`: padding-right `pr-10`.

#### Estados

| Estado   | Clases input                                                                      |
| -------- | --------------------------------------------------------------------------------- |
| default  | `bg-surface border border-outline text-on-surface placeholder:text-muted rounded` |
| focus    | `focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary`         |
| error    | `border-danger focus:ring-danger` + mensaje `text-danger text-xs mt-1`            |
| disabled | `disabled:bg-neutral-100 disabled:text-muted disabled:cursor-not-allowed`         |
| readonly | `read-only:bg-neutral-50 read-only:text-muted`                                    |

#### Estructura sugerida

```
<div className={wrapperClassName}>
  {label && <label htmlFor={id} className="block text-sm font-medium text-on-surface mb-1.5">{label}</label>}
  <div className="relative">
    {leadingIcon && <Icon name={leadingIcon} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />}
    <input ref={ref} id={id} aria-invalid={!!error} aria-describedby={...} {...rest} />
    {trailingIcon && <Icon name={trailingIcon} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />}
  </div>
  {error ? <p className="text-danger text-xs mt-1" id={errorId}>{error}</p> : helperText ? <p className="text-muted text-xs mt-1">{helperText}</p> : null}
</div>
```

#### Accesibilidad

- `aria-invalid` cuando hay error.
- `aria-describedby` apunta al `id` del mensaje (error o helper).
- `label` con `htmlFor` siempre que esté presente; si no, el caller debe
  garantizar `aria-label`.

#### Mobile-first

`fullWidth` true por default (los inputs en formularios móviles llenan
ancho).

---

### Chip

Pill seleccionable o decorativo. Renderiza `<button>` (interactivo) o
`<span>` (estático) según prop. `forwardRef`.

```ts
interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'selected' | 'outline';
  size?: 'sm' | 'md';
  leadingIcon?: string;
  trailingIcon?: string;
  asStatic?: boolean; // si true, renderiza <span> no <button>
  className?: string;
}
```

#### Variantes

| Variante   | Uso                                            | Clases                                                                                                               |
| ---------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `default`  | Chip no seleccionado (filtros de tipo en home) | `bg-surface border border-divider-soft text-muted hover:text-on-surface hover:border-primary`                        |
| `selected` | Chip activo (filtro "All" seleccionado)        | `bg-surface-inverse text-on-surface-inverse shadow-soft border-transparent`                                          |
| `outline`  | Chip de etiqueta (amenities en filters)        | `bg-transparent border border-outline text-on-surface hover:bg-primary-soft hover:border-primary hover:text-primary` |

Si `selected` está marcado como una variante adicional pero el caller la
usa también para `outline` con estado activo (ej. amenity seleccionada),
basta con cambiar la variante.

#### Tamaños

| Size | Padding     | Tipografía            |
| ---- | ----------- | --------------------- |
| `sm` | `px-3 py-1` | `text-xs font-medium` |
| `md` | `px-5 py-2` | `text-sm font-medium` |

Radius: `rounded-full` para ambos.

#### Estados

- hover: ver variante
- focus-visible: `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`
- disabled: `disabled:opacity-50 disabled:pointer-events-none`

#### Mobile-first

Chips en filas suelen ser scrollables horizontal en móvil. El
componente no se preocupa por el contenedor; el caller usa
`flex overflow-x-auto`.

---

### Avatar

Imagen circular del usuario, con fallback y status dot opcional.

```ts
interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  src?: string;
  alt?: string;
  name?: string; // para iniciales fallback
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'away' | 'offline';
  ring?: boolean; // ring decorativo
  ringColor?: 'primary' | 'surface';
  className?: string;
}
```

#### Tamaños

| Size | Container   | Iniciales     | Status dot    |
| ---- | ----------- | ------------- | ------------- |
| `xs` | `h-6 w-6`   | `text-[10px]` | `h-2 w-2`     |
| `sm` | `h-8 w-8`   | `text-xs`     | `h-2 w-2`     |
| `md` | `h-10 w-10` | `text-sm`     | `h-2.5 w-2.5` |
| `lg` | `h-12 w-12` | `text-base`   | `h-3 w-3`     |
| `xl` | `h-20 w-20` | `text-2xl`    | `h-3.5 w-3.5` |

#### Fallback

1. `src` y carga OK → `<img>` con `object-cover`.
2. `src` falla / no provisto + `name` → iniciales (`name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()`) sobre `bg-primary-soft text-primary font-medium`.
3. Sin `src` ni `name` → `<Icon name="person" size={size} />` sobre `bg-primary-soft text-primary`.

Implementación del fallback de imagen: handler `onError` que setea
state `imgFailed=true` y rerenderiza con iniciales/icono. Como necesita
state local, **Avatar es Client Component** (`"use client"`).

#### Status dot

| Valor     | Color            |
| --------- | ---------------- |
| `online`  | `bg-success`     |
| `away`    | `bg-warning`     |
| `offline` | `bg-neutral-400` |

Posición: `absolute bottom-0 right-0 ring-2 ring-surface rounded-full`.

#### Ring

`ring={true}` aplica `ring-2 ring-{ringColor}` con `ringColor` default `surface`. En cards de admin se usa ring blanco para destacar.

#### Accesibilidad

- `alt` obligatorio si `src` presente.
- Iniciales y icono fallback con `aria-hidden="true"` si el caller pasa
  `aria-label` al wrapper; si no, el `name` se expone como `aria-label`.

---

### Badge

Etiqueta pequeña inline. Renderiza `<span>` por default.

```ts
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'inverse' | 'soft' | 'success' | 'warning' | 'danger' | 'neutral';
  size?: 'sm' | 'md';
  leadingIcon?: string; // icon antes del texto
  withDot?: boolean; // dot circular antes del texto (mockup status badges)
  uppercase?: boolean;
  className?: string;
}
```

#### Variantes

| Variante  | Uso                                       | Clases                                                                                      |
| --------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `primary` | "Premium" sobre imagen (property_details) | `bg-primary text-on-primary`                                                                |
| `inverse` | "FOR SALE" oscuro (home)                  | `bg-surface-inverse text-on-surface-inverse`                                                |
| `soft`    | "EXCLUSIVE" / "NEW ARRIVAL" sobre imagen  | `bg-surface/90 text-on-surface backdrop-blur-sm`                                            |
| `success` | "Active" en dashboard                     | `bg-surface-soft text-primary border border-primary/10`                                     |
| `warning` | "Pending Sale"                            | `bg-warning-soft text-warning border border-warning/20` (requiere token nuevo, ver sección) |
| `danger`  | "Suspended"                               | `bg-danger-soft text-danger border border-danger/20`                                        |
| `neutral` | "Sold" / inactive                         | `bg-neutral-100 text-muted border border-divider`                                           |

#### Tamaños

| Size | Padding       | Tipografía                  |
| ---- | ------------- | --------------------------- |
| `sm` | `px-2 py-0.5` | `text-[11px] font-semibold` |
| `md` | `px-2.5 py-1` | `text-xs font-medium`       |

Radius: `rounded-full`.

`uppercase` → agrega `uppercase tracking-wider`.
`withDot` → renderiza un `<span class="w-1.5 h-1.5 rounded-full bg-current opacity-80 mr-1.5">`.

#### Estados

Badge es decorativo: no tiene hover/focus/disabled. No es interactivo.

---

### Card

Container con padding y sombra. Pieza estructural reusable.
`forwardRef<HTMLDivElement>`.

```ts
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'featured' | 'inverse' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean; // hover:shadow-soft-hover
  asChild?: boolean; // opcional
  className?: string;
}
```

#### Variantes

| Variante   | Uso                                                     | Clases                                                                         |
| ---------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `default`  | Card estándar (PropertyCard, sidebar cards)             | `bg-surface text-on-surface rounded-lg shadow-soft border border-divider-soft` |
| `featured` | Cards destacadas (mortgage placeholder, profile header) | `bg-surface-soft text-on-surface rounded-xl shadow-soft`                       |
| `inverse`  | Footer banner property_details                          | `bg-surface-inverse text-on-surface-inverse rounded-lg shadow-soft`            |
| `flat`     | Sin sombra (sub-cards dentro de otra card)              | `bg-surface text-on-surface rounded border border-divider-soft`                |

#### Padding

| Valor  | Clase                              |
| ------ | ---------------------------------- |
| `none` | (sin padding — el caller controla) |
| `sm`   | `p-3`                              |
| `md`   | `p-6` (default)                    |
| `lg`   | `p-8`                              |

#### Estados

- `hoverable={true}` → `transition-shadow hover:shadow-soft-hover cursor-pointer`
- focus-visible (cuando el caller le pasa `tabIndex`): `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`

#### Composición (sub-componentes opcionales)

Para v1 NO incluimos `CardHeader`/`CardBody`/`CardFooter` (over-engineering). Si la repetición de patrón emerge, se añaden en una iteración posterior.

#### Mobile-first

`padding` default `md` aplica `p-6` en todos los breakpoints. En móvil
pueden reducirse a `sm` (`p-3`) cuando el card está dentro de columnas
estrechas.

---

### Icon

Ver "Iconografía (carga + uso)" arriba. Resumen de API:

```ts
interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  variant?: 'material' | 'outlined';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  'aria-label'?: string;
  'aria-hidden'?: boolean;
}
```

Implementación (snippet ilustrativo):

```tsx
const Icon = forwardRef<HTMLSpanElement, IconProps>(
  (
    { name, variant = 'material', size = 'md', className, 'aria-label': ariaLabel, ...rest },
    ref,
  ) => {
    const fontClass = variant === 'outlined' ? 'material-symbols-outlined' : 'material-icons';
    const sizeClass = ICON_SIZE_MAP[size];
    return (
      <span
        ref={ref}
        className={cn(fontClass, sizeClass, 'leading-none select-none', className)}
        aria-hidden={ariaLabel ? undefined : true}
        aria-label={ariaLabel}
        role={ariaLabel ? 'img' : undefined}
        {...rest}
      >
        {name}
      </span>
    );
  },
);
```

`leading-none select-none` evita doble line-height y selección accidental.

---

## Página /dev/ui (validación visual)

Server Component en `src/app/dev/ui/page.tsx`.

### Guard

```ts
import { notFound } from 'next/navigation';

export default async function DevUiPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  // …render
}
```

`NODE_ENV` lo setea Next automáticamente (`development` con `pnpm dev`,
`production` con `pnpm build && pnpm start`). En Vercel queda 404
permanente; en local renderiza siempre. Sin variables de entorno
adicionales.

### Estructura

Una sección por componente. Dentro de cada sección, un grid que
muestra **todas las variantes × todos los estados** que importan:

| Sección      | Lo que renderiza                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Button`     | 4 variantes × 3 tamaños × { default, hover (CSS via `:hover` natural en demo), disabled, loading, with leadingIcon, with trailingIcon }. Una matriz visible. |
| `IconButton` | 4 variantes × 3 tamaños, default + disabled + loading.                                                                                                       |
| `Input`      | 3 tamaños, con/sin label, con/sin helper, con/sin error, con/sin leadingIcon, disabled, readonly.                                                            |
| `Chip`       | 3 variantes × 2 tamaños, con/sin leadingIcon. Una fila scroll horizontal para simular uso real.                                                              |
| `Avatar`     | 5 tamaños, con `src`, con `name` (iniciales), sin nada (icon fallback), con cada `status`, con `ring`.                                                       |
| `Badge`      | 7 variantes × 2 tamaños, con/sin `withDot`, con/sin `uppercase`.                                                                                             |
| `Card`       | 4 variantes × 3 paddings, con/sin `hoverable`, ejemplo de composición real (avatar + título + body).                                                         |
| `Icon`       | Grid con ~30 iconos del set confirmado en `design-system.md`.                                                                                                |

### Layout

`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16`. Cada sección
tiene `<h2>` (headline-2 light) y subtítulo con el nombre del archivo
`src/components/ui/Button.tsx` para referencia rápida.

### Sin interactividad

No estado, no Server Action. Los botones tienen `type="button"` y no
disparan nada. La página es estática a propósito — es un catálogo
visual, no un playground.

---

## Decisiones humanas aprobadas (2026-05-21)

Resoluciones del leader+humano sobre la sección "Riesgos / dudas" que sigue.
**El implementer debe seguir estas decisiones; los puntos abiertos quedan
documentados abajo como contexto.**

1. **Deps `clsx` + `tailwind-merge`**: APROBADAS. El implementer añade ambas
   a `package.json` y crea `src/lib/utils/cn.ts` con la implementación
   estándar (`twMerge(clsx(...))`).
2. **Tokens soft nuevos**: APROBADOS los 4 (`--color-warning-soft`,
   `--color-danger-soft`, `--color-success-soft`, `--color-surface-hover`)
   con los valores propuestos. El implementer los añade a `globals.css`
   dentro del bloque `@theme`.
3. **Avatar como Client Component**: APROBADO. El archivo lleva
   `"use client"` y maneja fallback con `useState` + `onError`.
4. **`asChild` (Radix Slot)**: FUERA del v1. Quitar la prop `asChild` de
   `Button` y `Card` en la implementación. Se revisita si aparece un caso
   real.
5. **Carga de Material Icons + Material Symbols Outlined**: vía `<link>`
   a Google Fonts en el `<head>` de `src/app/layout.tsx`, como muestra el
   snippet en la sección "Iconografía".

---

## Riesgos / dudas para revisión humana

### 1. Dependencias nuevas: `clsx` + `tailwind-merge`

Para implementar `cn()` y permitir overrides limpios de `className`,
hace falta añadir 2 deps a `package.json`:

- `clsx` (~500 B): concatenación condicional de clases.
- `tailwind-merge` (~6 KB): resolución de conflictos Tailwind (`bg-red-500 bg-blue-500` → `bg-blue-500`).

`AGENTS.md` exige discutir cada nueva dep. **Pido aprobación**. Sin esto,
los overrides via `className` pueden chocar con las clases internas del
componente (`<Button className="bg-red-500">` queda inestable).

Alternativa minimalista: implementar `cn(...args)` propio que solo concatena
strings sin resolver conflictos. Funciona para 80% de casos; falla
silenciosamente cuando hay conflictos de utilidades Tailwind.

### 2. Prop `asChild` (slot pattern)

En la spec dejo `asChild?: boolean` como prop opcional en Button y Card.
La forma idiomática de implementar esto es con `@radix-ui/react-slot`
(~2 KB). **Si no aprobamos esa dep, eliminamos `asChild`** y el caller
usa un `<Link>` con `className` igualada manualmente, o envuelve el
Button (peor accesibilidad).

Recomendación: dejar `asChild` **fuera del v1** (no añadir Radix por una
sola prop) y revisitarlo cuando aparezca un caso real.

### 3. Iconos: ligatures vs glyph names

Material Icons soporta dos formas: el name como texto interno del span
(ligature: `<span class="material-icons">favorite_border</span>`) o
codepoints. Uso **ligatures** por simplicidad. Esto requiere que la
fuente esté cargada antes del primer render, o veremos texto crudo
("favorite_border") parpadear unos ms. Mitigación: `<link rel="preconnect">`
en head + considerar `font-display: block` en el CSS de la fuente (lo
controla Google Fonts, no nosotros). Riesgo aceptado para MVP.

### 4. `Avatar` como Client Component

El fallback automático de imagen requiere `useState` + `onError`. Avatar
queda `"use client"`. Implica que cualquier Server Component que use
Avatar lo trata como boundary. Para evitarlo, podríamos:

- **Opción A** (actual): Avatar es Client Component. Punto.
- **Opción B**: Avatar Server Component que no maneja fallback automático;
  el caller pasa explícitamente `src` o lo omite. Si la imagen falla en
  runtime, se ve el alt. Menos friendly pero todo server.

Recomiendo A: Avatar es chico, no causa hydration issues, y los fallbacks
son críticos para UX.

### 5. Loading state en `Button` para acciones server

El prop `loading` es controlado por el caller. Para Server Actions sin
`useTransition`, el caller necesitará `useFormStatus` o manejar estado
local. Esto es decisión del implementer/caller, no del primitive. Lo
menciono porque genera dudas frecuentes.

### 6. Badge "FOR SALE" vs "FOR RENT" en home

Los HTML muestran ambos con `bg-surface-inverse` (oscuro). En
`favorites_list_screen` el acceptance dice "For Sale (hint-green bg) /
For Rent (blue bg)". Hay inconsistencia entre features. Solo defino las
variantes genéricas (`inverse`, `success`); la decisión de qué variante
usar para cada listing_type queda para la feature `home_discover_screen`
y `favorites_list_screen`. **No es bloqueante** para ui_primitives.

### 7. Página `/dev/ui` en bundle de producción

Aunque el `notFound()` evita servir la página, **el código del componente
sigue en el bundle del server**. Mitigación: el archivo es pequeño
(~300 LOC de JSX puro) y no importa nada que no se use ya en producción.
Riesgo aceptable.

### 8. Token `--color-warning-soft`

Hoy `--color-warning` (#D97706) existe pero no su versión soft. Para
`Badge variant="warning"` necesitamos un fondo claro. Tres opciones:

- A) Añadir token `--color-warning-soft` con `rgba(217, 119, 6, 0.12)`.
- B) Usar utilidad `bg-warning/10` (Tailwind 4 soporta opacidades sobre
  vars).
- C) Usar `bg-orange-100` (clase hardcoded de Tailwind, viola la regla
  "cero hex" indirectamente al apoyarse en paleta no-semántica).

Recomiendo A para mantener consistencia.

### 9. Carga de fuentes Material por CDN externo

Google Fonts via `<link>` puede fallar (red, bloqueado por adblockers
agresivos). Si la fuente no carga, los iconos se ven como texto crudo.
Para MVP es aceptable; en una iteración futura se puede self-host con
`@font-face` apuntando a `public/fonts/`.

---

## Criterios de aceptación verificables

- [ ] `src/components/ui/{Button,IconButton,Input,Chip,Avatar,Badge,Card,Icon}.tsx` existen.
- [ ] `src/components/ui/index.ts` re-exporta los 8 componentes y sus tipos públicos.
- [ ] `src/lib/utils/cn.ts` existe y se usa internamente (asumiendo aprobación de deps).
- [ ] Cada componente acepta `className` y lo combina con `cn()`.
- [ ] Los componentes que envuelven nodos DOM (Button, IconButton, Input, Chip, Card) usan `forwardRef` y exportan el tipo de ref correcto.
- [ ] Cero literales hex en cualquier archivo dentro de `src/components/ui/`.
- [ ] Inter ya cargada en `layout.tsx` (existente) — verificar pesos 400/500/600/700.
- [ ] Material Icons + Material Symbols Outlined cargados en `<head>` de `layout.tsx`.
- [ ] `src/app/dev/ui/page.tsx` renderiza la matriz completa y devuelve 404 en `NODE_ENV=production`.
- [ ] `pnpm lint` y `pnpm type-check` pasan.
- [ ] `pnpm build` pasa.
- [ ] (Manual) Inspección visual en `/dev/ui`: ningún componente muestra contenido cortado, sombras incoherentes o tipos diferentes a Inter.
- [ ] (Manual) Keyboard nav: Tab focusea, focus-visible muestra ring de mosque, Enter/Space activan botones/chips.
- [ ] (Manual) Cada componente tiene un JSDoc en la línea anterior al `export` con: descripción de una frase + ejemplo mínimo.
