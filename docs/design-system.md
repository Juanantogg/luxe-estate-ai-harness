# Design System — Luxe Estate

Tokens completos derivados de los 10 mockups en `docs/designs/<screen>/`.
Esta es la **fuente de verdad técnica** del sistema visual.

Para la paleta base y prioridades de código, ver `docs/conventions.md`.

---

## Principios

- **Naming semántico, no descriptivo.** `bg-surface` en vez de `bg-white`,
  `text-muted` en vez de `text-nordic-50`. Los tokens dicen qué hacen, no
  qué color son.
- **Mobile-first.** Cada token y componente se piensa primero para 360-414px.
- **Light mode por defecto.** Dark mode existe en los HTML originales pero
  **lo dejamos fuera del MVP**. Si se agrega después, se replantea la capa
  de tokens.
- **El `screen.png` gana sobre el `code.html`.** Cuando los HTML se
  desvían de la paleta base (caso `search_filters_screen` y
  `add_edit_property_form`), normalizamos a esta tabla.

---

## Color tokens

### Paleta base (4 colores principales)

| Token                | Hex       | Rol                                          |
| -------------------- | --------- | -------------------------------------------- |
| `--color-nordic`     | `#19322F` | Texto principal, headers oscuros, navegación |
| `--color-mosque`     | `#006655` | Color de acción primario, CTAs, links        |
| `--color-hint-green` | `#D9ECC8` | Tarjetas destacadas, badges suaves, acentos  |
| `--color-clear-day`  | `#EEF6F6` | Fondo general de la app                      |

### Tokens semánticos (lo que se usa en JSX)

| Token                        | Mapea a                   | Uso                                                        |
| ---------------------------- | ------------------------- | ---------------------------------------------------------- |
| `--color-background`         | `clear-day`               | Fondo principal de pantalla                                |
| `--color-surface`            | `#FFFFFF`                 | Fondo de cards, modales, inputs                            |
| `--color-surface-inverse`    | `nordic`                  | Footers, secciones oscuras destacadas                      |
| `--color-surface-soft`       | `hint-green`              | Cards/banners destacados (header de perfil, mortgage card) |
| `--color-on-background`      | `nordic`                  | Texto sobre `background`                                   |
| `--color-on-surface`         | `nordic`                  | Texto sobre `surface`                                      |
| `--color-on-surface-inverse` | `#FFFFFF`                 | Texto sobre `surface-inverse`                              |
| `--color-muted`              | `#5C706D`                 | Texto secundario, captions, placeholders activos           |
| `--color-muted-soft`         | `nordic` con opacidad 60% | Texto terciario, breadcrumbs                               |
| `--color-primary`            | `mosque`                  | Botones primarios, links, focus rings                      |
| `--color-primary-hover`      | `#005544`                 | Hover de primary                                           |
| `--color-primary-soft`       | `mosque` con opacidad 10% | Badges, chips, fondos de iconos                            |
| `--color-on-primary`         | `#FFFFFF`                 | Texto sobre primary                                        |
| `--color-divider`            | `nordic` con opacidad 10% | Bordes de cards, separadores                               |
| `--color-divider-soft`       | `nordic` con opacidad 5%  | Bordes muy sutiles                                         |
| `--color-outline`            | `nordic` con opacidad 20% | Bordes de inputs, outlines focus                           |

### Tokens semánticos de estado

| Token             | Hex              | Uso                                     |
| ----------------- | ---------------- | --------------------------------------- |
| `--color-success` | `mosque` (mismo) | Confirmaciones, checks                  |
| `--color-warning` | `#D97706`        | Avisos, "Pendiente"                     |
| `--color-danger`  | `#DC2626`        | Errores, eliminar, notificación urgente |
| `--color-info`    | `nordic` (mismo) | Estados neutros, "Disponible"           |

### Neutrales auxiliares

Solo cuando no aplica un token semántico:

