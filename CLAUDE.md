# CLAUDE.md — Guía para agentes de IA en el proyecto AYR Steel ERP

> Este archivo le dice a Claude Code (o cualquier agente) **cómo trabajar en este repo sin romper la integridad transaccional, la seguridad ni las convenciones de dominio**. Léelo antes de cualquier cambio.

---

## 1. Contexto del producto

ERP privado de una empresa siderúrgica que opera **5 líneas de negocio** sobre la misma materia prima: **bobinas de acero**. Cada línea tiene un modelo de producción distinto (slitter para drywall, conformado para tubería, roladora para cobertura, etc.).

- **Estado actual:** línea de drywall (Parantes, Rieles, Omega) en producción.
- **Roadmap:** incorporar las otras 4 líneas como módulos independientes dentro del mismo monorepo.
- **Usuarios:** Operario (planta), Supervisor, Comercial, Admin, Gerencia.

---

## 2. Stack y comandos

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 |
| Backend | Firebase (Auth, Firestore, Storage, Functions) |
| Búsqueda | Algolia (índices: coils, customers, contacts, sales, production_logs) |
| UI/UX | lucide-react, react-hot-toast, nextjs-toploader, recharts |
| Datos | xlsx, react-to-print |

```bash
npm run dev          # Frontend en :3000
npm run emulators    # Firebase emulator suite
npm run emulate      # Ambos a la vez (recomendado en dev)
npm run build        # Build de producción
npm run lint         # ESLint
```

> ⚠️ Antes de modificar nada, lee `src/types/index.ts` y `src/services/productionService.ts` para entender el modelo de dominio.

---

## 3. Estructura objetivo (en migración)

```
src/
├── core/           # Auth, CRM, Kardex, Audit, Settings, Dashboard, Reports framework
├── domain/         # Lógica pura: pricing, steel formulas, Result<T,E>
├── modules/        # Una carpeta por línea de negocio
│   ├── drywall/    # ✅ Activa
│   ├── tubing/     # 🚧
│   ├── roofing/    # 🚧
│   ├── decking/    # 🚧
│   └── wholesale/  # 🚧
├── app/            # Next.js App Router (rutas + APIs)
├── lib/            # Adaptadores: firebase, algolia, sunat
└── types/          # Solo tipos verdaderamente globales
```

**Antes de crear archivos nuevos:** ubica si pertenecen a `core/`, `domain/` o a un módulo de línea de negocio. Nunca pongas lógica de drywall en `core/`.

---

## 4. Reglas no negociables

### 🔴 Integridad transaccional
- **Todo cambio que afecte stock, kardex, ventas o producción DEBE ir dentro de `runTransaction`.**
- Patrón obligatorio dentro de la transacción: **PRIMERO todas las lecturas (`transaction.get`), DESPUÉS todas las escrituras**. Firestore aborta si se mezcla.
- Si una operación toca >1 documento, usa transacción o `writeBatch`. Nunca `Promise.all` con `updateDoc` sueltos.
- Después de cada operación sensible, escribe un `audit_logs` doc en la misma transacción.

### 🔴 Seguridad
- **NUNCA hagas más permisivas las `firestore.rules` o `storage.rules` "para que pase".**
- Si una operación falla por reglas, el camino es: añadir custom claim, validar payload en reglas, o mover a Cloud Function. **No** abrir el match.
- **Secretos jamás en `settings/general_settings`**. Solo en variables de entorno o en Secret Manager. La Algolia *search key* es la única excepción (es pública por diseño).
- Toda ruta `/admin/*` debe pasar por `AuthGuard` Y por `middleware.ts` (server-side).

### 🔴 Tipado
- **No introduzcas `any` nuevos.** Si necesitas tipar algo dinámico, usa `unknown` + guard, o define un tipo.
- Si tocas un archivo que ya tiene `any`s, intenta eliminar al menos uno de paso ("regla del campamento").
- `cursorDoc?: any` está pendiente de migrar a `QueryDocumentSnapshot<DocumentData>`.

### 🔴 RBAC
- Permisos viven en `ROUTE_PERMISSIONS` (`src/app/admin/layout.tsx`) **y** en `firestore.rules`. Si solo actualizas uno, dejaste un hueco.
- Roles válidos: `ADMIN`, `SUPERVISOR`, `OPERATOR`. No inventes nuevos sin actualizar `AuthContext` y reglas.

### 🟠 Servicios
- Cada módulo de dominio tiene un servicio único (`*Service.ts`). No mezcles dominios.
- Funciones del servicio deben:
  - Recibir tipos explícitos (no `any`).
  - Devolver `Promise<Result>` o lanzar `Error` con mensaje legible **en español** (los toasts lo muestran al usuario).
  - Loguear errores con `console.error` con contexto suficiente para debug.

### 🟠 Componentes
- Si un archivo `page.tsx` supera ~400 líneas, extraer subcomponentes a `components/<dominio>/`.
- Hooks de fetching van en `hooks/` (a crear), no inline en cada page.
- Tailwind: usa `clsx` o `cva` cuando las clases superen 5 condicionales.

---

## 5. Glosario de dominio (úsalo en código)

