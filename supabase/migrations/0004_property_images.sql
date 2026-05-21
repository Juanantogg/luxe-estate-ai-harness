-- 0004_property_images.sql
-- Galería de imágenes por propiedad. Solo storage path; el contenido vive
-- en Storage bucket property-images (migración 0010).

create table if not exists public.property_images (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references public.properties(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  position smallint not null default 0,
  is_main boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists property_images_property_idx
  on public.property_images(property_id, position);

-- Solo una imagen "main" por propiedad.
create unique index if not exists property_images_one_main_idx
  on public.property_images(property_id) where is_main = true;

alter table public.property_images enable row level security;

-- SELECT: dejamos pasar; el JOIN con properties aplicará su propia RLS
-- al hacer queries que crucen. Para listados directos, asumimos que
-- cualquier autenticado puede ver paths (no son datos sensibles).
drop policy if exists "property_images_select" on public.property_images;
create policy "property_images_select"
  on public.property_images for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE: solo si controla la propiedad padre.
drop policy if exists "property_images_modify_owner_or_admin" on public.property_images;
create policy "property_images_modify_owner_or_admin"
  on public.property_images for all
  to authenticated
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );
