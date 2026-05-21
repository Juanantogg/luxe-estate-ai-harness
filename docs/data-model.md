# Modelo de datos — Luxe Estate

Schema completo para el proyecto Supabase `eacacybbdrstirdvwwsn`. Esta es
la **propuesta inicial**; antes de aplicar migraciones el humano la aprueba.

Documento basado en lo observable en `docs/designs/<screen>/`. Todo lo que
**no** aparece en los mockups (analytics, payments, contracts, etc.) está
fuera del MVP.

---

## Principios

- **PostgreSQL con RLS obligatorio**. Cada tabla activa RLS. Las políticas
  se versionan como migraciones.
- **UUIDs como PK**. `uuid_generate_v4()` (extensión `uuid-ossp` ya instalada).
- **Timestamps con timezone** (`timestamptz`). Default `now()`. Trigger
  `updated_at` automático en tablas mutables.
- **Foreign keys con `on delete` explícito**. Default `cascade` para datos
  derivados, `restrict` para referencias a `properties`/`profiles`.
- **Enums Postgres** para valores fijos (`property_type`, `listing_type`,
  `listing_status`, `visit_status`, `user_role`).
- **Naming**: snake_case en SQL, plural en nombres de tabla.
- **Migraciones idempotentes** (`create table if not exists`, etc.) para
  poder re-correr en entornos limpios.

---

## Entidades del dominio

Inferidas de los 10 mockups:

| Entidad              | Origen en mockups                                                   |
| -------------------- | ------------------------------------------------------------------- |
| `profiles`           | Login, User Profile, Admin Directory, Property Details (agent info) |
| `properties`         | Home, Property Details, Favorites, Dashboard, Add/Edit Form         |
| `property_images`    | Property Details (gallery), Add/Edit (upload)                       |
| `property_amenities` | Property Details (lista), Add/Edit (checkboxes), Filters            |
| `favorites`          | Favorites List, Property Details (heart), Home (heart)              |
| `visits`             | Schedule Visit, User Profile (Upcoming Visits)                      |
| `conversations`      | Property Details (chat button), Schedule (mensaje al agente)        |
| `messages`           | (no hay pantalla pero necesaria para conversations)                 |
| `notifications`      | Top nav (badge rojo de notificaciones) en varias pantallas          |

---

## Enums

```sql
create type user_role as enum ('user', 'agent', 'broker', 'admin');
create type property_type as enum ('house', 'apartment', 'villa', 'penthouse', 'condo', 'townhouse', 'commercial');
create type listing_type as enum ('sale', 'rent');
create type listing_status as enum ('draft', 'active', 'pending', 'sold', 'rented', 'archived');
create type visit_status as enum ('pending', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show');
create type notification_type as enum ('new_property', 'visit_confirmed', 'visit_reminder', 'new_message', 'price_drop', 'favorite_update', 'system');
```

**Roles** (mapeo desde mockups admin):

- `user` — usuario final. Navega, favoritea, agenda visitas, conversa con agentes.
- `agent` — agente inmobiliario. Lo que el mockup llama "Agent". Publica y gestiona **sus** propiedades.
- `broker` — agente sénior. Lo que el mockup llama "Senior Broker". Mismo que `agent` por ahora, pero el rol queda separado para que después se puedan dar permisos extra (gestionar otros agentes, ver métricas, etc.). En el MVP, RLS de `broker` = RLS de `agent`.
- `admin` — administrador (lo que el mockup llama "Administrator"). Ve y gestiona todo. El "Viewer" del mockup se mapea a `user`.

---

## Schema SQL

### `profiles`

Extensión de `auth.users`. Cada usuario tiene exactamente un profile.

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  bio text,
  phone text,
  role user_role not null default 'user',
  city text,
  is_active boolean not null default true,
  member_since timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);
create index profiles_is_active_idx on public.profiles(is_active);
```

**Trigger**: al crear un `auth.users`, se inserta automáticamente un row
en `profiles` con `role = 'user'` y `email` copiado.

```sql
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### `properties`

Una propiedad publicada. **Cada propiedad pertenece a un agente** (`owner_id`).
Si el rol publicador es `admin`, también queda como `owner_id` para
simplicidad (admin actúa como agente).