| Término | Significado | En código |
|---|---|---|
| **Bobina madre** | Rollo de acero como llega del proveedor | `Coil` |
| **Fleje** | Tira longitudinal cortada de la bobina por el slitter | `PlannedStrip` |
| **Plan de corte** | Distribución de flejes a sacar de una bobina | `plannedStrips[]` |
| **Slitter** | Máquina que corta longitudinalmente | (fase 1 producción) |
| **Conformadora** | Máquina que da forma a cada fleje (perfil C, U, etc.) | (fase 2 producción) |
| **Scrap** | Sobrante no utilizable | `scrapWidth` |
| **Kardex** | Libro de movimientos de inventario | colección `kardex_movements` |
| **Parante / Riel / Omega** | Productos drywall | SKUs P38, P64, P89, R39, R65, R90, OMG |
| **Yield / Rendimiento** | % de ancho usado vs ancho total | fórmula en `reportsService` |

**Convención de idioma:**
- **UI y mensajes de error → español** (es-PE).
- **Identificadores, tipos, funciones y comentarios técnicos → inglés.**
- Si encuentras código mezclado, ese es legacy; corrígelo si te toca el archivo.

---

## 6. Fórmulas críticas (no modificar sin aprobación de dominio)

```ts
// Densidad siderúrgica — número máximo de piezas
const totalMeters = weightKg / (thicknessMm * widthMm * (7.85 / 1000));
const expectedPieces = Math.floor(totalMeters / pieceLengthM);
const maxAllowedPieces = Math.ceil(expectedPieces * 1.05); // 5% tolerancia

// Costo efectivo por mm — si sobra ≤ 40mm, se reparte solo sobre lo planificado
const effectiveCostPerMm = (leftoverWidth <= 40 && leftoverWidth > 0)
  ? totalCoilCost / totalPlannedWidth
  : totalCoilCost / coil.masterWidth;

// Promedio ponderado al ingresar producción al kardex
newAverageCost = ((currentQty * currentAverageCost) + costOfBatch) / (currentQty + newPieces);
```

Las constantes (`7.85`, `1.05`, `40`, `0.85` para scrap-kg) deben vivir en `src/domain/steel/constants.ts`, no hardcoded en services.

---

## 7. Convenciones SCRUM en el repo

- Branches: `feature/US-XXX-descripcion-corta`, `bugfix/BUG-XXX-...`, `refactor/...`, `chore/...`
- Commits: Conventional Commits en español o inglés, pero consistente por commit.  
  `feat(drywall): agrega validación de espesor en plan de corte`
- PRs: enlazar la historia de usuario (`Closes US-024`).
- Antes de mergear: lint OK, build OK, tests OK (cuando existan), screenshots si hubo cambios visuales.

---

## 8. Trampas conocidas

1. **Firestore no permite combinar `where("status", "in", [...])` con filtros de rango (fechas).** Ya hay workaround en `inventoryService.fetchInventory` — no lo "limpies" sin entender por qué está así.
2. **Algolia trae IDs pero los datos pueden estar desactualizados.** Por eso siempre hidratamos con un `getDocs` adicional contra Firestore. No "optimices" eliminándolo.
3. **`metadata.invoiceDate`** está dentro de un mapa: para indexarlo requiere índice compuesto declarado en `firestore.indexes.json`.
4. **`runTransaction` reintenta automáticamente** si hay conflicto. No metas efectos secundarios no idempotentes dentro (ej: enviar email, llamar API externa). Si lo necesitas, dispáralos *después* del commit con `.then()`.
5. **Cloud Functions están vacías hoy.** Tareas como numeración correlativa de ventas y triggers de auditoría deberían migrar allí; mientras tanto, viven en el cliente y dependen de las reglas de Firestore.
6. **`storage.rules` expira el 30/01/2026.** Si lees esto después de esa fecha y Storage no funciona, ese es el problema.
7. **`patch-sales` y `migrate-kardex` son páginas de migración one-off.** No las invoques en datos productivos sin entender qué hacen — leen y reescriben colecciones enteras.

---

## 9. Cuándo pedir confirmación humana

Detente y pregunta antes de:
- Modificar `firestore.rules` o `storage.rules`.
- Cambiar constantes físicas (densidad, tolerancias, factores de scrap).
- Borrar o renombrar colecciones de Firestore.
- Ejecutar `resetDatabaseDevOnly` o cualquier script de `seed*`.
- Cambiar el contrato de `BusinessLineModule` (impacta a todas las líneas).
- Tocar la transacción de `processSale` o `processSingleStrip` (zona caliente).

---

## 10. Roadmap modular (orden sugerido de implementación)

1. ✅ Línea drywall (actual) — refactor a `modules/drywall/`
2. Endurecer `core/` (rules, functions, claims, tests)
3. Línea 2 (a definir con cliente) usando el template de drywall
4. Línea 3, 4, 5 (una por sprint mayor)
5. Selector de línea de negocio en sidebar + dashboard consolidado

---

## 11. Antes de cerrar tu turno

Verifica:
- [ ] ¿Toqué transacciones? → ¿Lecturas antes que escrituras?
- [ ] ¿Toqué seguridad? → ¿Reglas + RBAC + middleware alineados?
- [ ] ¿Introduje `any`? → Quítalo o justifícalo en el PR.
- [ ] ¿Funciona en el emulator (`npm run emulate`) antes de probar en prod?
- [ ] ¿Hay audit log para la operación sensible que agregué?
- [ ] ¿Los textos de error son en español y útiles para el usuario final?
- [ ] ¿El archivo que toqué quedó más pequeño/limpio que como lo encontré?