| Token                 | Hex       | Uso                           |
| --------------------- | --------- | ----------------------------- |
| `--color-neutral-50`  | `#F8FAFC` | Fondos de hover muy sutiles   |
| `--color-neutral-100` | `#F1F5F9` | Skeleton placeholder claro    |
| `--color-neutral-200` | `#E2E8F0` | Bordes neutros, slider tracks |
| `--color-neutral-300` | `#CBD5E1` | Scrollbar thumb               |
| `--color-neutral-400` | `#94A3B8` | Iconos deshabilitados         |

---

## Tipografía

**Familia única**: Inter, cargada vía `next/font/google` en
`src/app/layout.tsx`. Sustituye a SF Pro Display (que no es redistribuible).

**Pesos disponibles**: 300, 400, 500, 600, 700.

### Escala (derivada de los HTML)

| Token        | Tamaño           | Line-height | Peso típico   | Uso                                         |
| ------------ | ---------------- | ----------- | ------------- | ------------------------------------------- |
| `display-1`  | 60px (3.75rem)   | 1.1         | 300 / 500 mix | Hero "Find your sanctuary" (lg/xl)          |
| `display-2`  | 48px (3rem)      | 1.1         | 300           | Hero (md)                                   |
| `display-3`  | 36px (2.25rem)   | 1.15        | 300 / 400     | Hero (sm), precios grandes property details |
| `headline-1` | 30px (1.875rem)  | 1.2         | 700           | Page title (login "Welcome to LuxeEstate")  |
| `headline-2` | 24px (1.5rem)    | 1.3         | 300 / 600     | Section titles ("Featured Collections")     |
| `headline-3` | 20px (1.25rem)   | 1.3         | 500 / 600     | Card titles destacados                      |
| `title-1`    | 18px (1.125rem)  | 1.4         | 700           | Card titles, prices ($850,000)              |
| `title-2`    | 16px (1rem)      | 1.5         | 500 / 600     | Subtítulos, labels prominentes              |
| `body`       | 14px (0.875rem)  | 1.5         | 400           | Texto general, captions                     |
| `body-sm`    | 13px (0.8125rem) | 1.5         | 400           | Notas, fechas                               |
| `caption`    | 12px (0.75rem)   | 1.4         | 400 / 500     | Metadatos ("3 Beds", uppercase tracking)    |
| `overline`   | 11px (0.6875rem) | 1.3         | 600 uppercase | Tags ("FOR SALE", "EXCLUSIVE")              |

### Reglas de uso

- **Display** (light 300, ocasionalmente medium 500): para impacto editorial,
  no para densidad de información.
- **Headlines** y **titles**: bold 700 para precios y números clave; 500/600
  para texto de marca.
- **Body**: 400 default, 500 cuando se quiere remarcar.
- **Overline**: siempre `uppercase tracking-wider`.

---

## Espaciado

Escala base 4px (Tailwind default). Tokens habituales en los mockups:

| Token      | px  | Uso típico                                 |
| ---------- | --- | ------------------------------------------ |
| `space-1`  | 4   | Gaps mínimos entre icono y label           |
| `space-2`  | 8   | Padding interno de chips, gap entre iconos |
| `space-3`  | 12  | Padding small button                       |
| `space-4`  | 16  | Padding card medium, gap entre items       |
| `space-6`  | 24  | Padding card grande, gap entre secciones   |
| `space-8`  | 32  | Padding hero, gap entre bloques            |
| `space-12` | 48  | Padding vertical de secciones              |
| `space-16` | 64  | Padding hero móvil                         |

Tailwind cubre todo esto nativamente con `p-1`, `p-2`, etc. No necesitamos
tokens custom.

---

## Border radius

| Token               | rem        | Uso                                |
| ------------------- | ---------- | ---------------------------------- |
| `rounded-sm`        | 0.25 (4px) | Tags, badges chiquitos             |
| `rounded` (DEFAULT) | 0.5 (8px)  | Botones, inputs, cards densas      |
| `rounded-lg`        | 1 (16px)   | Cards principales, modales         |
| `rounded-xl`        | 1.5 (24px) | Cards hero, panels destacados      |
| `rounded-2xl`       | 2 (32px)   | Headers de perfil, banners grandes |
| `rounded-full`      | 9999px     | Avatares, chips, pills, FAB        |