```sql
create table public.properties (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete restrict,

  title text not null,
  description text,
  price numeric(12, 2) not null check (price > 0),

  listing_type listing_type not null,
  listing_status listing_status not null default 'draft',
  property_type property_type not null,

  -- Ubicación
  address_line text not null,
  city text not null,
  state text,
  country text,
  postal_code text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),

  -- Características
  bedrooms smallint not null default 0 check (bedrooms >= 0),
  bathrooms numeric(3, 1) not null default 0 check (bathrooms >= 0),
  area_sqm numeric(8, 2) check (area_sqm >= 0),
  parking_spaces smallint default 0 check (parking_spaces >= 0),
  year_built smallint check (year_built >= 1800 and year_built <= 2100),

  -- Flags de promoción
  is_featured boolean not null default false,
  is_premium boolean not null default false,

  -- Detección de price drop
  previous_price numeric(12, 2),

  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_owner_idx on public.properties(owner_id);
create index properties_status_idx on public.properties(listing_status);
create index properties_city_idx on public.properties(city);
create index properties_price_idx on public.properties(price);
create index properties_listing_type_idx on public.properties(listing_type);
create index properties_published_at_idx on public.properties(published_at desc nulls last);

-- Búsqueda full-text en title + description + city
alter table public.properties add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(city, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) stored;

create index properties_search_idx on public.properties using gin(search_vector);
```

**Reglas derivadas** (sin columnas, calculadas en queries):

- "New Arrival" → `published_at > now() - interval '7 days'`
- "Price Drop" → `previous_price is not null and price < previous_price`

### `property_images`

Galería de cada propiedad. La primera imagen (`position = 0` y/o
`is_main = true`) es la portada.

```sql
create table public.property_images (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references public.properties(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  position smallint not null default 0,
  is_main boolean not null default false,
  created_at timestamptz not null default now()
);

create index property_images_property_idx on public.property_images(property_id, position);
create unique index property_images_one_main_idx on public.property_images(property_id) where is_main = true;
```

### `property_amenities`

Lista plana de amenities por propiedad. **No** modelamos un catálogo
maestro para el MVP — el conjunto de amenities es chico y conocido
(`pool`, `gym`, `wifi`, `air_conditioning`, `garden`, `smart_home`,
`parking`, `patio`, `wine_cellar`, `ev_charging`, `central_heating`).
Si crece, se promueve a tabla.

```sql
create type amenity_key as enum (
  'pool', 'gym', 'wifi', 'air_conditioning', 'garden',
  'smart_home', 'parking', 'patio', 'wine_cellar',
  'ev_charging', 'central_heating'
);

create table public.property_amenities (
  property_id uuid not null references public.properties(id) on delete cascade,
  amenity amenity_key not null,
  primary key (property_id, amenity)
);

create index property_amenities_amenity_idx on public.property_amenities(amenity);
```

### `favorites`

Tabla many-to-many entre `profiles` y `properties`.

```sql
create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, property_id)
);

create index favorites_user_idx on public.favorites(user_id);
create index favorites_property_idx on public.favorites(property_id);
```

### `visits`

Cita de visita a una propiedad. La agenda un usuario, la confirma el
agente dueño.

```sql
create table public.visits (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references public.properties(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  agent_id uuid not null references public.profiles(id) on delete restrict,

  scheduled_at timestamptz not null,
  duration_minutes smallint not null default 30 check (duration_minutes > 0),
  status visit_status not null default 'pending',

  message text,
  agent_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index visits_property_idx on public.visits(property_id);
create index visits_user_idx on public.visits(user_id, scheduled_at desc);
create index visits_agent_idx on public.visits(agent_id, scheduled_at desc);
create index visits_scheduled_idx on public.visits(scheduled_at);
```

**Validación adicional** (trigger): `agent_id` debe coincidir con
`properties.owner_id` al insertar. Si en el futuro se modela un equipo
de agentes por propiedad, se relaja.

### `conversations`

Hilo de mensajes entre un usuario y un agente sobre una propiedad
específica. Una conversación = (user, agent, property).

```sql
create table public.conversations (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  agent_id uuid not null references public.profiles(id) on delete cascade,

  last_message_at timestamptz,
  user_unread_count integer not null default 0,
  agent_unread_count integer not null default 0,

  created_at timestamptz not null default now(),

  unique (property_id, user_id, agent_id)
);

create index conversations_user_idx on public.conversations(user_id, last_message_at desc);
create index conversations_agent_idx on public.conversations(agent_id, last_message_at desc);
```

