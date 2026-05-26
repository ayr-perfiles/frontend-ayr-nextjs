# 🎯 ROADMAP EJECUTABLE — Sprint 0, 1, 2

**Última actualización:** 2025-05-26  
**Horizonte:** ~6 semanas  
**Objetivo:** Base sólida + Drywall modularizado + Template para línea 2

---

## 📋 Sprint 0 (Semanas 1-2) — ESTABILIZAR BASE

**🎯 Objetivo:** Cerrar huecos críticos de seguridad y preparar estructura modular

### 🔴 Crítico (MUST-DO)

#### 1. Reescribir firestore.rules con RBAC real
**Problema:** Hoy cualquier usuario autenticado puede leer/escribir toda la BD  
**Solución:** Custom claims + validación de payloads  

**Comando Claude Code:**
```bash
claude-code task "Reescribe firestore.rules implementando RBAC con custom claims.
Reglas:
- users/{uid}: solo owner write
- coils: ADMIN/SUPERVISOR create/edit/void
- sales: ADMIN todo, SUPERVISOR cotizar
- production_logs: ADMIN/SUPERVISOR void, OPERATOR create
- inventory_stock, kardex_movements: read-only autenticados
- settings, products: solo ADMIN
- audit_logs: read ADMIN
Añade validación de payloads (ej: coil.initialWeight > 0, status válido)
"
```

**Entregables:**
- [ ] `firestore.rules` actualizado
- [ ] Test manual con emulator
- [ ] Deploy a staging y validar que no rompe nada
- [ ] Doc: ADR-003-rbac-con-custom-claims.md

**Responsable:** Dev Backend  
**Tiempo estimado:** 3-4 horas  
**Bloqueante:** Deploy a prod requiere configurar custom claims en Auth

---

#### 2. Migrar storage.rules antes de expiration date
**Problema:** Rules expiran el 30/01/2026  
**Solución:** Rules reales por path de storage

**Comando Claude Code:**
```bash
claude-code task "Reescribe storage.rules con paths específicos.
Estructura:
- /invoices/{companyId}/{invoiceId} → solo ADMIN read
- /temp-uploads/{userId}/{filename} → owner read/write, auto-delete después 24h
- /public/ → read all autenticados
Elimina la regla temporal que expira."
```

**Entregables:**
- [ ] `storage.rules` actualizado
- [ ] Test con upload/download
- [ ] Deploy

**Responsable:** Dev Backend  
**Tiempo estimado:** 1-2 horas

---

#### 3. Crear Cloud Functions mínimas
**Problema:** nextSaleNumber y audit logs corren en cliente  
**Solución:** Funciones server-side seguras

**Archivo:** `functions/src/index.ts`

```typescript
// functions/src/index.ts
import { onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({ maxInstances: 10, region: "us-central1" });

// Obtener siguiente número de venta (secuencial seguro)
export const getNextSaleNumber = onCall(async (request) => {
  // Solo ADMIN puede llamar
  if (request.auth?.token.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  
  // Usar Firestore transaction para incrementar y devolver
  // ...
});

// Trigger: audit log en cada documento importante
export const onSaleCreated = onDocumentCreated("sales/{saleId}", async (event) => {
  // Escribir a audit_logs automáticamente
});
```

**Entregables:**
- [ ] `getNextSaleNumber` function
- [ ] Triggers de audit para `sales`, `coils`, `production_logs`
- [ ] Deploy de functions
- [ ] Actualizar frontend para llamar a la function

**Responsable:** Dev Backend  
**Tiempo estimado:** 4-6 horas

---

#### 4. Setup de testing (vitest)
**Problema:** Cero tests, refactors arriesgados  
**Solución:** Vitest + coverage

**Ya está listo:**
- ✅ `vitest.config.ts` (adjunto)
- ✅ `src/test/setup.ts` (adjunto)
- ✅ `calculations.test.ts` ejemplo (adjunto)

**Comando:**
```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
```

**Actualizar `package.json`:**
```json
"scripts": {
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest run --coverage"
}
```

**Entregables:**
- [ ] Instalar dependencias
- [ ] Copiar configs adjuntos
- [ ] Correr `npm run test` → debe pasar el test de densidad
- [ ] Integrar en CI (GitHub Actions)

**Responsable:** Dev Frontend  
**Tiempo estimado:** 2 horas

---

#### 5. Centralizar constantes en domain/steel/
**Problema:** Magic numbers dispersos (7.85, 1.05, 40, 0.85...)  
**Solución:** `domain/steel/constants.ts` (adjunto)