**Inconsistencia conocida en los HTML**: 4 pantallas definen
`DEFAULT: 0.25rem` y 6 definen `0.5rem`. Normalizamos a `0.5rem` (mayoría
y mejor para botones táctiles).

---

## Sombras

Derivadas de las 3 sombras que aparecen consistentemente:

| Token               | CSS                                                                 | Uso                               |
| ------------------- | ------------------------------------------------------------------- | --------------------------------- |
| `shadow-card`       | `0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.02)`  | Cards de listado                  |
| `shadow-soft`       | `0 4px 20px -2px rgba(25,50,47,0.05)`                               | Cards destacadas, modal contenido |
| `shadow-soft-hover` | `0 10px 25px -5px rgba(25,50,47,0.1)`                               | Hover state de cards              |
| `shadow-lg`         | (Tailwind default)                                                  | CTAs flotantes (Schedule Visit)   |
| `shadow-dropdown`   | `0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)` | Menús dropdown, popovers          |

---

## Breakpoints

Mobile-first siempre. Tailwind defaults:

| Token | Min width | Uso                                                   |
| ----- | --------- | ----------------------------------------------------- |
| `sm`  | 640px     | Tablet portrait — gaps mayores, primera columna extra |
| `md`  | 768px     | Tablet landscape — navegación horizontal, 2-3 cols    |
| `lg`  | 1024px    | Desktop — sidebars, 3-4 cols                          |
| `xl`  | 1280px    | Desktop ancho — 4 cols, layouts complejos             |

**Para Luxe Estate**: la mayoría de pantallas se diseñan al 100% del ancho
en móvil con padding `px-4`, y se vuelven `max-w-7xl mx-auto` en `lg+`.

---

## Inventario de componentes reutilizables

Detectados en los 10 mockups. Se implementarán en `src/components/`
agrupados por dominio.

### `ui/` — Primitivas

| Componente   | Apariciones                                                        | Variantes                                                                              |
| ------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `Button`     | Todas                                                              | `primary` (filled mosque), `secondary` (outlined), `ghost` (text-only), `icon` (round) |
| `IconButton` | Todas                                                              | Variant `primary`, `ghost`, tamaños `sm`/`md`/`lg`                                     |
| `Input`      | Login, Filters, Add/Edit, Schedule                                 | Estados default/focus/error, prefix icon                                               |
| `Chip`       | Home, Filters, Profile                                             | `default`, `selected` (filled nordic), `outline`                                       |
| `Avatar`     | Property Details, Profile, Admin Cards, Dashboard                  | Tamaños `sm`/`md`/`lg`, opcional ring                                                  |
| `Badge`      | Home (FOR SALE/RENT), Property Details (Premium/New), Admin (role) | Variant `primary`, `inverse`, `soft`, `success`, `warning`                             |
| `Card`       | Home, Favorites, Property Details, Dashboard                       | `default`, `featured` (con shadow-soft), `inverse` (dark)                              |
| `Modal`      | Filters, Schedule                                                  | Sheet móvil + dialog desktop                                                           |
| `Skeleton`   | Pendiente (estados loading)                                        | Heights variables                                                                      |

### `property/` — Específicos del dominio

| Componente         | Apariciones                | Notas                                                                |
| ------------------ | -------------------------- | -------------------------------------------------------------------- |
| `PropertyCard`     | Home, Favorites, Dashboard | Variant `compact` (grid), `featured` (hero), `management` (con menú) |
| `PropertyGallery`  | Property Details           | Imagen principal + thumbnails scrollable                             |
| `PropertyFeatures` | Property Details           | Grid 2x2 / 4x1 de specs (m², beds, baths, garage)                    |
| `PropertyMap`      | Property Details           | Mapa con pin animado                                                 |
| `PriceTag`         | Múltiples                  | Formatea precios y "/mo" para rent                                   |

