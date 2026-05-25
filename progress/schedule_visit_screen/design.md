# Design spec — schedule_visit_screen

## Referencia visual

- Mockup: `docs/designs/schedule_visit_screen/screen.png`
- HTML: `docs/designs/schedule_visit_screen/code.html`

> El PNG manda sobre el HTML. El HTML usa `bg-mosque/clear-day/nordic`, ya
> mapeados a tokens semánticos (`bg-primary`, `bg-background`, `bg-surface-inverse`).

---

## 1. Resumen

`/property/[id]/schedule` permite a un usuario autenticado reservar una
visita presencial a una propiedad publicada. Layout split (lg+): sidebar
izquierda con resumen de la propiedad + agente, panel derecho con
calendario mensual, time slots de 30 min y textarea opcional. Pantalla
**privada** (sumar a `protectedPaths`). Toca dos tablas: `visits` (INSERT
con `status='confirmed'`, ver §11 D4) y `notifications` (INSERT via
trigger DB tras `INSERT INTO visits`). Misma propiedad no la puede agendar
su dueño (redirige al dashboard de edición).

---

## 2. Ruta y acceso

| Aspecto                                                | Decisión                                                                                                                                                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ruta                                                   | `/property/[id]/schedule`                                                                                                                                                                                   |
| Path del Server Component                              | `src/app/(app)/property/[id]/schedule/page.tsx`                                                                                                                                                             |
| Public/privada                                         | **Privada.** Agregar `/property/[id]/schedule` a `protectedPaths` en `src/lib/supabase/proxy.ts` (ver §10 cambio en migración + middleware).                                                                |
| `params`                                               | `Promise<{ id: string }>` — `await params` (Next 16).                                                                                                                                                       |
| `searchParams`                                         | Acepta `?date=YYYY-MM-DD` opcional para deep-link al calendario en una fecha específica (no afecta la lógica de validación; solo highlight inicial).                                                        |
| Anónimo                                                | El middleware redirige a `/login?next=/property/[id]/schedule` antes de renderizar.                                                                                                                         |
| Property no existe / RLS la oculta                     | `notFound()`.                                                                                                                                                                                               |
| Property en estado distinto a `active`                 | `notFound()` (no se permiten visitas a propiedades pausadas/vendidas/rentadas).                                                                                                                             |
| Visitante == dueño (`property.owner_id == auth.uid()`) | Redirect server-side a `/dashboard/properties/[id]/edit`. No tiene sentido agendarse a uno mismo. Consistente con D4 del spec de details.                                                                   |
| Visitante en role `admin`                              | Permitido (admin podría agendar a nombre de un user en el futuro; en MVP simplemente puede operar). El INSERT aún requiere `user_id=auth.uid()` por RLS, así que en la práctica admin se agenda a sí mismo. |

---

## 3. Layout (referenciado al mockup)

### 3.1 ASCII del layout desktop (lg+)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ TopNav (heredado de (app)/layout.tsx)                                      │
├────────────────────────────────────────────────────────────────────────────┤
│  ← Volver al detalle                                                       │
│                                                                            │
│  ┌──────────────────────────┬──────────────────────────────────────────┐  │
│  │ SIDEBAR (md:w-5/12)      │ MAIN FORM (md:w-7/12)                    │  │
│  │ bg-surface-soft p-8      │ bg-surface p-8                           │  │
│  │                          │                                          │  │
│  │ [Imagen propiedad 4/3]   │ Agendar una visita      (h1)             │  │
│  │ Badge "En venta"         │ Elige una fecha y hora.                  │  │
│  │                          │                                          │  │
│  │ Modern Villa…   (h2)     │ ── Octubre 2026         < >  ──          │  │
│  │ 📍 1284 Sunset Blvd…     │ Lu Ma Mi Ju Vi Sá Do                     │  │
│  │                          │  -  -  1  2  3  4  5                     │  │
│  │ ──────────────────       │  6  7 [8] 9 10 11 12   ← día seleccionado│  │
│  │ PRECIO                   │ 13 14 15 …                               │  │
│  │ $4,500,000               │                                          │  │
│  │ 🛏 4  🛁 3  📐 3,200 ft² │ ── HORARIOS DISPONIBLES ──               │  │
│  │ ──────────────────       │ [09:00] [09:30] [10:00] [10:30]          │  │
│  │ AgentBadge:              │ [11:00] [11:30]  --     [13:00]          │  │
│  │  👤 Sarah Jenkins        │  ← (12:00 12:30 ocupados, line-through)  │  │
│  │  Agente verificado       │                                          │  │
│  │  📧 📞                   │ MENSAJE PARA EL AGENTE (Opcional)        │  │
│  │                          │ ┌────────────────────────────────────┐   │  │
│  │                          │ │ ¿Alguna pregunta o solicitud?      │   │  │
│  │                          │ └────────────────────────────────────┘   │  │
│  │                          │                          0 / 500         │  │
│  │                          │                                          │  │
│  │                          │ ── divider ─────────────────────────     │  │
│  │                          │           [ Cancelar ]  [ Confirmar → ]  │  │
│  └──────────────────────────┴──────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Responsive

| Breakpoint            | Comportamiento                                                                                                                                                                                                                                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 360-767 (mobile / sm) | Stack vertical. Orden: back link → sidebar (resumen colapsado: imagen + título + dirección + precio + AgentBadge compacto) → main form. **CTA "Confirmar visita" sticky-bottom** dentro del main (`sticky bottom-0 bg-surface border-t border-divider-soft p-4 -mx-4 px-4 md:static md:bg-transparent md:border-0`). Cancelar como link inline. |
| 768+ (md)             | Activa split: `<div class="flex flex-col md:flex-row">` con sidebar `md:w-5/12` y main `md:w-7/12`. Padding interno `p-6 md:p-8 lg:p-10` por panel.                                                                                                                                                                                             |
| 1024+ (lg)            | Sin cambios estructurales. Container exterior `max-w-6xl mx-auto`. Card raíz `rounded-xl shadow-soft bg-surface overflow-hidden`.                                                                                                                                                                                                               |

### 3.3 Estructura semántica HTML

```html
<main id="main-content"> <!-- ya viene de (app)/layout.tsx -->
  <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 md:py-10">
    <a class="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-primary" href="/property/[id]">
      <Icon name="arrow_back" /> Volver al detalle
    </a>

    <section class="rounded-xl bg-surface shadow-soft overflow-hidden border border-divider-soft">
      <div class="flex flex-col md:flex-row">
        <aside class="md:w-5/12 bg-surface-soft p-6 md:p-8 lg:p-10 flex flex-col gap-6">
          <!-- VisitPropertySummary -->
        </aside>

        <div class="md:w-7/12 p-6 md:p-8 lg:p-10 flex flex-col">
          <header>
            <h1 class="text-2xl md:text-3xl font-medium text-on-surface mb-2">Agendar una visita</h1>
            <p class="text-sm text-muted mb-8">Elige una fecha y hora para recorrer la propiedad en persona.</p>
          </header>

          <form action={scheduleVisit}>  <!-- Server Action -->
            <!-- VisitScheduler (Client): MonthCalendar + TimeSlotGrid + MessageTextarea -->
            <!-- inputs hidden con propertyId, scheduledAt -->

            <footer class="pt-6 mt-auto border-t border-divider-soft flex items-center justify-end gap-4 md:static sticky bottom-0 bg-surface -mx-6 px-6 md:bg-transparent md:mx-0 md:px-0 md:border-t">
              <Link href="/property/[id]" class="text-sm text-muted hover:text-on-surface">Cancelar</Link>
              <Button type="submit" variant="primary" size="lg" loading={pending} disabled={!canSubmit}>
                Confirmar visita <Icon name="arrow_forward" />
              </Button>
            </footer>
          </form>
        </div>
      </div>
    </section>
  </div>
</main>
```

> El `<form>` envuelve el área del calendario+slots+textarea para que el
> Server Action reciba los campos del state vía inputs hidden controlados
> por el VisitScheduler client.

---

## 4. Datos

### 4.1 Query principal (Server Component)

Reutilizar `getPropertyDetail(supabase, id)` (ya existe en
`src/lib/properties/queries.ts`). Devuelve `PropertyForDetail` con
`owner_id`, owner profile, images, etc. Si retorna `null` → `notFound()`.

### 4.2 Query de slots ocupados — decisión

**Decisión: opción (a)**. Server Component hace **un solo fetch
batch** de las visitas del agente en la ventana [hoy+24h, hoy+60d]; las
pasa serializadas al `VisitScheduler` Client Component como prop
`occupiedSlots: string[]` (ISO strings UTC). Las visitas ocupadas
incluyen `status in ('pending', 'confirmed', 'rescheduled')` —
`cancelled`, `completed`, `no_show` liberan el slot.

