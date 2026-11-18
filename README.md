# Luxe Estate

App web inmobiliaria construida con **Next.js 16 (App Router)**, **React 19**, **TypeScript** y **Supabase**. Diseño premium y minimalista, mobile-first, con autenticación real, roles y base de datos con Row Level Security.

## Funcionalidades

- **Catálogo público**: home con destacados, búsqueda con filtros (ubicación, precio, tipo, recámaras), venta y renta, URLs legibles por propiedad.
- **Detalle de propiedad**: galería de imágenes, información del agente y agenda de visitas con calendario.
- **Autenticación**: email/contraseña con verificación de correo, Google OAuth, recuperación de contraseña y cambio de email.
- **Tres roles** (`user`, `agent`, `admin`):
  - Usuarios: favoritos, perfil editable con avatar, visitas agendadas y notificaciones.
  - Agentes: dashboard para crear, editar y publicar sus propiedades con subida de imágenes.
  - Admin: directorio de usuarios con búsqueda, filtro por rol e invitaciones por correo.
- **Seguridad**: políticas RLS por rol en cada tabla, rutas privadas protegidas en middleware y mutaciones solo vía Server Actions validadas con Zod.

## Stack

| Área | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| UI | React 19, TypeScript, Tailwind CSS 4 con design tokens propios |
| Backend | Supabase (Auth, Postgres, Storage, RLS) con `@supabase/ssr` |
| Validación | Zod |
| Calidad | ESLint, Prettier, Husky + lint-staged |

## Decisiones técnicas

- **Server Components por defecto**; `"use client"` solo donde hay interactividad real (formularios, modales, calendario).
- **Design system en tokens**: los colores y tipografía viven en `src/app/globals.css` (`@theme` de Tailwind 4); no hay colores hardcodeados en JSX. Detalle en [`docs/design-system.md`](docs/design-system.md).
- **Modelo de datos y RLS versionados** como migraciones SQL en [`supabase/`](supabase). Detalle en [`docs/data-model.md`](docs/data-model.md).
- **Shell público + middleware**: la home y los listados son públicos (SEO); las rutas privadas se declaran en un solo lugar y el middleware las protege.

## Estructura

```
src/
  app/          rutas (App Router) agrupadas por (app), (auth), (dashboard), (admin)
  components/   componentes reutilizables y primitivos de UI
  lib/          clientes de Supabase, auth y utilidades
  types/        tipos generados desde Supabase
supabase/       migraciones SQL (esquema + políticas RLS)
docs/           design system, modelo de datos y mockups de referencia
```

## Correr en local

Requisitos: Node 20+, pnpm y un proyecto de Supabase.

```bash
pnpm install
cp .env.example .env.local   # completa las variables de Supabase
pnpm dev                      # http://localhost:3000
```

Aplica las migraciones de `supabase/migrations/` a tu proyecto y, opcionalmente, carga datos de ejemplo con `pnpm db:seed`.

Otros comandos: `pnpm build`, `pnpm lint`, `pnpm type-check`.

## Desarrollo asistido por IA (harness multi-agente)

El proyecto se construyó con un harness de agentes de IA (Claude Code) que separa el trabajo en roles: un **leader** que descompone cada feature, un **designer** que extrae layout y tokens de los mockups, un **implementer** que escribe el código y un **reviewer** que lo valida contra las reglas del proyecto.

- [`AGENTS.md`](AGENTS.md) y [`CLAUDE.md`](CLAUDE.md): reglas duras y decisiones de arquitectura con su "por qué".
- [`.claude/agents/`](.claude/agents): definición de cada rol.
- [`feature_list.json`](feature_list.json): backlog estructurado con el estado de cada feature.
- [`progress/`](progress): spec de diseño y revisión de cada feature, como evidencia del proceso.
- [`init.sh`](init.sh) y hooks: lint, type-check y build automáticos como guardarraíles.