### `messages`

```sql
create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) > 0 and length(body) <= 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages(conversation_id, created_at desc);
create index messages_sender_idx on public.messages(sender_id);
```

**Trigger**: al insertar mensaje, actualiza `conversations.last_message_at`
e incrementa `*_unread_count` del receptor.

### `notifications`

Notificaciones in-app. La badge roja del topbar cuenta `read_at is null`.

```sql
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type notification_type not null,
  title text not null,
  body text,

  -- Referencias opcionales según `type`
  property_id uuid references public.properties(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,

  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_unread_idx on public.notifications(recipient_id, created_at desc) where read_at is null;
create index notifications_recipient_idx on public.notifications(recipient_id, created_at desc);
```

### Trigger `updated_at`

Función genérica que se aplica a todas las tablas con `updated_at`:

```sql
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Se aplica a profiles, properties, visits
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
-- (idem para properties, visits)
```

---

## Diagrama de relaciones (ASCII)

```
auth.users (Supabase)
   │ 1:1
   ▼
profiles ─────────┬─────────┬─────────┬─────────┬─────────┐
   │              │         │         │         │         │
   │ owner_id     │ user_id │ user_id │ user/   │ sender_ │ recipient_
   │              │         │         │ agent   │ id      │ id
   ▼              ▼         ▼         ▼         ▼         ▼
properties ─┬─→ favorites  visits   conversations  messages  notifications
   │        │              │              │
   │        ├─→ property_images
   │        ├─→ property_amenities
   │        └─→ (referenciado por visits, conversations, notifications)
   │
   └─ search_vector (full-text)
```

---

## Row Level Security (RLS)

**Premisa**: cada tabla activa RLS. Sin políticas explícitas, nadie puede
leer ni escribir (default deny).

### Helpers

Función para chequear rol del usuario actual:

```sql
create function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create function public.is_agent_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role in ('agent', 'broker', 'admin') from public.profiles where id = auth.uid()), false);
$$;
```

### Políticas por tabla

#### `profiles`

- **SELECT**: cualquier usuario autenticado puede leer perfiles públicos
  (necesario para mostrar info del agente en property details, autor de
  mensajes, etc.). Admin lee todo.
- **UPDATE**: el dueño actualiza su propio profile. Admin puede actualizar
  cualquier profile (cambiar rol, suspender).
- **INSERT**: bloqueado para clientes — se inserta vía trigger desde
  `handle_new_user`.
- **DELETE**: solo admin.

```sql
alter table public.profiles enable row level security;

create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated using (true);

create policy "profiles_update_own_or_admin"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (
    (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()))
    or public.is_admin()
  );
-- Nota: el usuario no puede auto-asignarse rol distinto al actual.

create policy "profiles_delete_admin"
  on public.profiles for delete to authenticated using (public.is_admin());
```

#### `properties`

- **SELECT**: cualquier autenticado ve propiedades con `listing_status` =
  `'active'`, `'pending'`, `'sold'`, `'rented'`. El dueño ve también las
  suyas en `'draft'` o `'archived'`. Admin ve todo.
- **INSERT**: solo `agent` / `broker` / `admin`. El `owner_id` debe ser
  el del usuario actual (excepto admin).
- **UPDATE**: dueño o admin.
- **DELETE**: dueño o admin.

```sql
alter table public.properties enable row level security;

create policy "properties_select_public_or_own"
  on public.properties for select to authenticated using (
    listing_status in ('active', 'pending', 'sold', 'rented')
    or owner_id = auth.uid()
    or public.is_admin()
  );

create policy "properties_insert_agent"
  on public.properties for insert to authenticated with check (
    public.is_agent_or_above()
    and (owner_id = auth.uid() or public.is_admin())
  );

create policy "properties_update_own_or_admin"
  on public.properties for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

create policy "properties_delete_own_or_admin"
  on public.properties for delete to authenticated using (
    owner_id = auth.uid() or public.is_admin()
  );
```

#### `property_images`, `property_amenities`

- **SELECT**: si el usuario puede ver la propiedad padre, puede ver sus
  imágenes/amenities (subselect a properties con RLS aplicada).
