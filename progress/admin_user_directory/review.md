# Review — feature admin_user_directory

**Veredicto:** APPROVED

## Resumen

Implementación alineada con el spec aprobado el 2026-05-26. Los 5 bloqueantes
explícitos del leader (C1-C4 + R2) se materializan correctamente en código,
las migraciones existen como archivos en el repo y coinciden con lo aplicado
en remoto (incluyendo la corrección 0022 para `search_path`). `./init.sh`
verde (deps + lint + type-check).

## Checklist de bloqueantes

- [x] **1 — Cero hex literales en JSX**: `grep -rEn '\[#[0-9a-fA-F]'` en
      `src/app/(admin)/users`, `src/components/admin`, `src/lib/admin` y
      `src/lib/supabase/admin.ts` no devuelve nada. Solo aparecen `text-[10px]`
      (tamaño, no color) que el spec §11 documenta.
- [x] **2 — Server vs Client correcto**: `page.tsx`, `loading.tsx`,
      `UserDirectoryTabs`, `UserDirectoryRow`, `UserStatusIndicator`,
      `UserRoleBadge`, `UserDirectoryEmptyState` son Server. `'use client'`
      aparece solo en `error.tsx` (obligado por Next), `UserDirectorySearch`,
      `ChangeRoleMenu`, `ChangeRoleConfirmDialog`, `InviteUserButton`,
      `InviteUserDialog` — todos con interactividad real justificada.
- [x] **3 — `await searchParams`** en `page.tsx:58`. No se usan
      `params`/`cookies()`/`headers()` directos.
- [x] **4 — `src/lib/supabase/admin.ts` lleva `import 'server-only'`**
      como primera línea (`admin.ts:1`).
- [x] **5 — `/admin` en `protectedPaths`**: `src/lib/supabase/proxy.ts:60`
      ya lo cubre.
- [x] **6 — Self-protection server-side**: `actions.ts:102-107` (changeRole),
      `actions.ts:154-159` (suspendUser), `actions.ts:221-229` (reactivateUser).
- [x] **7 — Doble check admin server-side**: `requireAdminCaller`
      (`actions.ts:55-86`) hace `getUser()` + lookup de `profiles.role`.
      Invocado en las 4 actions (changeRole, suspendUser, reactivateUser,
      inviteUser).
- [x] **8 — Migraciones SQL en repo**: 0020, 0021, 0022 existen en
      `supabase/migrations/` y el contenido coincide con lo aplicado en
      remoto. 0022 añade `set search_path = public` al trigger
      `properties_sync_sold_at` (fix del WARN del advisor).
- [x] **9 — Acceptance del feature_list.json cumplido** (detalle abajo).
- [x] **10 — Revoke de sesión al suspender (R2)**: `actions.ts:194-204`
      llama `admin.auth.admin.signOut(targetUserId, 'global')` envuelto en
      try/catch; si falla loguea pero el suspend lógico queda aplicado.
- [x] **11 — Invite con rol (C1)**: `actions.ts:357-365` hace UPDATE
      `profiles.role` con cliente service_role tras `inviteUserByEmail`
      cuando `initialRole !== 'user'`. Coincide con spec §8b Opción A.
- [x] **12 — Highlight fila del caller (C3)**: `UserDirectoryRow.tsx:35-38`
      aplica `bg-surface-soft` cuando `user.id === callerId`, sin hover
      override. `UserDirectoryRow.tsx:89-100` renderiza `Button disabled
aria-disabled="true" title="No puedes cambiar tu propio rol"` en lugar
      del menú.
- [x] **13 — Tabs C2 = Todos / Usuarios / Agentes / Admins**:
      `UserDirectoryTabs.tsx:15-20`. Sin Brokers.
- [x] **14 — Implementer NO marcó `done`**: `feature_list.json:296` está
      en `in_progress`.

## Acceptance del feature_list.json — verificación ítem por ítem

- [x] `src/app/(admin)/users/page.tsx` Server Component
- [x] Guard estricto role=admin (cualquier otro → 404)
- [x] Tabla con search (?q=) y filtro de role (?role=)
- [x] Search: ilike name/email, case-insensitive (`queries.ts:100-103`)
- [x] Performance columns: count por owner + sales YTD (sold) con `—`
      para users (`queries.ts:113-168`, `UserDirectoryRow.tsx:72-87`)