**Comando Claude Code:**
```bash
claude-code task "Reemplaza todos los magic numbers en src/services/ con las constantes de domain/steel/constants.ts.
Específicamente:
- 7.85 → STEEL_DENSITY_G_CM3
- 1.05 → PRODUCTION_TOLERANCE_FACTOR
- 40 → LEFTOVER_THRESHOLD_MM
- 0.85 → SCRAP_WEIGHT_FACTOR_KG_MM
- 3.0 → DEFAULT_PIECE_LENGTH_M
- 0.18 → IGV_RATE_PERU
Encuentra y reemplaza todas las ocurrencias."
```

**Entregables:**
- [ ] Archivo `constants.ts` creado
- [ ] Todos los services actualizados
- [ ] Tests pasan

**Responsable:** Dev Backend  
**Tiempo estimado:** 2 horas

---

#### 6. Crear estructura modular base
**Estructura objetivo:**
```
src/
├── core/           (crear vacío por ahora)
├── domain/
│   └── steel/
│       └── constants.ts  ✅ (de tarea 5)
├── modules/
│   └── drywall/    (crear vacío, llenarlo en Sprint 1)
```

**Comando:**
```bash
mkdir -p src/core src/domain/steel src/modules/drywall
```

**Entregables:**
- [ ] Carpetas creadas
- [ ] README.md en cada una explicando qué va ahí

**Responsable:** Tech Lead  
**Tiempo estimado:** 30 min

---

### 🟡 Importante (SHOULD-DO)

#### 7. Actualizar package.json (dependencias)
```bash
npm install -D @types/node@latest typescript@latest
npm audit fix
```

#### 8. Crear .cursorrules y CLAUDE.md
**Ya listos** (adjuntos)  
Solo copiar a raíz del proyecto.

---

### Definition of Done para Sprint 0
- [ ] CI pasa (lint + typecheck + test + build)
- [ ] Firestore rules probadas en emulator y staging
- [ ] Cloud Functions deployed
- [ ] Tests de densidad pasando
- [ ] Magic numbers eliminados
- [ ] Estructura `core/`, `domain/`, `modules/` creada
- [ ] Retrospective documentada

---

## 📋 Sprint 1 (Semanas 3-4) — REFACTOR DRYWALL

**🎯 Objetivo:** Drywall como módulo ejemplar con tests y dominio puro

### Tareas Sprint 1

#### 1. Migrar código a modules/drywall/
**Comando Claude Code:**
```bash
claude-code task "Mueve todo el código de drywall a src/modules/drywall/ sin cambiar lógica.
Estructura:
modules/drywall/
  components/     (de src/components/forms, src/components/production, src/components/inventory)
  services/       (productionService, cuttingPlanService)
  domain/         (crear vacío por ahora, será para lógica pura)
  types.ts        (CoilStatus, PlannedStrip, ProductionLog específicos)
  routes/         (los pages de /admin/inventory, /admin/production, /admin/operator)
Actualiza todos los imports. NO cambies la lógica."
```

**Estimado:** 4-6 horas

---

#### 2. Extraer dominio puro (sin Firebase)
**Objetivo:** Lógica testeable sin necesidad de mockear Firestore

Crear en `modules/drywall/domain/`:
- `slitter.ts` — reglas del plan de corte
- `costing.ts` — cálculo de costo por mm, por fleje, promedio ponderado
- `validation.ts` — validaciones físicas (ancho, espesor, peso)

**Comandos:**
```bash
claude-code task "Extrae la lógica pura de productionService.ts a domain/.
- Cálculo de effectiveCostPerMm → costing.ts
- Validación de ancho total vs bobina → validation.ts
- Lógica de leftover y reparto de costo → slitter.ts
Deben ser funciones puras: in/out, sin Firebase, sin side effects."
```

**Tests:** Cada archivo de dominio con su `.test.ts`

**Estimado:** 6-8 horas

---

#### 3. Eliminar 20+ any's de drywall
**Comando:**
```bash
claude-code task "Busca todos los 'any' en modules/drywall/ y reemplaza con tipos explícitos.
Prioritarios:
- cursorDoc?: any → QueryDocumentSnapshot<DocumentData>
- updates: any en updateCoil
- Parámetros de funciones en services
Deja comentario // TODO si el tipo es muy complejo."
```

**Estimado:** 3-4 horas

---

#### 4. Crear custom hooks
```typescript
// modules/drywall/hooks/useCoils.ts
export function useCoils(filters: CoilFilters) {
  // Lógica de fetchInventory + paginación + estado
  // Reutilizable en inventory/page.tsx y modales
}

// modules/drywall/hooks/useProductionLogs.ts
export function useProductionLogs(filters: ProductionFilters) { ... }
```

**Estimado:** 4 horas

---

#### 5. Escribir ADR-001 y ADR-002
- **ADR-001:** Monorepo modularizado (en lugar de proyectos separados)
- **ADR-002:** Firebase + Firestore (en lugar de Postgres/MySQL)