- **INSERT/UPDATE/DELETE**: solo si controla la propiedad padre.

```sql
alter table public.property_images enable row level security;

create policy "property_images_select"
  on public.property_images for select to authenticated using (
    exists (select 1 from public.properties p where p.id = property_id) -- RLS de properties aplica al SELECT interno
  );

create policy "property_images_modify_owner"
  on public.property_images for all to authenticated
  using (
    exists (select 1 from public.properties p where p.id = property_id and (p.owner_id = auth.uid() or public.is_admin()))
  )
  with check (
    exists (select 1 from public.properties p where p.id = property_id and (p.owner_id = auth.uid() or public.is_admin()))
  );

-- mismas políticas para property_amenities
```

#### `favorites`

- **SELECT**: el dueño ve sus favoritos. Admin ve todo (analítica futura).
- **INSERT/DELETE**: solo el dueño.
- **UPDATE**: no aplica.

```sql
alter table public.favorites enable row level security;

create policy "favorites_select_own_or_admin"
  on public.favorites for select to authenticated using (
    user_id = auth.uid() or public.is_admin()
  );

create policy "favorites_insert_own"
  on public.favorites for insert to authenticated with check (user_id = auth.uid());

create policy "favorites_delete_own"
  on public.favorites for delete to authenticated using (user_id = auth.uid());
```

#### `visits`

- **SELECT**: el `user_id` ve sus visitas. El `agent_id` ve las visitas
  agendadas para él. Admin ve todo.
- **INSERT**: cualquier autenticado puede crear una visita donde él es
  `user_id`. `agent_id` debe coincidir con `properties.owner_id` (validado
  por trigger).
- **UPDATE**: user (reschedule, cancel), agent (confirm, complete), admin.
- **DELETE**: bloqueado — se prefiere status `cancelled` (auditoría).

```sql
alter table public.visits enable row level security;

create policy "visits_select_participant_or_admin"
  on public.visits for select to authenticated using (
    user_id = auth.uid() or agent_id = auth.uid() or public.is_admin()
  );

create policy "visits_insert_self"
  on public.visits for insert to authenticated with check (user_id = auth.uid());

create policy "visits_update_participant_or_admin"
  on public.visits for update to authenticated
  using (user_id = auth.uid() or agent_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or agent_id = auth.uid() or public.is_admin());

-- no delete policy → bloqueado por default deny
```

#### `conversations`, `messages`

- **SELECT**: solo participantes (`user_id`, `agent_id` de la conversation).
- **INSERT conversation**: el `user_id` arranca el chat. Admin puede crear.
- **INSERT message**: el `sender_id` debe ser participante de la conversation.
- **UPDATE**: solo `read_at` propio (marcar leído). Implementado via Server Action.
- **DELETE**: bloqueado.

```sql
alter table public.conversations enable row level security;

create policy "conversations_select_participant"
  on public.conversations for select to authenticated using (
    user_id = auth.uid() or agent_id = auth.uid() or public.is_admin()
  );

create policy "conversations_insert_self"
  on public.conversations for insert to authenticated with check (
    user_id = auth.uid() or public.is_admin()
  );

alter table public.messages enable row level security;

create policy "messages_select_participant"
  on public.messages for select to authenticated using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (c.user_id = auth.uid() or c.agent_id = auth.uid())
    )
    or public.is_admin()
  );

create policy "messages_insert_participant"
  on public.messages for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (c.user_id = auth.uid() or c.agent_id = auth.uid())
    )
  );
```

#### `notifications`

- **SELECT/UPDATE (marcar leída)**: solo el `recipient_id`.
- **INSERT**: solo desde server (Server Actions con service_role o
  triggers internos). Bloqueado para clientes.
- **DELETE**: solo el recipient, opcional.

```sql
alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications for select to authenticated using (
    recipient_id = auth.uid() or public.is_admin()
  );

create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy "notifications_delete_own"
  on public.notifications for delete to authenticated using (recipient_id = auth.uid());

-- INSERT no tiene política → bloqueado para clientes. Se inserta via Server Action con createServerClient + service_role o trigger.
```

---

## Storage

Dos buckets:

### `property-images` (público de lectura, restringido de escritura)