- [x] Change Role dropdown: 3 roles + Suspend/Reactivate. Las "4 opciones"
      del acceptance original cuentan con Viewer, que la decisión C2 (cerrada
      por el humano) descartó. La spec aprobada manda.
- [x] Server Action changeRole: zod + UPDATE + notification (vía trigger 0020)
- [x] Self-protection UI + server (`UserDirectoryRow.tsx` + `actions.ts`)
- [x] Pagination 20 por página (`page.tsx:21`)
- [x] Status indicator: placeholder is_active → verde/gris (spec §7
      acepta esto como MVP; "away" diferido)

## Migraciones

Las 3 migraciones (0020, 0021, 0022) existen como archivos y matchean lo
aplicado:

- **0020** — trigger `notify_profile_role_or_status_change` AFTER UPDATE
  sobre `profiles`. SECURITY DEFINER + `search_path = public`. Patrón
  consistente con 0017/0018.
- **0021** — `properties.sold_at` + index parcial + trigger
  `properties_sync_sold_at` BEFORE UPDATE + backfill desde `updated_at`.
- **0022** — fix correctivo: agrega `set search_path = public` al cuerpo
  de `properties_sync_sold_at` para silenciar el WARN
  `function_search_path_mutable` del advisor.

`src/types/database.ts` regenerado vía MCP (línea 7 documenta fecha + mig
de origen). Verificado: 1085 líneas de diff vs HEAD, incluye `sold_at` y
los nuevos triggers/funciones.

## NITs (no bloqueantes)

1. **`page.tsx:97-100`** — el spec §4 sugiere que en mobile el botón
   "Invitar usuario" puede ir arriba del search, no a la derecha. El
   layout actual coloca `<UserDirectorySearch>` antes que
   `<InviteUserButton>` en el flex-col mobile, lo cual invierte el orden
   sugerido por el mockup (CTA primario primero). No afecta funcionalidad
   y la decisión de orden quedó flexible en el spec; vale la pena revisar
   visualmente si se cambia más adelante.

2. **`UserStatusIndicator.tsx:17-22`** — el ternario
   `isActive ? 'text-muted' : 'text-muted'` siempre devuelve la misma
   clase. Probablemente sobra el ternario en ese span outer; el color
   diferenciado está en el `<Icon>`. Cosmético.

3. **`actions.ts:309`** — el cast `caller.result.error.code as
InviteUserErrorCode` funciona porque `'unauthenticated' | 'forbidden'`
   están en ambos union, pero queda implícito. Un `if (code ===
'unauthenticated' || code === 'forbidden')` haría el invariante
   explícito y a prueba de futuros cambios en `ActionErrorCode`.

4. **`actions.ts:222-229`** — el self-protection en `reactivateUser` es
   defensivo (el caller suspendido no podría llegar acá porque ya estaría
   redirigido por el guard de layout). El comentario lo dice; aceptable
   por simetría.

5. **`InviteUserDialog.tsx:204-220`** — el `<select>` usa estilos custom
   inline en vez del primitivo `<Input>` o un componente `<Select>`.
   No hay primitivo `<Select>` en `src/components/ui`, así que es
   razonable; cuando se agregue uno, vale la pena migrar.

6. **`queries.ts:102`** — la concatenación `or(`full_name.ilike.%${safe}%,...)`queda legible, pero conviene recordar que`escapeIlike`no escapa
comas dentro del término (PostgREST`.or()`usa comas como separador).
Si alguien busca`"Doe, John"`, podría romper. NIT defensivo.

7. **Advisor WARN nuevos del SECURITY DEFINER de
   `notify_profile_role_or_status_change`**: documentado por el leader
   como aceptable (mismo patrón que `notify_*` existentes).

## Riesgos que el leader debería re-verificar manualmente

1. **Smoke test E2E del invite flow**: la action solo verifica que
   `inviteData?.user?.id` exista. La aceptación real depende de que el
   email plantilla de Supabase Auth esté configurado en español (el spec
   §8b lo señala como no bloqueante para mergear, pero merece confirmación).
2. **Smoke test del suspend con dos navegadores**: comprobar que el
   target con sesión abierta queda desconectado tras
   `admin.auth.admin.signOut(targetId, 'global')`.
3. **Confirmar que `SUPABASE_SERVICE_ROLE_KEY` está rellenada en
   `.env.local`** del entorno de prueba — sin ella, `inviteUser` y
   `suspendUser` lanzan `throw new Error(...)` en el primer uso.