### `auth/` — Auth flows

| Componente         | Apariciones | Notas                            |
| ------------------ | ----------- | -------------------------------- |
| `AuthCard`         | Login       | Container principal con sombra   |
| `SocialAuthButton` | Login       | Botón con icono SVG por provider |

### `nav/` — Navegación

| Componente  | Apariciones                      | Notas                                                 |
| ----------- | -------------------------------- | ----------------------------------------------------- |
| `TopNav`    | Todas las pantallas autenticadas | Logo + nav links + acciones (search, notif, avatar)   |
| `BottomNav` | Móvil — implícito en mockups     | TBD: revisar en Fase 4 si los PNG móviles lo muestran |
| `Footer`    | Property Details                 | Copyright + social links                              |

### `forms/` — Formularios

| Componente    | Apariciones            | Notas                              |
| ------------- | ---------------------- | ---------------------------------- |
| `RangeSlider` | Filters                | Custom thumb verde con halo blanco |
| `Select`      | Add/Edit, Filters      | Native con styling                 |
| `Textarea`    | Add/Edit (descripción) | Resize vertical                    |
| `FileUpload`  | Add/Edit (fotos)       | Drag & drop con preview            |
| `DatePicker`  | Schedule               | Calendar grid + time slots         |

### `feedback/` — Estados

| Componente   | Apariciones                     | Notas                      |
| ------------ | ------------------------------- | -------------------------- |
| `EmptyState` | Favorites (potencial), Listings | Ilustración + título + CTA |
| `Toast`      | Pendiente                       | Confirmaciones de acciones |

---

## Iconografía

**Material Icons + Material Symbols Outlined** (Google Fonts).

Decisión: usar **`material-icons`** (clásicos, más livianos) por default.
Reservamos **`material-symbols-outlined`** para iconos que no existan en
la versión clásica.

**Por implementar**: cargar las fuentes una sola vez en `src/app/layout.tsx`
y exponer un componente `<Icon name="favorite_border" />` que abstrae la
clase. Detalle en Fase 4 cuando arranquemos el primer componente que use
iconos.

**Set de iconos confirmado por uso**:

- `search`, `notifications`, `notifications_none`, `favorite_border`, `favorite`
- `place`, `location_on`, `home`, `apartment`, `villa`
- `king_bed`, `bed`, `bathtub`, `shower`, `square_foot`, `directions_car`
- `tune`, `arrow_forward`, `chevron_left`, `chevron_right`, `close`
- `calendar_today`, `chat`, `call`, `mail_outline`
- `check_circle`, `star`, `grid_view`, `real_estate_agent`, `calculate`

---

## Desviaciones documentadas (outliers normalizados)

Estas son las 2 pantallas cuyo `code.html` se desvía de la paleta/tipografía
base. **El implementer debe usar los tokens de este documento, no los del
`code.html` original.** El contrato visual lo da el `screen.png`.

| Pantalla                        | Desviación en HTML                                  | Resolución                                                 |
| ------------------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| `search_filters_screen`         | `primary: #006611` (verde brillante)                | Normalizar a `mosque #006655`                              |
| `add_edit_property_form`        | Tipografía `Newsreader` (serif), `primary: #4fb5a4` | Normalizar a Inter + `mosque`                              |
| `property_management_dashboard` | Marca "Haven" en lugar de "LuxeEstate"              | Normalizar a "LuxeEstate"                                  |
| Varias                          | Mezcla de `DEFAULT: 0.25rem` y `0.5rem` para radius | Normalizar a `0.5rem`                                      |
| Varias                          | Mezcla de Inter y SF Pro Display                    | Unificar a Inter (Inter siempre, SF Pro no redistribuible) |

---

## Dark mode

**Fuera de scope del MVP.** Los `code.html` definen `dark:` variants pero
no las implementamos en Fase 2. Si se agrega después, se duplican los
tokens semánticos con su variante dark en `@media (prefers-color-scheme:
dark)` o con clase `.dark`.
