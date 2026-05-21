# Convenciones visuales y de código — Luxe Estate

Este documento captura las **decisiones base**. Los tokens completos
(escala tipográfica, espaciado, radios, sombras, breakpoints, neutrales y
semánticos derivados de `docs/designs/`) viven en `docs/design-system.md`.

## Paleta base (no negociable)

| Nombre        | Hex       | Rol                                  |
| ------------- | --------- | ------------------------------------ |
| Nordic        | `#19322F` | Texto principal, headers, navegación |
| Mosque        | `#006655` | Botones primarios, color de acción   |
| Hint of Green | `#D9ECC8` | Tarjetas destacadas, fondos suaves   |
| Clear Day     | `#EEF6F6` | Fondo general de la app              |

**Uso:**

- Fondo principal de pantalla → Clear Day
- Botones primarios y CTAs → Mosque
- Headers, barras de navegación, footers → Nordic
- Cards destacadas, badges suaves → Hint of Green
- Texto principal → Nordic

Estos 4 colores se exponen como tokens en `src/app/globals.css`:

- `bg-surface` / `bg-background` → Clear Day
- `text-on-surface` → Nordic
- `bg-primary` / `text-on-primary` → Mosque / blanco
- `bg-accent-soft` → Hint of Green
- `bg-surface-inverse` → Nordic (para headers oscuros)

Neutrales (grises, blancos, bordes) y semánticos (error, warning, success)
se derivarán en Fase 2 leyendo los `code.html` de cada pantalla.

## Tipografía

**Inter** (única familia, sustituto de SF Pro Display).

- **Cargada vía** `next/font/google` en `src/app/layout.tsx`.
- **Pesos disponibles**: 400, 500, 600, 700.
- **Escala**: se define en `docs/design-system.md` con los tamaños exactos
  derivados de los HTML de referencia.

## Prioridades de código

(Estas son guías que se profundizan en `AGENTS.md` como reglas duras y en
`CLAUDE.md` como contexto de stack.)

- Reutiliza componentes. Si un patrón se repite (cards, inputs, chips,
  bottom nav), abstrae a `src/components/`.
- Estructura `src/` por dominio cuando crezca:
  - `src/components/ui/` — primitivas (Button, Input, Card).
  - `src/components/property/` — componentes específicos de propiedades.
  - `src/components/auth/` — formularios y wrappers de auth.
- No instalar librerías sin consultarlo.
- Mobile-first siempre. Los mockups son móvil.

## Referencia visual

- `docs/designs/<screen>/screen.png` — mockup definitivo.
- `docs/designs/<screen>/code.html` — referencia HTML estructural.
- Si hay conflicto entre PNG y HTML, **gana el PNG**.
