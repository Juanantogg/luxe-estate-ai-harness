# home_hero_visual_polish — Implementación

## Descripción

Smoke test 2026-05-26 detectó 2 inconsistencias visuales en la home pública. (A) En `HeroSearch` el botón submit usaba `rounded` (radio default 0.25rem) sobre un input con `rounded-xl`, quedando visualmente discordante: se subió el botón a `rounded-lg` (más cercano al xl del input, no idéntico para preservar jerarquía visual). (B) Los dos pill groups de la home (`ListingTypeToggle` y, vía el primitivo `Chip`, `PropertyTypeChips`) usaban `bg-surface-inverse text-on-surface-inverse` (negro Nordic) para el estado activo, lo cual rompía la convención del sistema donde las acciones primarias usan `bg-primary` (mosque). Se migraron ambos a `bg-primary text-on-primary`. El cambio del primitivo `Chip` se hizo modificando la variant `selected` directamente — no se introdujo una variant nueva — porque el sistema solo tiene una "convención de selección" y se quiere mantener una única fuente de verdad.

## Diffs aplicados

### 1. `src/components/home/HeroSearch.tsx` (línea 30)

```diff
       <button
         type="submit"
         aria-label="Buscar"
-        className="absolute top-1/2 right-2 inline-flex h-10 -translate-y-1/2 items-center justify-center rounded bg-primary px-4 text-sm font-medium text-on-primary shadow-soft transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
+        className="absolute top-1/2 right-2 inline-flex h-10 -translate-y-1/2 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-on-primary shadow-soft transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
       >
         Buscar
       </button>
```

### 2. `src/components/ui/Chip.tsx` (línea 20, variant `selected`)

```diff
 const VARIANT_CLASSES: Record<ChipVariant, string> = {
   default:
     'bg-surface border border-divider-soft text-muted hover:text-on-surface hover:border-primary',
-  selected: 'bg-surface-inverse text-on-surface-inverse shadow-soft border border-transparent',
+  selected: 'bg-primary text-on-primary shadow-soft border border-transparent',
   outline:
     'bg-transparent border border-outline text-on-surface hover:bg-primary-soft hover:border-primary hover:text-primary',
 };
```

### 3. `src/components/property/ListingTypeToggle.tsx` (línea 60)

```diff
             className={cn(
               'rounded px-4 py-1.5 text-sm font-medium transition-colors',
               'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
               isActive
-                ? 'bg-surface-inverse text-on-surface-inverse shadow-soft'
+                ? 'bg-primary text-on-primary shadow-soft'
                 : 'text-muted hover:text-on-surface',
             )}
```

## Blast radius del cambio en el primitivo `Chip`

La variant `selected` de `src/components/ui/Chip.tsx` se consume en sólo 2 lugares (validado vía grep antes del cambio):

1. **`src/components/home/PropertyTypeChips.tsx:56`** — chip activo del filtro de tipo de propiedad en la home. Cambio deseado (target de esta feature): pasa a mosque, consistente con `ListingTypeToggle`.
2. **`src/app/dev/ui/page.tsx:210`** — showcase de `/dev/ui`, donde se renderiza el primer chip como `selected` para ilustrar la variant. Consecuencia visual: el chip de muestra pasa de negro Nordic a mosque verde. Es el comportamiento correcto, ya que el showcase es un espejo del sistema real (no documentación independiente).

No hay otros call sites de `variant="selected"`. La lógica de routing del `ListingTypeToggle` (`router.replace({ scroll: false })`) no se tocó.

## Verificación

- `pnpm lint` OK
- `pnpm type-check` OK
- `./init.sh` (rápido) OK
- Cero hex literales nuevos: solo tokens existentes (`bg-primary`, `text-on-primary`, `rounded-lg`).