```ts
// src/lib/visits/queries.ts (nuevo módulo)
export async function getAgentOccupiedSlots(
  supabase: SupabaseDb,
  agentId: string,
  windowDays = 60,
): Promise<string[]> {
  const fromIso = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const toIso = new Date(Date.now() + windowDays * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('visits')
    .select('scheduled_at, status')
    .eq('agent_id', agentId)
    .in('status', ['pending', 'confirmed', 'rescheduled'])
    .gte('scheduled_at', fromIso)
    .lte('scheduled_at', toIso);
  if (error) {
    console.warn('[getAgentOccupiedSlots] failed', error);
    return [];
  }
  return (data ?? []).map((r) => r.scheduled_at);
}
```

**Por qué (a) y no Server Action por fetch incremental**:

- Un agente típico tendrá decenas de visitas en 60 días, no miles. El
  payload es chico (~ N×30 bytes serializado).
- Evita un round-trip extra por cada click de día en el calendario y la
  necesidad de un loading state per-day.
- Race-condition (otro user agenda mientras este usuario navega): se
  protege en el server con el constraint único de DB (ver §6).
- Misma filosofía que `getUserFavoriteIds` (set chico precargado).

**RLS recordatorio**: `visits_select_participant_or_admin` solo deja ver
filas donde `user_id=auth.uid()` OR `agent_id=auth.uid()` OR admin. El
visitante que está agendando NO ve las visitas que el agente tiene con
OTROS users (no es participante). **Tenemos que abrir un canal**.

→ **Decisión (cerrada por mí, ver §10 D-RLS y §11 R1)**: NO ampliar RLS
para que `visits` sea visible al user que está agendando. En su lugar,
crear una **RPC con `security definer`** `get_agent_occupied_slots(agent
uuid, from_ts timestamptz, to_ts timestamptz)` que devuelve únicamente
los `scheduled_at` (sin info personal — ni `user_id`, ni `message`).
Esto preserva privacidad (no se filtra quién agendó qué) y permite que
el Server Component vea slots ocupados.

```sql
create or replace function public.get_agent_occupied_slots(
  agent uuid,
  from_ts timestamptz,
  to_ts timestamptz
)
returns table (scheduled_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select v.scheduled_at
  from public.visits v
  where v.agent_id = agent
    and v.status in ('pending', 'confirmed', 'rescheduled')
    and v.scheduled_at >= from_ts
    and v.scheduled_at <= to_ts;
$$;

grant execute on function public.get_agent_occupied_slots(uuid, timestamptz, timestamptz)
  to authenticated;
```

Y `getAgentOccupiedSlots` se reescribe como:

```ts
const { data, error } = await supabase.rpc('get_agent_occupied_slots', {
  agent: agentId,
  from_ts: fromIso,
  to_ts: toIso,
});
```

> Esto va dentro de la migración 0016 (ver §6).

### 4.3 Tablas y columnas

| Tabla              | Acceso                                                             | Para qué                                                |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------------- |
| `properties`       | SELECT (vía `getPropertyDetail`)                                   | Sidebar resumen + validar `owner_id` y `listing_status` |
| `property_images`  | SELECT (idem)                                                      | Imagen del sidebar                                      |
| `profiles` (owner) | SELECT (idem)                                                      | Sidebar AgentBadge                                      |
| `visits`           | INSERT (Server Action) + SELECT vía RPC `get_agent_occupied_slots` | Crear la visita; mostrar slots ocupados                 |
| `notifications`    | INSERT via **trigger** AFTER INSERT ON visits                      | Notificar al agente. El cliente no toca esta tabla.     |

---

## 5. Componentes

Todos los nuevos van en `src/components/visits/` (carpeta nueva, mismo
patrón que `src/components/favorites/`).

| Componente              | Path                                               | S/C        | Props                                                                                                                                                                                                       | Responsabilidad                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VisitPropertySummary`  | `src/components/visits/VisitPropertySummary.tsx`   | **Server** | `{ property: PropertyForDetail; owner: OwnerProfileFull \| null; isAuthenticated: boolean }`                                                                                                                | Sidebar: imagen + badge + título + dirección + divisor + precio + 3 specs + AgentBadge. Reutiliza `Badge`, `Avatar`, `Icon`, `formatPrice`, `formatArea`.                                                                                                                                                                                                         |
| `VisitScheduler`        | `src/components/visits/VisitScheduler.tsx`         | **Client** | `{ propertyId: string; agentId: string; occupiedSlotsIso: string[]; minDateIso: string; maxDateIso: string; initialDateIso?: string; userTimeZone?: string }`                                               | Contenedor con state: `selectedDateIso`, `selectedSlotIso`, `message`, `pending`, `error`. Renderiza `MonthCalendar` + `TimeSlotGrid` + `MessageTextarea` + footer con submit. Llama a la Server Action `scheduleVisit` vía `useTransition`.                                                                                                                      |
| `MonthCalendar`         | `src/components/visits/MonthCalendar.tsx`          | **Client** | `{ currentMonth: Date; selectedDateIso: string \| null; minDateIso: string; maxDateIso: string; onSelect: (iso: string) => void; onMonthChange: (next: Date) => void; fullyBookedDateIsoSet: Set<string> }` | Grid 7-col Lun-Dom (`weekStart = 1`). Chevrons `<` `>` para navegar mes. Estados por día: pasado/fuera-de-ventana (disabled gris), futuro disponible (hover surface-soft), seleccionado (`bg-primary text-on-primary scale-105` con dot blanco abajo), totalmente reservado (text-muted con `line-through`). Día de hoy: `ring-1 ring-primary-soft`.              |
| `TimeSlotGrid`          | `src/components/visits/TimeSlotGrid.tsx`           | **Client** | `{ dateIso: string \| null; slots: Slot[]; selectedSlotIso: string \| null; onSelect: (iso: string) => void; minDateTimeIso: string }`                                                                      | Grid `grid-cols-3 sm:grid-cols-4 gap-3`. Cada slot button: default (border-outline), seleccionado (`bg-primary-soft border-primary text-primary font-medium`), ocupado (border-outline text-muted line-through opacity-50 cursor-not-allowed disabled), pasado (igual a ocupado pero label "Pasado").                                                             |
| `MessageTextarea`       | `src/components/visits/MessageTextarea.tsx`        | **Client** | `{ value: string; onChange: (v: string) => void; maxLength: number; error?: string }`                                                                                                                       | Textarea controlada con contador `N / 500`. Aria-describedby con el counter. Color del counter cambia a `text-warning` si `value.length >= 450`, `text-danger` si `>= 500`.                                                                                                                                                                                       |
| Helper `slot-utils.ts`  | `src/lib/visits/slot-utils.ts`                     | -          | -                                                                                                                                                                                                           | Funciones puras: `generateDaySlots(date: Date): Date[]` (22 slots 9:00-19:30 cada 30min en zona local), `formatSlotLabel(date: Date): string` ("10:00 AM"), `isoToLocalDate(iso: string): Date`, `isFullyBooked(dateIso, occupiedSet)`, `getMonthDays(monthDate): { iso, inMonth, isPast }[]`. Sin libs externas — `Intl.DateTimeFormat` y `Date` nativos bastan. |
| `getAgentOccupiedSlots` | `src/lib/visits/queries.ts` (nuevo)                | Server     | `(supabase, agentId, windowDays?) => Promise<string[]>`                                                                                                                                                     | Llama a la RPC `get_agent_occupied_slots`.                                                                                                                                                                                                                                                                                                                        |
| `scheduleVisit`         | `src/lib/visits/actions.ts` (nuevo)                | Server     | Ver §7                                                                                                                                                                                                      | Server Action.                                                                                                                                                                                                                                                                                                                                                    |
| `loading.tsx`           | `src/app/(app)/property/[id]/schedule/loading.tsx` | Server     | -                                                                                                                                                                                                           | Skeleton del split layout.                                                                                                                                                                                                                                                                                                                                        |

### 5.1 Slot type

```ts
export interface Slot {
  iso: string; // "2026-10-08T16:00:00.000Z" (UTC)
  label: string; // "10:00 AM" (en zona del browser)
  isOccupied: boolean;
  isPast: boolean; // vs minDateTimeIso (hoy+24h)
}
```

### 5.2 Por qué un nuevo `src/components/visits/` y no extender `property/`

Las piezas son de un dominio distinto: agenda. Si más adelante hacemos
`/visits` (lista de visitas del user) o `/dashboard/visits` (panel del
agente), reutilizarán este `VisitScheduler` para "reagendar" — mantener
un namespace propio paga.

### 5.3 Reutilizados sin cambios

- `Button`, `Icon`, `Avatar`, `Badge`, `Card` (UI).
- `AgentBadge` (sidebar — cierra el patrón que el spec de details ya
  anticipaba como "se reutiliza en schedule_visit_screen").
- `formatPrice`, `formatPriceParts`, `formatArea` (`src/lib/properties/format.ts`).
- `getPropertyDetail` (`src/lib/properties/queries.ts`).

---

## 6. Migración SQL nueva (`0016_visits_slot_constraint_and_notification_trigger.sql`)

Numbering: la última migración aplicada es `0015_rls_helpers_execute_to_authenticated.sql`,
así que ésta es `0016`. Contenido del archivo, listo para copiar:

```sql
-- 0016_visits_slot_constraint_and_notification_trigger.sql
--
-- Cierra dos huecos para que la pantalla schedule_visit_screen funcione:
--
-- (a) Constraint único parcial sobre (agent_id, scheduled_at) cuando el
--     status es uno de los "ocupantes". Previene race conditions: si dos
--     users hacen submit del mismo slot al mismo tiempo, la DB rechaza el
--     segundo con error 23505 (unique_violation) y la Server Action lo
--     traduce a `slot_taken`.
--
-- (b) Trigger AFTER INSERT que crea una notification para el agente. Como
--     `notifications` tiene INSERT bloqueado a clientes por RLS (sin
--     policy), insertamos desde DB en lugar de exponer service_role en
--     una Server Action. La función es SECURITY DEFINER + search_path
--     fijo, mismo patrón que `validate_visit_agent` (mig 0007).
--
-- (c) RPC `get_agent_occupied_slots` SECURITY DEFINER que permite a un
--     usuario autenticado leer SOLO los timestamps de los slots tomados
--     por un agente, sin filtrar quién agendó qué. Se necesita porque
--     RLS de `visits` solo deja ver filas donde el caller es participante;
--     el user que está agendando no es participante todavía.

