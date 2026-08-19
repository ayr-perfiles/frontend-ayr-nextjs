# MÓDULO: sidebar (menú lateral) — verdad de arquitectura
> ÚLTIMA VERIFICACIÓN CÓDIGO+PROD: 2026-08-19 (swap a acordeón m2, commit `9f080f8a`, runtime validado en prod `ayr.mareliac.pe`).
> ⚠️ SE PUDRE. Antes de tocar el sidebar: verificá (checklist). No confíes si la fecha está vieja.

## 1. Componente
- `src/components/layout/Sidebar.tsx` — reemplaza al viejo `sidebar.tsx` (borrado en el swap m2, v6.49.0).
- **DATA-DRIVEN:** `NAV_GROUPS: NavEntry[]` (exportado, línea ~80) arma el árbol de navegación. Diferencia real vs el viejo `sidebar.tsx`, que era JSX hardcodeado ítem-por-ítem (esa deuda histórica, documentada en HANDOFF.md desde #9-A, queda obsoleta para este archivo). `navItems.ts` sigue siendo módulo muerto aparte, sin relación con `NAV_GROUPS`.
- Filtrado de grupos visibles por rol: helper puro `filterGroupsByRole(NAV_GROUPS, role)` (mismo archivo, testeado aislado).

## 2. Estado del acordeón (`sidebarAccordion.ts`)
- `src/components/layout/sidebarAccordion.ts`: `nextOpenGroup` / `resolveInitialOpenGroup` / `shouldShowGroupItems`. Puro, reusado 1:1 del sidebar viejo (v6.48.5) — el swap m2 NO tocó esta lógica, solo la piel visual.
- Acordeón EXCLUSIVO a nivel de grupo top (abrir uno cierra el anterior). `openGroup` sincronizado a la ruta activa vía `useEffect([pathname])`.
- `LineGroup`/`openLines` (acordeón de líneas de negocio dentro de un grupo) es un mecanismo SEPARADO, NO-exclusivo — no conflar con el acordeón de grupos.

## 3. Ancho y breakpoints
- **260px expandido / 72px icon-rail.** El proto de diseño m2 original medía 272px — se preservó 260px por contrato con el wrapper `AdminShell` (que tiene su propio cálculo de ancho). Deuda de duplicación de fuente de verdad del ancho entre `AdminShell.tsx` y `Sidebar.tsx`, ver CLAUDE.md backlog.
- `AdminShell` es la única fuente del estado de colapso (`collapsed: boolean`, controlado); persiste en `localStorage` clave `ayr-sidebar-collapsed`.
- md (768-1023px): icon-rail persistente, sin toggle a expandido salvo overlay. Popover flotante en click de ícono de grupo, patrón local `absolute left-full` (sin Radix/portal) — validado que NO clippea contra el wrapper de `AdminShell`.
- sm (<768px): sidebar oculto, botón Menú abre overlay full-width con backdrop, auto-cierra en cambio de `pathname`.

## 4. Badge live (Cola de producción)
- `getProductionQueueCount` + su `useEffect` portados 1:1 del sidebar viejo — mismo comportamiento, mismo gate (ADMIN/SUPERVISOR lo ven).

## 5. Historia
- v6.47.1: fix "Cotizaciones" descomentado (el link existía, estaba dentro de un `{/* ... */}`).
- v6.48.5: acordeón exclusivo introducido (`sidebarAccordion.ts`), sobre el `sidebar.tsx` viejo (JSX hardcodeado).
- v6.49.0: swap completo a `Sidebar.tsx` (data-driven, piel m2 panel-hundido). Validado antes en preview standalone (`/sidebar-preview`, rama `feat/sidebar-accordion-preview`, NUNCA mergeada — descartada tras validar diseño). `sidebar.test.ts` (shadow test sin imports reales) borrado junto con `sidebar.tsx`; `Sidebar.test.ts` nuevo con cobertura real (20/20: 13 de `sidebarAccordion` + 7 de `filterGroupsByRole`).

## 6. VERIFICAR antes de cambio grande
- ¿El ítem/grupo que vas a tocar vive en `NAV_GROUPS` (`Sidebar.tsx`)? `navItems.ts` sigue muerto, no editar ahí.
- Popover colapsado: probar en md (768-1023px) que no clippee contra `AdminShell`.
- Ancho: si tocás `AdminShell.tsx` o `Sidebar.tsx`, verificar que 260px siga sincronizado entre ambos (deuda de duplicación viva).