- **Acceso**: público (cualquiera puede leer URL del objeto sin autenticarse).
- **Path convention**: `properties/{property_id}/{uuid}.{ext}`.
- **Políticas**:
  - INSERT: solo el dueño de la propiedad o admin.
  - DELETE/UPDATE: solo el dueño de la propiedad o admin.

```sql
insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true);

create policy "property-images_insert_owner"
  on storage.objects for insert to authenticated with check (
    bucket_id = 'property-images'
    and (
      public.is_admin()
      or exists (
        select 1 from public.properties p
        where p.id::text = split_part(name, '/', 2)
          and p.owner_id = auth.uid()
      )
    )
  );

-- política análoga para UPDATE y DELETE
```

### `avatars` (público de lectura)

- **Acceso**: público.
- **Path convention**: `{user_id}/{uuid}.{ext}`.
- **Políticas**: solo el dueño puede subir/borrar su avatar.

```sql
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

create policy "avatars_insert_own"
  on storage.objects for insert to authenticated with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );
```

---

## Seed plan

**Objetivo**: poblar la DB con datos suficientes para que el sitio se
sienta "vivo" en desarrollo (10-12 propiedades, 4-5 usuarios de cada rol,
3-4 visitas, 2-3 conversaciones).

### Usuarios sintéticos

| Email                            | Nombre           | Rol      | Notas                                           |
| -------------------------------- | ---------------- | -------- | ----------------------------------------------- |
| `admin@luxe-estate.test`         | Elias Thorne     | `admin`  | Administrator de los mockups                    |
| `sarah@luxe-estate.test`         | Sarah Miller     | `broker` | Senior Broker de los mockups                    |
| `marcus@luxe-estate.test`        | Marcus Chen      | `agent`  | Agent de los mockups                            |
| `david@luxe-estate.test`         | David O'Conner   | `agent`  | Agent de los mockups                            |
| `sarah.jenkins@luxe-estate.test` | Sarah Jenkins    | `agent`  | Agente que aparece en Property Details/Schedule |
| `michael.ross@luxe-estate.test`  | Michael Ross     | `agent`  | Agente de "Lakeside Manor Viewing"              |
| `elena@luxe-estate.test`         | Elena Richardson | `user`   | Usuario del User Profile                        |
| `anna@luxe-estate.test`          | Anna Koval       | `user`   | Viewer/inactive (mapeado a user)                |

Password único para todos en seed: gestionado vía Supabase Auth API
(no se hardcodea en SQL). En migración, solo se crean los profiles
**asumiendo** que los auth.users existen. El seed creará los `auth.users`
mediante un script aparte si decidimos automatizarlo, o se hace manual
desde el dashboard de Supabase.

**Decisión a tomar**: ¿cómo creamos los auth.users seed?

- Opción A (recomendado): script Node `scripts/seed.ts` que use el
  service_role para llamar `auth.admin.createUser()`. Versionado y
  re-ejecutable.
- Opción B: manual desde el dashboard de Supabase. Más lento, no
  reproducible.

(Pregunto al final).

### Propiedades sintéticas

Datos tomados directamente de los mockups (textos, precios, ubicaciones):

| Título                  | Ciudad              | Tipo      | Listing | Precio    | Owner         |
| ----------------------- | ------------------- | --------- | ------- | --------- | ------------- |
| The Glass Pavilion      | Beverly Hills, CA   | villa     | sale    | 5,250,000 | sarah.jenkins |
| Azure Heights Penthouse | Downtown, Vancouver | penthouse | sale    | 3,800,000 | marcus        |
| Modern Family Home      | Seattle, WA         | house     | sale    | 850,000   | david         |
| Urban Loft              | Portland, OR        | apartment | rent    | 3,200     | sarah         |
| Highland Retreat        | Bend, OR            | house     | sale    | 620,000   | marcus        |
| Sea View Penthouse      | Miami, FL           | penthouse | rent    | 4,500     | david         |
| Modern Villa            | Palo Alto, CA       | villa     | sale    | 1,250,000 | sarah.jenkins |
| Modern Loft             | SoHo, New York      | apartment | sale    | 1,895,000 | marcus        |
| Forest Retreat          | Portland, OR        | house     | sale    | 3,100,000 | david         |
| The Nordic Villa        | Copenhagen          | villa     | sale    | 1,250,000 | sarah         |
| Sunset Apartments       | Miami, FL           | apartment | sale    | 850,000   | sarah         |
| Skyline Penthouse       | New York, NY        | penthouse | sale    | 4,500,000 | sarah         |