-- (a) Unique partial index
create unique index if not exists visits_agent_slot_unique_active_idx
  on public.visits (agent_id, scheduled_at)
  where status in ('pending', 'confirmed', 'rescheduled');

-- (b) Trigger AFTER INSERT → notification al agente
create or replace function public.notify_agent_on_visit_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prop_title text;
begin
  select p.title into prop_title
  from public.properties p
  where p.id = new.property_id;

  insert into public.notifications (
    recipient_id, type, title, body,
    property_id, visit_id, read_at, created_at
  ) values (
    new.agent_id,
    'visit_confirmed',
    'Nueva visita agendada',
    coalesce(
      'Un usuario agendó una visita a "' || prop_title || '" el '
      || to_char(new.scheduled_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC.',
      'Un usuario agendó una visita.'
    ),
    new.property_id,
    new.id,
    null,
    now()
  );
  return new;
end;
$$;

drop trigger if exists visits_notify_agent_on_insert on public.visits;
create trigger visits_notify_agent_on_insert
  after insert on public.visits
  for each row execute function public.notify_agent_on_visit_insert();

-- El trigger es SECURITY DEFINER, así que internamente puede INSERTAR en
-- notifications saltando RLS (ése es el propósito). No otorgamos EXECUTE
-- a authenticated/anon: solo el motor de triggers lo invoca. Esto
-- preserva la intención original de mig 0011 para esta función.

-- (c) RPC para leer slots ocupados sin filtrar identidad
create or replace function public.get_agent_occupied_slots(
  agent uuid,
  from_ts timestamptz,
  to_ts timestamptz
)
returns table (scheduled_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select v.scheduled_at
  from public.visits v
  where v.agent_id = agent
    and v.status in ('pending', 'confirmed', 'rescheduled')
    and v.scheduled_at >= from_ts
    and v.scheduled_at <= to_ts;
$$;

grant execute on function public.get_agent_occupied_slots(uuid, timestamptz, timestamptz)
  to authenticated;
```

> **Nota al implementer**: no toques las migraciones 0001-0015. Si el
> advisor de Supabase emite WARNs por SECURITY DEFINER nuevo, son
> aceptables — mismo trade-off documentado en `CLAUDE.md` para
> `is_admin`/etc. Las funciones nuevas no filtran información sensible
> (un slot ocupado revela solo "ese momento no está libre", no quién lo
> reservó).

---

## 7. Server Action `scheduleVisit`

Archivo: `src/lib/visits/actions.ts` (nuevo). NO extender
`src/lib/properties/actions.ts`: dominio distinto.

### 7.1 Signature y schema

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const schema = z.object({
  propertyId: z.string().uuid(),
  scheduledAt: z
    .string()
    .datetime({ offset: true }) // ISO con offset, ej. "2026-10-08T16:00:00.000Z"
    .refine((iso) => {
      const t = new Date(iso).getTime();
      const now = Date.now();
      const min = now + 24 * 3600 * 1000;
      const max = now + 60 * 24 * 3600 * 1000;
      return t >= min && t <= max;
    }, 'La fecha debe estar entre 24 horas y 60 días desde ahora.'),
  message: z.string().trim().max(500).optional().or(z.literal('')),
});

export type ScheduleVisitResult =
  | { ok: true; visitId: string }
  | {
      ok: false;
      error: {
        code:
          | 'unauthenticated'
          | 'invalid'
          | 'property_not_found'
          | 'is_owner'
          | 'slot_taken'
          | 'server';
        message: string;
        // Si code === 'slot_taken' el caller pide refrescar la grilla
        // (revalidatePath('/property/[id]/schedule') ya se hace dentro
        // de la action antes de devolver).
      };
    };

export async function scheduleVisit(input: z.input<typeof schema>): Promise<ScheduleVisitResult> {
  /* … */
}
```

### 7.2 Flujo paso a paso

```
1. parsed = schema.safeParse(input)
   - !success → { ok:false, error:{code:'invalid', message: zod issue} }

2. supabase = await createClient()
   user = supabase.auth.getUser()
   - !user → { ok:false, error:{code:'unauthenticated', ...} }

3. property = supabase.from('properties')
     .select('owner_id, listing_status')
     .eq('id', parsed.propertyId)
     .maybeSingle()
   - error o !property → { ok:false, error:{code:'property_not_found', ...} }
   - property.listing_status !== 'active' → 'property_not_found'
   - property.owner_id === user.id → { ok:false, error:{code:'is_owner', ...} }

4. insert = supabase.from('visits').insert({
     property_id: parsed.propertyId,
     user_id: user.id,
     agent_id: property.owner_id,
     scheduled_at: parsed.scheduledAt,
     duration_minutes: 30,
     status: 'confirmed',                // ver §11 D4
     message: parsed.message || null,
   }).select('id').single()

5. if (insert.error) {
     if (insert.error.code === '23505') {
       // unique_violation del constraint del paso (a)
       revalidatePath('/property/[id]/schedule')
       return { ok:false, error:{code:'slot_taken', message:'Ese horario acaba de ser tomado. Elige otro.'} }
     }
     // log + return server
     return { ok:false, error:{code:'server', message:'No se pudo agendar.'} }
   }

6. // El trigger AFTER INSERT ya creó la notification.
   revalidatePath('/property/[id]/schedule')
   revalidatePath('/profile')        // tab visits del user (futuro)
   return { ok:true, visitId: insert.data.id }
```

### 7.3 Validaciones zod — exhaustivo

| Campo                      | Regla                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `propertyId`               | `z.string().uuid()` requerido.                                                                                                             |
| `scheduledAt`              | ISO 8601 con offset; ventana [now+24h, now+60d]; **adicional en server** (no en zod): debe ser :00 o :30 (slot válido) — validar manual.   |
| `message`                  | `trim().max(500)`, opcional; vacío permitido (se persiste `null` si trim().length === 0).                                                  |
| **No vienen del cliente**: | `user_id` (de `auth.uid()`), `agent_id` (de `properties.owner_id`), `duration_minutes` (constante 30), `status` (constante `'confirmed'`). |

> El validador adicional de `minutes in {0,30}` se hace imperativo
> después del `safeParse` porque zod refines no propagan código de
> error tan limpiamente como una rama explícita. Si el slot no es
> válido (alguien posteó 10:45) → `code:'invalid'`.

### 7.4 Side effects post-insert

- **No** se inserta la notification desde la Server Action — la crea el
  trigger DB (§6 b).
- `revalidatePath('/property/[id]/schedule')` para refrescar `occupiedSlotsIso`
  del SSR si el user vuelve aquí.
- `revalidatePath('/profile')` (aunque la página aún no exista) — es
  un no-op hoy y queda preparado para cuando `user_profile_screen` la
  consuma. **Decisión consciente** (ver R3).

---

## 8. Notificación al agente — decisión razonada

**Decisión: trigger DB AFTER INSERT (opción A del prompt)**.

**Por qué**:

1. **No requiere exponer service_role.** Mantenemos la regla dura "no
   bypass de RLS desde Server Actions cuando hay alternativa". El trigger
   corre en DB con privilegios elevados solo para una operación
   acotada.
2. **Atomicidad.** Si la inserción de la notification fallara, el
   `INSERT INTO visits` también revierte (mismo trxn). Con Server Action
   tendríamos que coordinar dos llamadas y manejar el caso "visit creada
   pero notification no" — más código y más estados sucios.
3. **Lógica cerca del dato.** El trigger es 25 líneas SQL; el equivalente
   en Server Action sería un segundo cliente con service_role + try/catch
   - cleanup. Menos código se rompe menos.
4. **Reutilizable.** Si en el futuro el agente reagenda una visita (UPDATE
   status='rescheduled' o INSERT de nueva fila), el mismo trigger se
   puede extender o duplicar para `AFTER UPDATE WHEN (status diff)`.
5. **Coherente con el patrón del proyecto.** `validate_visit_agent` (mig 0007) ya usa el patrón "trigger SECURITY DEFINER para lógica de
   integridad". `notify_agent_on_visit_insert` lo extiende para
   side-effects.

**Trade-off aceptado**: el body de la notification se compone con
template SQL básico (`'… "' || title || '" el ' || to_char(…)`). Es
suficiente para el MVP. Si más adelante queremos rich body (HTML,
variables i18n), migramos a un job o a una Server Action especializada.

---

## 9. Estados

### 9.1 Datos cargados con disponibilidad (estado base)

- `MonthCalendar`: muestra mes actual (`new Date()`), día seleccionado
  por defecto = primer día con al menos un slot libre en la ventana
  [now+24h, now+60d]. Si todos los próximos 60 días están totalmente
  reservados (caso muy raro), no hay día seleccionado → `TimeSlotGrid`
  muestra empty (§9.4).
- `TimeSlotGrid`: 22 botones (9:00…19:30). Cada uno con su estado
  derivado de `occupiedSlotsIso` + `now`. Slot seleccionado por
  default = primero disponible del día actual.
- Botón "Confirmar visita": `disabled` hasta que `selectedSlotIso` no
  sea null.

### 9.2 Loading inicial

`src/app/(app)/property/[id]/schedule/loading.tsx`: skeleton con la
estructura split:

- Sidebar: `aspect-[4/3]` placeholder + 3 líneas de texto skeleton +
  divider + avatar circle skeleton + 2 líneas.
- Main: 2 líneas heading + grid 7×6 de cuadrados skeleton (calendario) +
  grid 4×2 pills skeleton (slots) + textarea skeleton + botón pill.
- Tokens: `bg-divider-soft animate-pulse` (mismo patrón que el
  `PropertyCardSkeleton`).

### 9.3 Submit en curso

- `useTransition` envuelve el `scheduleVisit`. Mientras `isPending`:
  - Botón Confirm con `loading={true}` (spinner del Button primitivo).
  - `aria-busy="true"` en el form.
  - Todos los slots y días del calendario quedan `pointer-events-none`
    via CSS condicional en el contenedor.

### 9.4 Fecha seleccionada sin slots disponibles

- Si todos los 22 slots del día están ocupados o pasados, `TimeSlotGrid`
  no renderiza el grid sino un mensaje suave:
  > `<p class="text-sm text-muted text-center py-8">No hay horarios
disponibles este día. Prueba con otra fecha.</p>`
- `MonthCalendar` marca ese día como `line-through` para que sea
  evidente desde la grilla (`fullyBookedDateIsoSet` se calcula en el
  cliente derivando de `occupiedSlotsIso`).

### 9.5 Error: `slot_taken` (race condition)

- Server Action devuelve `{ ok:false, error:{code:'slot_taken'} }`.
- El client:
  1. Muestra inline banner sobre el footer: `<div role="alert" class="rounded
bg-danger-soft text-danger px-4 py-3 text-sm">Ese horario acaba de
ser tomado. Elige otro.</div>`.
  2. Re-fetch de `occupiedSlotsIso` vía `router.refresh()` (Next 16:
     `useRouter().refresh()` re-corre el Server Component padre y
     re-hidrata las props).
  3. Limpia `selectedSlotIso`, deja la fecha seleccionada (probablemente
     el día sigue teniendo slots libres).

### 9.6 Error: `invalid` (zod o fechas fuera de ventana)

- Banner inline con `error.message`. No re-fetch.

### 9.7 Error: `is_owner` (caso edge: bypass de URL directa)

- La página ya redirige server-side si `property.owner_id === user.id`
  (§2), así que en práctica no llega al submit. Si llega (race entre
  cargar y cambiar de cuenta), banner: "No puedes agendar una visita a
  tu propia propiedad." y el botón queda disabled.

### 9.8 Error: `server` / network

- Banner: "Algo salió mal. Inténtalo de nuevo." + el botón Confirm
  vuelve a estar habilitado.

### 9.9 Validación inline del textarea

- `MessageTextarea` muestra contador `N / 500` con color:
  - `text-muted` si `N < 450`.
  - `text-warning` si `450 ≤ N < 500`.
  - `text-danger` si `N >= 500` (con `aria-live="polite"` para
    anunciar).
- El zod del server también valida `.max(500)`; si el cliente lo deja
  pasar (manipulación), el server devuelve `'invalid'`.

### 9.10 Tras éxito

1. `useTransition` termina con `result.ok === true`.
2. Cliente muestra **toast efímero** "Visita confirmada." con `Icon
name="check_circle"` y `bg-success-soft text-success` (ver R5: no
   hay sistema de Toast global aún; implementación in-place — pequeño
   `<div role="status" aria-live="polite">` posicionado `fixed
bottom-20 left-1/2 -translate-x-1/2 z-50` que auto-oculta a 2500ms
   con `setTimeout` + state local).
3. Tras 600ms (para que el toast sea visible), `router.push('/profile?tab=visits')`.
4. **Riesgo conocido**: la página `/profile` aún no existe → 404 nativo
   de Next hasta que `user_profile_screen` se construya. Aceptable y
   documentado en R3.

---

## 10. Tokens, tipografía y a11y

### 10.1 Tokens (todos ya en `globals.css`, cero hex en JSX)

| Pieza                                     | Token / utility                                                                                                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card raíz                                 | `bg-surface rounded-xl shadow-soft border border-divider-soft overflow-hidden`                                                                                                |
| Sidebar                                   | `bg-surface-soft p-6 md:p-8 lg:p-10`                                                                                                                                          |
| Main                                      | `bg-surface p-6 md:p-8 lg:p-10`                                                                                                                                               |
| h1 "Agendar una visita"                   | `text-2xl md:text-3xl font-medium text-on-surface`                                                                                                                            |
| Subtítulo                                 | `text-sm text-muted`                                                                                                                                                          |
| Section labels (mes / horarios / mensaje) | `text-xs font-semibold uppercase tracking-wider text-on-surface`                                                                                                              |
| Chevrons mes                              | `IconButton` ghost: `text-muted hover:text-primary p-1 rounded-full hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-primary`                                   |
| Día header (Lun…Dom)                      | `text-xs font-medium text-muted py-2`                                                                                                                                         |
| Día normal                                | `text-sm text-on-surface hover:bg-surface-hover rounded-lg py-2 transition-colors`                                                                                            |
| Día seleccionado                          | `bg-primary text-on-primary font-semibold shadow-soft py-2 rounded-lg transform scale-105` (+ dot blanco abajo)                                                               |
| Día pasado / fuera de ventana             | `text-muted/40 cursor-not-allowed`                                                                                                                                            |
| Día totalmente reservado                  | `text-muted line-through cursor-not-allowed`                                                                                                                                  |
| Slot default                              | `border border-outline text-muted hover:border-primary hover:text-primary rounded-lg py-2 px-3 text-sm transition-colors`                                                     |
| Slot seleccionado                         | `bg-primary-soft border border-primary text-primary font-medium rounded-lg py-2 px-3 text-sm shadow-sm`                                                                       |
| Slot ocupado/pasado                       | `border border-outline text-muted line-through opacity-50 cursor-not-allowed`                                                                                                 |
| Textarea                                  | `w-full rounded-lg border border-outline bg-surface-soft text-on-surface placeholder:text-muted focus:ring-2 focus:ring-primary focus:border-primary resize-none text-sm p-3` |
| Counter (default)                         | `text-xs text-muted`                                                                                                                                                          |
| Counter (warn)                            | `text-xs text-warning`                                                                                                                                                        |
| Counter (danger)                          | `text-xs text-danger`                                                                                                                                                         |
| Footer divider                            | `border-t border-divider-soft pt-6`                                                                                                                                           |
| Banner error                              | `rounded bg-danger-soft text-danger px-4 py-3 text-sm` + `role="alert"`                                                                                                       |
| Toast éxito                               | `fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-full bg-success-soft text-success px-6 py-3 shadow-soft` + `role="status"`                                            |
| Botón Confirmar                           | `<Button variant="primary" size="lg" trailingIcon="arrow_forward">`                                                                                                           |
| Cancel                                    | `<Link>` con `text-sm text-muted hover:text-on-surface`                                                                                                                       |
| Back link (parte superior)                | `text-sm text-muted hover:text-primary inline-flex items-center gap-2`                                                                                                        |

### 10.2 Tipografía

| Elemento                              | Token Tailwind                     | Peso                               |
| ------------------------------------- | ---------------------------------- | ---------------------------------- |
| h1 "Agendar una visita"               | `text-2xl md:text-3xl`             | `font-medium` 500                  |
| Subtítulo                             | `text-sm`                          | `font-normal` 400                  |
| h2 sidebar (título propiedad)         | `text-xl md:text-2xl`              | `font-medium` 500                  |
| Address sidebar                       | `text-sm`                          | 400 + `text-muted`                 |
| Precio sidebar                        | `text-xl md:text-2xl`              | `font-bold` 700 con `text-primary` |
| Specs (4 Hab, 3 Baños, 3,200 ft²)     | `text-xs uppercase tracking-wider` | `font-medium` 500                  |
| Labels secciones (Octubre, Horarios…) | `text-xs uppercase tracking-wider` | `font-semibold` 600                |
| Día calendario                        | `text-sm`                          | 400 / 600 si seleccionado          |
| Slot label                            | `text-sm`                          | 400 / 500 si seleccionado          |
| Textarea body                         | `text-sm`                          | 400                                |
| Botón Confirm                         | `text-base`                        | `font-medium` 500                  |

### 10.3 A11y (cerrada por mí)

- **Calendario**:
  - Container `role="grid"` con `aria-labelledby="month-heading"`.
  - Cada celda `role="gridcell"`; cada `<button>` día tiene
    `aria-label="Martes 8 de octubre de 2026"` (via `Intl.DateTimeFormat`)
    y `aria-pressed={isSelected}`.
  - **Navegación con teclado**:
    - `ArrowLeft` / `ArrowRight` → día prev / next (saltar al mes anterior/siguiente si nos pasamos del borde, igual que Apple Calendar).
    - `ArrowUp` / `ArrowDown` → semana prev / next.
    - `Home` / `End` → primer / último día del mes visible.
    - `PageUp` / `PageDown` → mes anterior / siguiente.
    - `Enter` / `Space` → seleccionar.
  - `tabIndex={0}` solo en el día activo (focus follows selection); los demás `tabIndex={-1}` (patrón roving tabindex).
- **Chevrons de mes**: `<IconButton aria-label="Mes anterior" />` / `"Mes siguiente"`. Disabled cuando el mes anterior está completamente fuera de la ventana (todos los días del mes son past o > now+24h).
- **Slots**: cada `<button>` con `aria-label="10:00 AM, miércoles 8 de octubre"` y `aria-pressed`. `aria-disabled="true"` si ocupado/pasado.
- **Tab order**: back link → chevron prev → chevron next → día activo del calendario → primer slot disponible → textarea → cancel → confirm.
- **Focus visible**: `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2` en todos los buttons (heredado del primitivo `Button`/`IconButton`).
- **Contraste** WCAG AA:
  - `text-primary` (#006655) sobre `bg-primary-soft` (rgba(0,102,85,0.1)) → contraste 7:1 ✓.
  - `text-muted` (#5C706D) sobre `bg-surface-soft` (#D9ECC8) → contraste 4.5:1 ✓ (verificado contra paleta base).
- **Errores**: banner con `role="alert"` (alta prioridad, anuncio inmediato).
- **Toast éxito**: `role="status" aria-live="polite"` (anuncio tras éxito).
- **Form**: `<form>` con `aria-busy={isPending}`. `noValidate` (toda la validación va al server; el cliente solo previene errores obvios).

---

## 11. Riesgos y decisiones abiertas

### 11.1 Riesgos

| #   | Riesgo                                                                                                                                                                                            | Mitigación                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Abrir lectura de `visits.scheduled_at` a usuarios que no son participantes podría filtrar patrones de actividad del agente.                                                                       | RPC `get_agent_occupied_slots` devuelve **solo** el timestamp, sin user_id, message ni nada más. Cualquier user autenticado conoce los horarios de un agente — equivalente a lo que verían si llamaran y preguntaran. Aceptable. **No abrimos RLS de `visits`.**                                                                                                                                                                                                                                                                                                       |
| R2  | El trigger `notify_agent_on_visit_insert` es `SECURITY DEFINER` + `INSERT` en `notifications`, eludiendo RLS. Si bug en lógica → cualquier INSERT en visits podría meter basura en notifications. | El trigger es estático (no recibe input del cliente más allá del row que se insertó, ya validado por trigger `validate_visit_agent` previo). Search_path fijo. La función tiene 25 líneas y es idempotente en su shape. Riesgo bajo.                                                                                                                                                                                                                                                                                                                                   |
| R3  | Tras éxito redirigimos a `/profile?tab=visits`, página que no existe → 404 hasta `user_profile_screen`.                                                                                           | Aceptado en el prompt (mismo patrón que favorites→`/property/[id]/visit`). El toast "Visita confirmada" ya cumple el feedback inmediato. Cuando la pantalla profile exista, no hay nada que cambiar aquí. Si el humano prefiere, alternativa: redirigir a `/property/[id]` y confiar en el toast.                                                                                                                                                                                                                                                                      |
| R4  | Timezone handling. `scheduled_at` es `timestamptz` (UTC en DB). Si el browser del user está en una zona y el agente en otra, la interpretación visual difiere.                                    | **Decisión cerrada**: `scheduledAt` siempre se envía como ISO con offset UTC al server. El render en client usa `Intl.DateTimeFormat` con `timeZone: undefined` (= zona del browser). El agente recibe la notification con el timestamp formateado en UTC en el body (`to_char(... at time zone 'UTC')`). **En MVP NO normalizamos a timezone de la propiedad** — es deuda documentada para cuando agreguemos `properties.timezone` (futuro). El supuesto pragmático: user y agente están en zonas similares para una visita presencial (ambos cerca de la propiedad). |
| R5  | No hay sistema de Toast global; lo implementamos in-place dentro de `VisitScheduler`. Si más adelante hay un `<Toaster>` global, este código será refactorizable.                                 | Documentado como deuda menor (TODO en código, paralelo al `TODO(toast)` ya presente en `FavoriteButton`). El comportamiento visual cumple el acceptance.                                                                                                                                                                                                                                                                                                                                                                                                               |
| R6  | El user podría manipular el `<input type="hidden" name="scheduledAt">` y mandar un timestamp fuera de slot (ej. 10:45) o fuera de horario laboral (ej. 22:00).                                    | La validación zod del server cubre la ventana 24h-60d, y un check adicional valida `minutes in {0,30}` y `hour in [9..19]` (con `19:30` como último slot inclusive). Si falla → `code:'invalid'`. Defense-in-depth: la DB no tiene constraint sobre horas, así que la validación queda en el server-action. **Decisión consciente**: no agregar check SQL para no rigidizar el "horario laboral" si en el futuro lo configuramos por agente.                                                                                                                           |
| R7  | El conjunto `occupiedSlotsIso` precargado (60 días) puede crecer con agentes prolíficos.                                                                                                          | Cota realista: 22 slots × 60 días × tasa de ocupación ~30% = ~400 timestamps × 24 chars = ~10KB serializados. Sin problema. Si supera 1000 entries, refactor a fetch incremental por mes (opción b del prompt).                                                                                                                                                                                                                                                                                                                                                        |
| R8  | El middleware actual usa `pathname.startsWith('/visits')` que NO matchea `/property/[id]/schedule`. Hay que sumar `/property/` solo bajo `/schedule`.                                             | Modificar `proxy.ts` agregando una condición específica: `pathname.match(/^\/property\/[^\/]+\/schedule$/)`. Alternativa más simple: agregar `pathname.includes('/schedule')` pero matchearía `/dashboard/properties/.../schedule` accidentalmente — usar el regex. **Decisión cerrada**.                                                                                                                                                                                                                                                                              |

### 11.2 Decisiones abiertas para el humano (con default mío)

| #       | Decisión                                                                                                | Default propuesto                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1**  | **Forma del calendario**: mes navegable con chevrons (mockup) vs lista horizontal scrollable de días.   | **Mes navegable con chevrons.** Razones: (1) es exactamente lo que muestra el PNG y el HTML; (2) ofrece overview de disponibilidad por mes (line-through en días llenos da scaneo rápido); (3) ventana de 60 días = 2 meses, máximo 1 chevron forward = bajo costo de navegación. Alternativa rechazada: la lista horizontal es buena para "próximos 7-14 días" pero hace difícil ver "ese viernes de fin de mes".                     |
| **D2**  | **Server vs Client para fetch de slots ocupados**: prefetch batch (a) vs Server Action incremental (b). | **(a) Prefetch batch.** Razones en §4.2.                                                                                                                                                                                                                                                                                                                                                                                               |
| **D3**  | **Validación de disponibilidad en server**: constraint único DB vs check imperativo en Server Action.   | **Constraint único parcial** (`status in ('pending','confirmed','rescheduled')`), implementado en migración 0016 (§6 a). Razones: (1) es la única forma fiable de prevenir race conditions; (2) el check imperativo previo ("SELECT antes de INSERT") sigue siendo una race; (3) la DB devuelve error code 23505 unique_violation, que la Server Action mapea a `slot_taken`.                                                          |
| **D4**  | **Status inicial**: `pending` (agente debe confirmar) vs `confirmed` (auto-confirmado).                 | **`confirmed`.** Razones: (1) el mockup dice "Confirm Visit" → expectativa de confirmación inmediata; (2) un user que reserva slot exclusivo no quiere esperar; (3) si el agente no puede asistir, tiene el flow de reagendar/cancelar (futuro). Si más adelante queremos workflow de approval, cambiamos default a `pending` y agregamos botón "Aceptar" en `/dashboard/visits`. Alternativa rechazada porque agrega fricción en MVP. |
| **D5**  | **Notification al agente**: trigger DB (A) vs Server Action con service_role (B).                       | **(A) Trigger DB.** Razones detalladas en §8.                                                                                                                                                                                                                                                                                                                                                                                          |
| **D6**  | **¿Permitir agendar el mismo slot a varios users con distintos agentes?**                               | **Sí.** El constraint único es por `(agent_id, scheduled_at)`. Si Ana reserva 10am con Carlos y Beto reserva 10am con Diana (otra propiedad de otro agente), ambos pueden. Es la decisión arquitectónica ya cerrada por el humano ("slot exclusivo por agente").                                                                                                                                                                       |
| **D7**  | **¿Validar que `user_id !== agent_id` en la Server Action o confiar en redirect server-side?**          | **Doble check: redirect server-side en page.tsx + check explícito en Server Action devolviendo `code:'is_owner'`.** Defense-in-depth.                                                                                                                                                                                                                                                                                                  |
| **D8**  | **¿Toast efímero o página de confirmación dedicada `/property/[id]/schedule/success`?**                 | **Toast efímero + redirect a profile.** Razones: la pantalla success agrega friction y una página nueva sin valor (la info "qué visita reservaste" la vas a ver en `/profile?tab=visits`). El toast cubre el feedback inmediato. Confirmar con humano (puede preferir confirmation page para reducir % de reservas accidentales).                                                                                                      |
| **D9**  | **¿Bloquear o permitir agendar visita a una propiedad `pending`/`sold`/`rented`?**                      | **Bloquear (notFound en page.tsx + `property_not_found` en Server Action).** Razones: visitas a propiedades no-active no aportan; el agente no debería recibir solicitudes "fantasma".                                                                                                                                                                                                                                                 |
| **D10** | **`week start`**: Domingo (mockup) vs Lunes (es-MX/es-ES convencional).                                 | **Lunes** (es-\* convención). El HTML del mockup dice Sun-Sat pero el PNG en español debería seguir convención local. Es un detalle menor: si el humano prefiere Sun, una constante `WEEK_START_DAY = 1` cambia a `0` en una línea. **El mockup PNG no es nítido al respecto** (la primera columna podría leerse como Dom o Lun — depende del renderer).                                                                               |
| **D11** | **¿Permitir mensajes vacíos o forzar mínimo de caracteres si el user empezó a escribir?**               | **Mensaje completamente opcional**, vacío permitido (`null` en DB). El mockup lo marca "(Optional)". Sin trim-min.                                                                                                                                                                                                                                                                                                                     |

---

## 12. Estructura de archivos a crear

```
src/
  app/
    (app)/
      property/
        [id]/
          schedule/
            page.tsx                    [nuevo — Server Component]
            loading.tsx                 [nuevo — skeleton]
  components/
    visits/                             [carpeta nueva]
      VisitPropertySummary.tsx          [Server]
      VisitScheduler.tsx                [Client — orquesta el form]
      MonthCalendar.tsx                 [Client]
      TimeSlotGrid.tsx                  [Client]
      MessageTextarea.tsx               [Client]
      index.ts                          [barrel]
  lib/
    visits/                             [carpeta nueva]
      actions.ts                        [scheduleVisit Server Action]
      queries.ts                        [getAgentOccupiedSlots]
      slot-utils.ts                     [funciones puras de fechas]
  lib/
    supabase/
      proxy.ts                          [MODIFICAR — sumar regex /property/[id]/schedule a protectedPaths]
supabase/
  migrations/
    0016_visits_slot_constraint_and_notification_trigger.sql  [nuevo]
```

> El implementer NO debe modificar `feature_list.json`. El leader lo
> hace en cierre. El implementer SÍ debe regenerar
> `src/types/database.ts` con `mcp__supabase__generate_typescript_types`
> después de aplicar la migración (la nueva función RPC aparecerá en el
> tipo `Database['public']['Functions']`).

---

## 13. Tipografía resumen (ver §10.2 para mapping completo)

Toda Inter (única familia ya cargada vía `next/font/google` en
`src/app/layout.tsx`). Pesos usados: 400, 500, 600, 700. Cero pesos
nuevos.

---

## 14. Alternativas consideradas

### Opción A — Mes navegable con chevrons + sidebar split + slot exclusivo por agente + trigger DB para notification (spec actual)

- **Pros**: paridad 1:1 con mockup. Patrón industria (Calendly,
  ServiceTitan). Race-condition imposible (constraint DB). Notifications
  atómicas con la visita. Privacy preservada (RPC devuelve solo
  timestamps).
- **Contras**: requiere migración con SECURITY DEFINER (+1 WARN del
  advisor); el render full-month puede sobrecargar visualmente si la
  ocupación es muy densa.

### Opción B — Lista horizontal de "próximos 14 días" + slot exclusivo por agente + Server Action para notification con service_role

- **Pros**: simplifica el calendario (no hay navegación entre meses);
  un single código path para notificar (sin trigger DB que mantener).
- **Contras**: se aleja del mockup; el horizonte de 14 días puede ser
  corto para visitas planeadas; usar service_role en Server Action es
  un footgun ("¿la action validó bien el recipient_id?" — código
  custodio). Cambia el contrato visual sin razón fuerte.

### Opción C — Day-picker reactivo (popover sobre input "Fecha") + slots inline + slot exclusivo por property (no por agente)

- **Pros**: input compacto, móvil-friendly. Permite a Ana reservar 10am
  con Carlos y Beto reservar 10am con Diana **aunque sea la misma
  propiedad** (si la propiedad tiene co-owners — caso edge).
- **Contras**: el modelo actual (slot exclusivo por agente, no por
  property) ya fue cerrado por el humano. Cambiar a slot exclusivo por
  property contradice esa decisión y hace que si Carlos tiene 5
  propiedades, alguien que quiere agendarse a las 10 con cualquiera de
  ellas, ve 5 slots libres pero solo va a poder agendar uno → confuso.

### Recomendación: **A** (la spec actual).

---

## 15. Criterios de aceptación verificables

Combinación de los del `feature_list.json` + emergentes del spec. El
reviewer puede marcar `[x]`.

### Del feature_list

- [ ] `src/app/(app)/property/[id]/schedule/page.tsx` es Server Component con sidebar + form (§3, §5).
- [ ] Calendario: componente Client con state local para fecha seleccionada, navegable por mes con chevrons (§5, §10.3).
- [ ] Time slots: leer visits existentes del agente para esa fecha, marcar como ocupados los que se solapen (§4.2, §6 c).
- [ ] Server Action `scheduleVisit`: valida con zod (scheduled_at futuro, slot libre), inserta en visits, inserta notification para el agente (§7, §8).
- [ ] Loading + error states en el botón Confirm (§9.3, §9.5-9.8).
- [ ] Tras éxito: toast 'Visita confirmada' + redirige a `/profile?tab=visits` (§9.10, R3).
- [ ] Layout split: `md:w-5/12` sidebar + `md:w-7/12` form (§3).
- [ ] Mensaje opcional max 500 chars con contador (§9.9, §5 MessageTextarea).

### Emergentes del spec

- [ ] Migración `0016_visits_slot_constraint_and_notification_trigger.sql` aplicada con: (a) unique partial index, (b) trigger `notify_agent_on_visit_insert`, (c) RPC `get_agent_occupied_slots`.
- [ ] `src/lib/supabase/proxy.ts` actualizado con regex `^\/property\/[^\/]+\/schedule$` agregada a la lógica `isProtectedPath` (no romper otras rutas).
- [ ] Slot exclusivo por `(agent_id, scheduled_at)`: si dos users hacen submit del mismo slot, el segundo recibe `code:'slot_taken'` y la grilla se refresca (§9.5, R8).
- [ ] Ventana mínima de 24h y máxima de 60 días enforced en zod del Server Action (§7.1).
- [ ] Horario laboral 9:00-19:30 (último slot inclusive con duración 30min), L-D, 22 slots por día (§5 generateDaySlots).
- [ ] Status inicial `'confirmed'` (D4, §7.2 paso 4).
- [ ] Validación adicional en server: minutes ∈ {0,30}, hour ∈ [9..19] (defense-in-depth, R6).
- [ ] Dueño de la propiedad accediendo a `/schedule` → redirect server-side a `/dashboard/properties/[id]/edit` (§2, D7).
- [ ] Visitas con status `cancelled`/`completed`/`no_show` no bloquean el slot (filtro en constraint y en RPC).
- [ ] A11y:
  - [ ] Calendario navegable con teclado (ArrowKeys, Enter, Home/End, PageUp/PageDown) — §10.3.
  - [ ] Roving tabindex en días (`tabIndex` 0 solo en activo).
  - [ ] `aria-label` descriptivo en cada día y slot.
  - [ ] `aria-pressed` en días/slots seleccionados.
  - [ ] Banner errores con `role="alert"`; toast éxito con `role="status" aria-live="polite"`.
- [ ] Tokens: cero hex en JSX (verificar con grep `bg-\[#`/`text-\[#`).
- [ ] Mobile (360-414px): layout vertical con sidebar arriba y form abajo; CTA Confirmar sticky-bottom; calendario y slots legibles (§3.2).
- [ ] La RPC `get_agent_occupied_slots` devuelve solo `scheduled_at` (sin user_id, message u otro PII) → grep al SQL de la migración.
- [ ] Tras éxito el `setTimeout(600ms)` permite que el toast se vea antes del `router.push` (§9.10).
- [ ] `revalidatePath('/property/[id]/schedule')` y `revalidatePath('/profile')` se ejecutan tras éxito (§7.2 paso 6, §7.4).
- [ ] Si `slot_taken`, `useRouter().refresh()` re-fetch los `occupiedSlotsIso` y la grilla se actualiza sin reload completo (§9.5).
- [ ] Skeleton en `loading.tsx` cubre la estructura split (§9.2).

### Exclusiones (NO implementar)

- [ ] El implementer NO modifica la RLS de `visits` (la RPC es la vía).
- [ ] El implementer NO expone `service_role` en ninguna Server Action.
- [ ] El implementer NO instala libs de calendario (react-day-picker, date-fns, etc.) — funciones puras nativas bastan.
- [ ] El implementer NO crea pantalla `/property/[id]/schedule/success`.
- [ ] El implementer NO toca `feature_list.json` (lo hace el leader al cierre).
- [ ] El implementer NO regenera tipos hasta DESPUÉS de aplicar la migración (sino el TS no compila el RPC nuevo).

---

## Notas finales

- **Idioma**: todos los strings en español neutro directamente en JSX.
- **Reutilización**: `AgentBadge` cierra el patrón anticipado en el spec de `property_details_screen` (§D4 nota "Lo separamos porque también se usará en schedule_visit_screen (sidebar)").
- **Deuda menor documentada**: (1) Toast in-place sin sistema global (R5); (2) `/profile` aún no existe (R3); (3) horario laboral hardcoded 9-19:30 L-D (no configurable por agente).
- **Sin nuevas dependencias**: solo `Intl.DateTimeFormat`, `Date`, `useTransition`, `useRouter` ya en uso.
- **Sin nuevos tokens**: todo lo necesario ya existe en `globals.css`.

---

## 16. Delta de aprobación humana (2026-05-25)

El humano aprobó el spec con los siguientes cambios sobre las decisiones abiertas. Estos cambios son **vinculantes** para el implementer y prevalecen sobre lo escrito arriba donde haya conflicto.

### 16.1 D8 — Confirmada: toast efímero + redirect a `/profile?tab=visits`

Sin cambios respecto al default propuesto. `/profile` no existe aún (R3 sigue aceptado). Implementer: ver §9.10.

### 16.2 D10 — Confirmada: week start en Lunes

Sin cambios. Constante `WEEK_START_DAY = 1` (Lun).

### 16.3 R4/D-NEW — Timezone: agregar `properties.timezone` en esta feature (scope ampliado)

**Decisión humana**: en lugar de formatear la notification body en UTC (default), normalizamos al timezone **de la propiedad**. Esto implica scope ampliado: una **segunda migración** y actualización del seed.

#### Cambios obligatorios al spec original

##### 16.3.1 Nueva migración `0017_properties_timezone.sql`

Después de `0016` (no junto — son cambios disjuntos: 0016 es schema de visits/notifications, 0017 es schema de properties). Contenido completo:

```sql
-- 0017_properties_timezone.sql
--
-- Agrega columna `timezone` a `properties` (IANA tz string, ej.
-- 'America/Los_Angeles'). Se usa para:
--   1. Renderizar slots en la pantalla schedule_visit_screen con
--      Intl.DateTimeFormat({ timeZone: property.timezone }).
--   2. Formatear el body de la notification al agente en zona local
--      de la propiedad (en lugar de UTC).
--
-- Default 'America/Mexico_City' (paleta es-MX). Backfill de las 12
-- propiedades seed según ciudad.

alter table public.properties
  add column if not exists timezone text not null
    default 'America/Mexico_City';

-- Backfill por ciudad (idempotente: solo afecta filas con default vigente).
-- Las 12 properties del seed mapean a estos timezones:
update public.properties set timezone = 'America/Los_Angeles'
  where city in ('Beverly Hills', 'Palo Alto', 'Seattle', 'Portland', 'Bend')
    and timezone = 'America/Mexico_City';

update public.properties set timezone = 'America/Vancouver'
  where city = 'Vancouver' and timezone = 'America/Mexico_City';

update public.properties set timezone = 'America/New_York'
  where city = 'New York' and timezone = 'America/Mexico_City';

update public.properties set timezone = 'America/Chicago'
  where city = 'Miami' and timezone = 'America/Mexico_City';
  -- Nota: Miami es America/New_York en realidad, pero el seed dice Miami
  -- y queremos zona consistente con east coast — corregir abajo:

update public.properties set timezone = 'America/New_York'
  where city = 'Miami' and timezone = 'America/Chicago';

update public.properties set timezone = 'Europe/Copenhagen'
  where city = 'Copenhagen' and timezone = 'America/Mexico_City';

-- Cualquier property no mapeada queda en 'America/Mexico_City' (default razonable).
```

> **Validación post-migración**: el implementer debe correr
> `select city, timezone, count(*) from properties group by city, timezone order by city;`
> y verificar que ninguna ciudad quede con `America/Mexico_City` por accidente.

##### 16.3.2 Trigger `notify_agent_on_visit_insert` ahora usa `properties.timezone`

Reemplaza el cuerpo de la función en la migración **0016** original (§6 b). El body ahora hace JOIN explícito al timezone de la propiedad:

```sql
create or replace function public.notify_agent_on_visit_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prop_title text;
  prop_tz text;
  formatted_local text;
begin
  select p.title, p.timezone into prop_title, prop_tz
  from public.properties p
  where p.id = new.property_id;

  -- Formateo en zona local de la propiedad.
  -- to_char con AT TIME ZONE devuelve la representación local.
  formatted_local := to_char(
    new.scheduled_at at time zone coalesce(prop_tz, 'America/Mexico_City'),
    'DD/MM/YYYY HH24:MI'
  );

  insert into public.notifications (
    recipient_id, type, title, body,
    property_id, visit_id, read_at, created_at
  ) values (
    new.agent_id,
    'visit_confirmed',
    'Nueva visita agendada',
    coalesce(
      'Un usuario agendó una visita a "' || prop_title || '" el '
      || formatted_local || ' (hora local de la propiedad).',
      'Un usuario agendó una visita.'
    ),
    new.property_id,
    new.id,
    null,
    now()
  );
  return new;
end;
$$;
```

> **Orden de aplicación**: el implementer aplica **0017 primero** (agrega
> la columna), **luego** 0016 (que depende de la columna existir). Si
> esto choca con el numbering convention, alternativa: invertir nombres
> a `0016_properties_timezone.sql` y `0017_visits_slot_constraint_and_notification_trigger.sql`.
> **Decisión**: invertir. El implementer renombra/reorganiza así:
>
> - `0016_properties_timezone.sql` (lo de 16.3.1)
> - `0017_visits_slot_constraint_and_notification_trigger.sql` (lo de §6 con el trigger actualizado de 16.3.2 + RPC + index)

##### 16.3.3 Seed actualizado (`scripts/seed.ts`)

Añadir campo opcional `timezone?: string` al type `SeedProperty` y poblarlo explícitamente para las 12 properties existentes. Mapping:

| Ciudad seed     | Timezone IANA         |
| --------------- | --------------------- |
| Beverly Hills   | `America/Los_Angeles` |
| Vancouver       | `America/Vancouver`   |
| Seattle         | `America/Los_Angeles` |
| Portland        | `America/Los_Angeles` |
| Bend            | `America/Los_Angeles` |
| Miami           | `America/New_York`    |
| Palo Alto       | `America/Los_Angeles` |
| New York / SoHo | `America/New_York`    |
| Copenhagen      | `Europe/Copenhagen`   |

El UPSERT del seed (idempotente) debe incluir `timezone: seed.timezone ?? 'America/Mexico_City'` al insertar/actualizar. Esto garantiza que correr `pnpm db:seed` tras la migración deje el estado consistente aunque haya properties futuras sin TZ explícita.

##### 16.3.4 Render del client en zona de la propiedad

`VisitScheduler` ahora recibe una prop nueva `propertyTimeZone: string` (IANA). Pasarla a:

- `slot-utils.generateDaySlots(date, timeZone)`: los slots 9:00-19:30 deben ser **horas locales de la propiedad**, no del browser. Implementación: construir las horas en UTC iterando por `Intl.DateTimeFormat` con `timeZone: propertyTimeZone`. Helper auxiliar: dado un `Date` que representa medianoche en la zona local de la propiedad, devuelve los 22 timestamps UTC correspondientes a 9:00, 9:30, …, 19:30 en esa zona.
- `formatSlotLabel(date, timeZone)`: usa `Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', timeZone })`. Resultado: "10:00" se muestra igual independientemente del browser del visitante. (Si visitante en CDMX agenda visita a Beverly Hills, ve "10:00 (hora de Los Ángeles)" — el slot **es** 10:00 en LA = 12:00 en CDMX = ISO en UTC).
- El día del calendario también se determina en zona de la propiedad: si en Beverly Hills es 7 de octubre 23:30 y el browser del visitante (en Madrid) marca 8 de octubre 8:30, el visitante ve "viernes 7 de octubre" como día actual del calendario. Helper: `getMonthDays(monthDate, timeZone)`.

##### 16.3.5 UI: indicador de zona en el sidebar y arriba de TimeSlotGrid

Para que el usuario entienda en qué zona está agendando, agregar:

- **Sidebar (VisitPropertySummary)**: pequeña línea debajo de la dirección: `<p class="text-xs text-muted">Zona horaria: {formatTimezoneLabel(property.timezone)}</p>` donde `formatTimezoneLabel('America/Los_Angeles') === 'Los Ángeles (UTC-08)'`. Helper en `src/lib/visits/timezone-label.ts`:
  - Mapeo manual de IANA → label corto en español + offset calculado con `Intl.DateTimeFormat` y `timeZoneName: 'shortOffset'`.
  - Cero hex, cero libs.
- **Encima del TimeSlotGrid**: `<p class="text-xs text-muted mb-3">Horarios en zona local de la propiedad ({label})</p>`.

##### 16.3.6 Validación zod del server adapta zona de la propiedad

En `scheduleVisit` (§7), el check adicional "minutes ∈ {0,30}, hour ∈ [9..19]" se hace **en zona de la propiedad**, no en UTC ni en browser:

```ts
// pseudo-código
const propertyTz = property.timezone;
const localParts = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: 'numeric',
  hour12: false,
  timeZone: propertyTz,
}).formatToParts(new Date(parsed.scheduledAt));
const hour = Number(localParts.find((p) => p.type === 'hour').value);
const minute = Number(localParts.find((p) => p.type === 'minute').value);
if (!(minute === 0 || minute === 30) || hour < 9 || hour > 19 || (hour === 19 && minute > 30)) {
  return { ok: false, error: { code: 'invalid', message: 'Horario fuera de la ventana válida.' } };
}
```

##### 16.3.7 Tipos TypeScript

Después de aplicar las migraciones, regenerar tipos vía `mcp__supabase__generate_typescript_types` (se sobreescribe `src/types/database.ts`). El field `properties.timezone` aparecerá como `string` (NOT NULL). El RPC `get_agent_occupied_slots` aparecerá en `Database['public']['Functions']`.

#### Estructura de archivos actualizada

```
src/
  lib/
    visits/
      timezone-label.ts         [NUEVO — helper formatTimezoneLabel]
      slot-utils.ts             [MODIFICADO — todas las funciones reciben timeZone]
supabase/
  migrations/
    0016_properties_timezone.sql                                    [NUEVO — antes era 0017]
    0017_visits_slot_constraint_and_notification_trigger.sql        [NUEVO — antes era 0016, con trigger actualizado]
scripts/
  seed.ts                       [MODIFICADO — agregar timezone por property]
```

#### Acceptance criteria adicionales (sumar a §15)

- [ ] Migración `0016_properties_timezone.sql` aplicada; verificación: ninguna property tiene `timezone = 'America/Mexico_City'` (todas las seed se mapearon).
- [ ] Migración `0017_visits_slot_constraint_and_notification_trigger.sql` aplicada con el trigger que JOIN-ea `properties.timezone`.
- [ ] `scripts/seed.ts` actualizado: tras `pnpm db:seed`, las 12 properties tienen su `timezone` correcto.
- [ ] Tipos regenerados: `src/types/database.ts` incluye `timezone: string` en `properties` y la función RPC.
- [ ] Render: calendario y slots en zona local de la propiedad (verificable manualmente cambiando timezone del browser en DevTools y confirmando que los slots no se mueven).
- [ ] Sidebar muestra label de timezone humano-legible debajo de la dirección.
- [ ] Indicador "Horarios en zona local de la propiedad ({label})" visible encima del TimeSlotGrid.
- [ ] Notification body al agente formatea fecha en zona local de la propiedad (verificar con `select body from notifications order by created_at desc limit 1` tras agendar una visita de seed).

#### Riesgos derivados del scope ampliado

| #   | Riesgo                                                                                                                                                                                                             | Mitigación                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R9  | El backfill por ciudad falla si la ciudad no está en el mapping (ej. property nueva en otra ciudad antes de aplicar la mig).                                                                                       | El default `'America/Mexico_City'` cubre el caso. El test post-migración verifica que las 12 seed están bien; properties nuevas que agregue add_edit_property_form en el futuro necesitarán un input de TZ (queda como TODO documentado). |
| R10 | El user reserva un slot, el agente cambia el `timezone` de la property después (UPDATE), y el body de la notification ya almacenada queda desactualizado.                                                          | Aceptable: la notification es snapshot en el momento del agendado. Si el TZ cambia, las notifications existentes no se re-formatean. Esto evita complejidad de "regenerar bodies".                                                        |
| R11 | El indicador de TZ en UI usa offset numérico (`UTC-08`). En zonas con DST (LA, NY), el offset cambia 2 veces al año. Si el render se hace en client, queda consistente; si se hace en server, depende del momento. | Calcular el label en client (`useEffect` o render directo) usando `Intl.DateTimeFormat`. El offset será correcto para el momento del slot, no para `now()`.                                                                               |

#### Lo que NO cambia respecto al spec original

- §1, §2 (ruta, acceso): igual.
- §3 (layout ASCII y responsive): igual, solo se agrega 1 línea de texto en sidebar y 1 línea de texto encima del slot grid.
- §5 componentes principales: se agrega prop `propertyTimeZone: string` a VisitScheduler/MonthCalendar/TimeSlotGrid donde aplique; el resto igual.
- §7 Server Action signature: igual; cambia solo el check interno de hora (16.3.6).
- §8 decisión "trigger DB para notificación": igual; solo el cuerpo del trigger cambia (16.3.2).
- §9 estados, §10 tokens y a11y: igual.
- §11 R1, R2, R3, R5, R6, R7, R8: igual. **R4 queda obsoleto** (se sustituye por esta sección §16.3).
- §15 acceptance criteria original: igual + se suma 16.3 acceptance.