Usar template adjunto.

**Estimado:** 2 horas

---

### Definition of Done Sprint 1
- [ ] Código movido a `modules/drywall/` sin romper la app
- [ ] Dominio puro extraído y testeado (coverage >80% de domain/)
- [ ] 20+ any's eliminados o justificados
- [ ] Custom hooks creados y en uso
- [ ] ADR-001 y ADR-002 aprobados y mergeados

---

## 📋 Sprint 2 (Semanas 5-6) — TEMPLATE DE LÍNEA

**🎯 Objetivo:** Contrato `BusinessLineModule` + preparación para línea 2

### Tareas Sprint 2

#### 1. Definir interfaz BusinessLineModule
```typescript
// src/core/contracts/BusinessLineModule.ts
export interface BusinessLineModule {
  id: string;
  displayName: string;
  productionEngine: ProductionEngine;
  inventoryEngine: InventoryEngine;
  catalogSchema: z.ZodSchema;  // Zod schema de su catálogo
  routes: RouteConfig[];
  sidebarItems: MenuItem[];
  permissions: RolePermissionMap;
}

export interface ProductionEngine {
  planOperation(input: unknown): Promise<Result<Plan, Error>>;
  executeOperation(planId: string, ...): Promise<Result<void, Error>>;
  cancelOperation(opId: string): Promise<Result<void, Error>>;
  getStatus(opId: string): Promise<OperationStatus>;
}
```

**Estimado:** 4 horas

---

#### 2. Implementar BusinessLineModule en drywall
Refactorizar `modules/drywall/` para implementar el contrato sin cambiar UI.

**Estimado:** 6-8 horas

---

#### 3. Crear selector de línea de negocio
**UI:** Dropdown en sidebar (aunque todavía solo aparezca drywall)

**Persistencia:** Cookie o localStorage con la línea activa

**Estimado:** 3 horas

---

#### 4. Documentar template de línea
```markdown
# docs/04-dominio/lineas-negocio/template.md

Guía para crear una nueva línea de negocio.

## Checklist
- [ ] Crear `modules/<linea>/`
- [ ] Implementar `BusinessLineModule`
- [ ] Definir catálogo con Zod
- [ ] Crear tests de dominio
- [ ] Registrar routes en app/admin/<linea>/
- [ ] Añadir ítem a sidebar
```

**Estimado:** 2 horas

---

#### 5. Planificar línea 2 con cliente
**Reunión stakeholder:**
- ¿Cuál de las 4 líneas pendientes va primero? (tubing, roofing, decking, wholesale)
- Mapear proceso de producción
- Identificar diferencias clave con drywall

**Entregables:**
- Epic de línea 2 en backlog
- User stories preliminares
- Estimación gruesa (T-shirt sizing)

**Estimado:** 4 horas (reunión + doc)

---

### Definition of Done Sprint 2
- [ ] `BusinessLineModule` interface definida y documentada
- [ ] Drywall implementa el contrato
- [ ] Selector de línea funciona (aunque solo hay 1)
- [ ] Template documentado
- [ ] Línea 2 planificada y épica creada
- [ ] Demo de progreso al cliente

---

## 🚀 Después de Sprint 2

**Sprint 3+:** Implementar línea 2 usando el template (2-3 semanas por línea)

**Sprints siguientes:** Líneas 3, 4, 5 (una cada 2-3 sprints)

---

## 📊 Métricas de éxito

Al final de Sprint 2 deberíamos tener:
- ✅ Cero vulnerabilidades críticas en audit
- ✅ Coverage de tests >60% (dominio puro >80%)
- ✅ Build time <3 min
- ✅ Firestore rules seguras deployed
- ✅ Cloud Functions en producción
- ✅ Drywall modularizado y funcionando igual
- ✅ Template listo para replicar

---

## ⚠️ Riesgos identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Romper funcionalidad actual en refactor | Media | Alto | Tests + staging + rollback plan |
| Custom claims no funcionan como esperado | Baja | Alto | Probar en emulator primero |
| Cliente no define bien proceso línea 2 | Media | Medio | Workshops tempranos |
| Developers no entienden arquitectura modular | Baja | Alto | Sesiones de pair programming |
| Firebase rules muy estrictas rompen algo | Media | Alto | Deploy incremental, monitoreo |

---

## 📞 Punto de contacto

**Tech Lead:** [Nombre]  
**Product Owner:** [Nombre]  
**Scrum Master:** [Nombre]

**Daily standup:** 9:00 AM  
**Sprint planning:** Lunes 9:00 AM  
**Sprint review:** Viernes 3:00 PM  
**Retrospective:** Viernes 4:00 PM