12 propiedades. Cada una con 1-4 imágenes (placeholder paths a Storage),
2-5 amenities, descripciones cortas.

### Favoritos, visitas, conversaciones

- `elena` favoritea 4 propiedades (las que aparecen en su Favorites screen).
- `elena` tiene 2 visitas próximas: "Skyline Penthouse" con sarah.jenkins,
  "Lakeside Manor" con michael.
- 1 conversación de elena con sarah.jenkins sobre "Modern Villa" (3-4 mensajes).

### Notificaciones

- 2-3 notificaciones unread para elena (visit reminder, new message, price drop).

---

## Plan de migraciones

Orden de aplicación (1 migración por archivo, cada una idempotente):

| #   | Nombre                       | Contenido                                                                    |
| --- | ---------------------------- | ---------------------------------------------------------------------------- |
| 001 | `enums_and_helpers`          | Enums + funciones helper (`current_user_role`, `is_admin`, `set_updated_at`) |
| 002 | `profiles`                   | Tabla + trigger `handle_new_user` + RLS                                      |
| 003 | `properties`                 | Tabla + índices + RLS                                                        |
| 004 | `property_images`            | Tabla + índices + RLS                                                        |
| 005 | `property_amenities`         | Enum amenity_key + tabla + RLS                                               |
| 006 | `favorites`                  | Tabla + RLS                                                                  |
| 007 | `visits`                     | Tabla + RLS                                                                  |
| 008 | `conversations_and_messages` | 2 tablas + trigger updates last_message_at + RLS                             |
| 009 | `notifications`              | Tabla + RLS                                                                  |
| 010 | `storage_buckets`            | Buckets + políticas Storage                                                  |

Las migraciones quedan en `supabase/migrations/` localmente como
referencia versionada, pero se aplican vía MCP (`apply_migration`).

---

## Lo que **NO** está en el MVP

Documentado para que quede claro y no caigamos en scope creep:

- **Pagos / mortgage real** (la card "Calculate Mortgage" es link a placeholder).
- **Documentos / contratos** (no hay pantalla).
- **Saved searches** (el filter muestra resultados pero no se persisten).
- **Reseñas / ratings de agente** (el "Top Rated Agent" es estático).
- **Audit log** de cambios de rol y acciones admin (queda para fase 2).
- **Soft delete**. Se usa `archived` status en lugar de borrar.
- **Internationalization** de datos (todo en es-ES neutro / inglés sin traducir
  para mock copy).
- **Multi-currency**, multi-region pricing.
- **Subscription / billing** del agente.
- **OAuth con Apple y Facebook**. Decidido en Fase 3: solo email/password +
  Google. Apple requiere developer account de pago, Facebook no aporta para
  el MVP. El login screen no debe renderizar botones para Apple/FB.

---

## Advisors conocidos (decisión de no cerrarlos)

Tras aplicar las 12 migraciones, `get_advisors(security)` reporta 2 warnings
que decidimos **dejar abiertos conscientemente**:

- `public_bucket_allows_listing` para `avatars` y `property-images`.
  El advisor considera "broad" cualquier policy que permita listar el bucket
  sin filtros por path. Para Luxe Estate eso es deseado: queremos que un
  usuario autenticado pueda listar imágenes de una propiedad pública.
  Los `storage_path` no son secretos (las URLs de los objetos ya son
  públicas vía `/storage/v1/object/public/...`). Si en el futuro
  guardamos archivos sensibles en estos buckets, revisar.

---

## Próximos pasos tras aprobación

1. Aplicar 10 migraciones vía `mcp__supabase__apply_migration`.
2. Correr `mcp__supabase__get_advisors(security)` para verificar
   ninguna tabla quedó sin RLS y políticas no rotas.
3. Decidir estrategia de seed (script vs manual).
4. Crear los `auth.users` seed (provider email/password con `admin.createUser`).
5. Insertar profiles, properties, etc. con `mcp__supabase__execute_sql`
   o un script.
6. Generar tipos TypeScript a `src/types/database.ts`.
7. Crear helpers en `src/lib/supabase/` (server.ts, client.ts, middleware.ts).
