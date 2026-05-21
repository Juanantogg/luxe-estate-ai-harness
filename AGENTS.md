<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md

> **Mapa, no biblia.** Reglas que cualquier agente debe ver siempre.
> Cargado en `CLAUDE.md` vía `@AGENTS.md`. El detalle vive en otros
> archivos — lee bajo demanda (divulgación progresiva).

---

## Antes de empezar

1. **Solo el leader o el humano** ejecutan `./init.sh`. Si falla, **para** y
   resuelve el entorno antes de tocar código.
2. Lee `CLAUDE.md` — contexto, decisiones arquitectónicas y harness.

---

## Antes de devolver control

Si tu trabajo tocó `src/` o configuración, deja el repo en estado limpio
antes de devolver control al leader o al humano: sin `console.log` ni
debug suelto, sin archivos temporales, sin TODOs sin contexto.

(El leader tiene su propio checklist de cierre de feature en
`.claude/agents/leader.md` — esto solo aplica al cierre de tu sub-tarea.)

---

## Reglas duras (no negociables)

- **Cero hex literales en JSX.** Todos los colores vienen de tokens en
  `globals.css`. `bg-primary` sí, `bg-[#19322F]` no.
- **Server Components por defecto.** `"use client"` solo con interactividad
  real (formularios controlados, estado local, hooks de React).
- **`params` y `searchParams` son Promise** en Next 16 — siempre `await`.
- **`cookies()` y `headers()` son async** en Next 16 — siempre `await`.
- **No introducir dependencias** sin discutirlo primero con el humano.
- **Mobile-first**: empieza por el layout móvil, agrega breakpoints `sm:`/
  `md:`/`lg:` solo si el diseño lo requiere.
- **Textos en español** directamente en JSX. No hay diccionarios i18n.
- **Supabase**:
  - Nunca instancies `createClient` directo. Usa los helpers en
    `src/lib/supabase/`.
  - **RLS obligatorio** en cada tabla nueva. La migración debe activarlo
    (`alter table ... enable row level security`) y definir políticas.
  - El `service_role` key nunca cruza al cliente.
  - Mutaciones siempre en Server Actions, nunca directamente desde Client
    Components.
- **Diseños son contrato**: si tu feature corresponde a una pantalla en
  `docs/designs/<screen>/`, sigue el `code.html` y el `screen.png` al pie.
  No improvises layout.

---

## Responsabilidad sobre `feature_list.json`

- **Leader**: controla status de **features** (`pending` → `in_progress` →
  `done` / `blocked`). Solo marca `done` cuando reviewer aprobó + commit
  existe.
- **Implementer**: cambia status a `in_progress` cuando arranca y reporta
  `blocked` si se atora. No marca `done`.
- **Demás agentes** (designer, reviewer): no modifican `feature_list.json`.

---

## Directorio de agentes

El detalle de cada subagente vive en `.claude/agents/<nombre>.md`.
Solo el leader necesita el catálogo completo — está en
`.claude/agents/leader.md` sección "Subagentes disponibles".
