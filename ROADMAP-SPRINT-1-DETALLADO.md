# 🎯 ROADMAP EJECUTABLE — Sprint 0 ✅, Sprint 1, 2

**Última actualización:** 2025-05-27  
**Estado:** Sprint 0 completado ✅ | Sprint 1 en progreso 🚧  
**Horizonte:** ~4 semanas restantes

---

## ✅ Sprint 0 (COMPLETADO) — ESTABILIZAR BASE

**Duración:** 2 semanas  
**Estado:** ✅ COMPLETADO

### Logros principales:
- ✅ Setup de testing (vitest + 14 tests pasando)
- ✅ Constantes centralizadas en `domain/steel/constants.ts`
- ✅ Estructura modular creada (`core/`, `domain/`, `modules/drywall/`)
- ✅ Cloud Functions básicas deployed (5 funciones)
- ✅ Bug corregido: validación de weightKg en cálculo de densidad
- ✅ ESLint v9 configurado
- ✅ CI pipeline básico

### ⚠️ Pendientes que pasaron a Sprint 1:
- 🔴 Reescribir `firestore.rules` con RBAC real (crítico)
- 🔴 Migrar `storage.rules` con paths específicos (crítico)
- 🟡 Ampliar custom claims en Firebase Auth

---

## 🚧 Sprint 1 (EN CURSO) — REFACTOR DRYWALL + SEGURIDAD

**🎯 Objetivo:** Drywall como módulo ejemplar + cerrar huecos de seguridad críticos

**Duración estimada:** 2 semanas  
**Fecha inicio:** Hoy  
**Fecha fin estimada:** ~2 semanas desde hoy

---

### 🔴 CRÍTICO (MUST-DO) — Semana 1

#### Tarea 1.1: Reescribir firestore.rules con RBAC ⏱️ 4-6h

**Problema actual:**  
```javascript
// ❌ Cualquier usuario autenticado puede leer/escribir TODO
match /{document=**} {
  allow read, write: if request.auth != null;
}
```

**Solución:**  
Crear reglas específicas por colección + custom claims.

**Con la extensión Claude Dev (Cline) en VS Code:**
1. Abre `firestore.rules`
2. `Cmd/Ctrl + Shift + P` → "Cline: Open In New Tab"
3. Prompt:
```
Reescribe firestore.rules implementando RBAC con custom claims.

REGLAS POR COLECCIÓN:
- users/{uid}: solo owner puede escribir su propio doc
- coils: solo ADMIN y SUPERVISOR pueden create/update/delete
  • Validar: initialWeight > 0, status in ['AVAILABLE','IN_PROGRESS','PROCESSED','VOIDED']
- sales: ADMIN puede todo, SUPERVISOR puede create si status = 'QUOTATION'
  • Validar: totalAmount > 0, items no vacío
- production_logs: ADMIN/SUPERVISOR pueden void, OPERATOR puede create
  • Validar: piecesProduced > 0, costPerPiece >= 0
- inventory_stock, kardex_movements: read-only para autenticados
- settings, products: solo ADMIN puede write
- audit_logs: solo ADMIN puede read

Custom claims están en request.auth.token.role (valores: ADMIN, SUPERVISOR, OPERATOR)

Usa el patrón:
function isAdmin() {
  return request.auth.token.role == "ADMIN";
}
```

**Validación:**
```bash
firebase emulators:start
# Probar en localhost:4000 con usuarios de diferentes roles
```

**Entregables:**
- [ ] `firestore.rules` actualizado
- [ ] Probado en emulator con 3 usuarios (ADMIN, SUPERVISOR, OPERATOR)
- [ ] Deployed a staging
- [ ] Crear `docs/09-seguridad/firestore-rules-explicadas.md`

---

#### Tarea 1.2: Configurar Custom Claims en Firebase Auth ⏱️ 2-3h

**Problema:** Los roles actuales solo viven en Firestore, no en Auth.

**Solución:** Script para migrar roles a custom claims.

**Archivo:** `scripts/migrate-roles-to-claims.ts`

**Con Claude Dev:**
```
Crea un script en TypeScript que:
1. Lee todos los usuarios de Firestore collection 'users'
2. Para cada usuario, obtiene su 'role' (ADMIN/SUPERVISOR/OPERATOR)
3. Usa Firebase Admin SDK para setear custom claims: auth.setCustomUserClaims(uid, { role })
4. Debe correr desde Node.js (no desde Cloud Functions)
5. Incluir logs de progreso

Dependencias: firebase-admin
Uso: node scripts/migrate-roles-to-claims.js
```

**Ejecutar:**
```bash
# Crear carpeta scripts
mkdir -p scripts

# Copiar el código generado
# Instalar dependencias
npm install firebase-admin --save-dev

# Correr migración
node scripts/migrate-roles-to-claims.js

# Verificar que funcionó (en consola Firebase Auth)
```

**Entregables:**
- [ ] Script creado y ejecutado exitosamente
- [ ] Todos los usuarios tienen custom claims
- [ ] Verificado en Firebase Console → Authentication → Users → Claims

---

#### Tarea 1.3: Actualizar storage.rules (antes que expire) ⏱️ 1-2h

**Problema:**
```javascript
// ❌ Expira el 30/01/2026 y permite acceso público temporal
match /{allPaths=**} {
  allow read, write: if request.time < timestamp.date(2026, 1, 30);
}
```

**Solución:**

**Con Claude Dev:**
```
Reescribe storage.rules con paths específicos:

ESTRUCTURA:
- /invoices/{companyDoc}/{invoiceId}.pdf
  • Solo ADMIN puede read/write
- /temp-uploads/{userId}/{fileName}
  • Solo owner (userId == request.auth.uid) puede read/write
  • Auto-limpieza después de 24h (documentar, no es automático en rules)
- /public/{fileName}
  • Todos los autenticados pueden read
  • Solo ADMIN puede write

Custom claims en request.auth.token.role

Usa funciones helper:
function isAdmin() {
  return request.auth.token.role == "ADMIN";
}
function isOwner(userId) {
  return request.auth.uid == userId;
}
```

**Validación:**
```bash
# Subir archivo de prueba
# Intentar acceder con usuario no-ADMIN → debe fallar
# Intentar acceder con ADMIN → debe funcionar
```

**Entregables:**
- [ ] `storage.rules` actualizado
- [ ] Probado con upload/download
- [ ] Deployed

---

### 🟢 IMPORTANTE (SHOULD-DO) — Semana 2

#### Tarea 1.4: Migrar código a `modules/drywall/` ⏱️ 6-8h

**Objetivo:** Mover código actual sin romper nada.

**Estructura objetivo:**
```
src/modules/drywall/
├── components/
│   ├── forms/           (AddCoilForm, ProductionForm, ConsumeStripForm)
│   ├── inventory/       (InventoryTable, CoilDetailsModal, EditCoilModal)
│   ├── production/      (ProductionTable, ProductionFilters)
│   └── operator/        (ProduceTab, HistoryTab)
├── services/
│   ├── productionService.ts
│   ├── cuttingPlanService.ts
│   └── inventoryService.ts
├── domain/              (crear vacío, llenar en Tarea 1.5)
├── hooks/               (crear vacío, llenar en Tarea 1.6)
├── types.ts             (Coil, ProductionLog, PlannedStrip)
└── routes/              (pages específicos de drywall)
```

**Con Claude Dev (multi-archivo):**
```
Lee CLAUDE.md para entender la estructura modular.

Tarea: Mueve el código de drywall a src/modules/drywall/ siguiendo esta estructura:

1. Crea carpetas: modules/drywall/{components,services,domain,hooks,routes,types.ts}

2. Mueve componentes:
   - src/components/forms/AddCoilForm.tsx → modules/drywall/components/forms/
   - src/components/forms/ProductionForm.tsx → modules/drywall/components/forms/
   - src/components/forms/ConsumeStripForm.tsx → modules/drywall/components/forms/
   - src/components/inventory/* → modules/drywall/components/inventory/
   - src/components/production/* → modules/drywall/components/production/
   - src/components/operator/* → modules/drywall/components/operator/

3. Mueve servicios:
   - src/services/productionService.ts → modules/drywall/services/
   - src/services/cuttingPlanService.ts → modules/drywall/services/
   - src/services/inventoryService.ts → modules/drywall/services/

4. Actualiza TODOS los imports en los archivos movidos
   - Cambiar '@/components/...' a '@/modules/drywall/components/...'
   - Cambiar '@/services/...' a '@/modules/drywall/services/...'

5. NO cambies la lógica interna, solo la ubicación de archivos

6. Verifica que compila: npm run build
```

**Validación:**
```bash
npm run build   # Debe compilar sin errores
npm run dev     # App debe funcionar igual
# Navegar a todas las secciones de drywall y probar
```

**Entregables:**
- [ ] Código movido a `modules/drywall/`
- [ ] Todos los imports actualizados
- [ ] Build pasa
- [ ] App funciona igual que antes (regression test)
- [ ] Commit: `refactor(drywall): migrate to modular structure`

---

#### Tarea 1.5: Extraer dominio puro (sin Firebase) ⏱️ 6-8h

**Objetivo:** Lógica testeable sin mockear Firestore.

**Archivos a crear en `modules/drywall/domain/`:**

1. **`slitter.ts`** — Reglas del plan de corte
```typescript
// Función pura: recibe datos, devuelve cálculos
export function calculateCuttingPlan(
  masterWidth: number,
  plannedStrips: { width: number, quantity: number }[]
): {
  totalUsedWidth: number,
  scrapWidth: number,
  isValid: boolean,
  effectiveCostPerMm?: number
} {
  // Lógica extraída de saveCuttingPlan
}
```

2. **`costing.ts`** — Cálculo de costos
```typescript
export function calculateEffectiveCostPerMm(
  totalCoilCost: number,
  masterWidth: number,
  totalPlannedWidth: number,
  leftoverWidth: number
): number {
  // Lógica del leftover threshold
}

export function calculateWeightedAverageCost(
  currentQty: number,
  currentAvgCost: number,
  newQty: number,
  newCost: number
): number {
  // Promedio ponderado del kardex
}
```

3. **`validation.ts`** — Validaciones físicas
```typescript
export function validateCoilData(coil: {
  initialWeight: number,
  masterWidth: number,
  thickness: number,
  pricePerKg: number
}): { valid: boolean, errors: string[] } {
  // Validaciones
}
```

**Con Claude Dev:**
```
Lee modules/drywall/services/productionService.ts.

Extrae la lógica pura (cálculos sin side effects) a archivos en modules/drywall/domain/:

1. slitter.ts:
   - calculateCuttingPlan: validación de ancho total, cálculo de scrap
   - Regla del leftover (≤ 40mm)

2. costing.ts:
   - calculateEffectiveCostPerMm: lógica del threshold de 40mm
   - calculateWeightedAverageCost: promedio ponderado del kardex
   - calculateCostPerStrip

3. validation.ts:
   - validateCoilData: initialWeight > 0, masterWidth > 0, etc.
   - validateProductionInput: piezas <= maxAllowed por densidad

Cada función debe:
- Ser pura (input → output, sin Firebase)
- Estar documentada con JSDoc
- Tener tipos explícitos (no any)

Luego actualiza productionService.ts para usar estas funciones.
```

**Validación:**
```bash
# Cada archivo debe tener su .test.ts
npm run test  # Debe pasar todo incluyendo nuevos tests
```

**Entregables:**
- [ ] `domain/slitter.ts` + `slitter.test.ts`
- [ ] `domain/costing.ts` + `costing.test.ts`
- [ ] `domain/validation.ts` + `validation.test.ts`
- [ ] Coverage >80% de domain/
- [ ] Services refactorizados para usar dominio puro

---

#### Tarea 1.6: Crear custom hooks ⏱️ 4-5h

**Objetivo:** Reutilizar lógica de fetching + paginación.

**Archivos a crear en `modules/drywall/hooks/`:**

1. **`useCoils.ts`**
```typescript
export function useCoils(filters: CoilFilters) {
  // Lógica de fetchInventory + paginación + estado
  return {
    coils,
    loading,
    error,
    totalCount,
    nextPage,
    prevPage,
    refresh
  }
}
```

2. **`useProductionLogs.ts`**
```typescript
export function useProductionLogs(filters: ProductionFilters) {
  // Similar a useCoils
}
```

**Con Claude Dev:**
```
Crea custom hooks en modules/drywall/hooks/ para encapsular la lógica de fetching:

1. useCoils.ts:
   - Extrae la lógica de useState + useEffect que está repetida en:
     • src/app/admin/inventory/page.tsx
     • src/components/inventory/InventoryTable.tsx
   - Debe manejar: filtros, paginación, loading, error, refresh

2. useProductionLogs.ts:
   - Similar pero para production_logs

Patrón:
```typescript
export function useCoils(filters: CoilFilters) {
  const [coils, setCoils] = useState<Coil[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ... lógica de fetchInventory, paginación, etc.
  
  return { coils, loading, error, nextPage, prevPage, refresh };
}
```

Luego refactoriza las pages para usar estos hooks en lugar del código inline.
```

**Validación:**
```bash
npm run build
npm run dev
# Verificar que inventory y production siguen funcionando
```

**Entregables:**
- [ ] `hooks/useCoils.ts`
- [ ] `hooks/useProductionLogs.ts`
- [ ] Pages refactorizadas para usar los hooks
- [ ] Código duplicado eliminado

---

#### Tarea 1.7: Eliminar 20+ `any`s del módulo drywall ⏱️ 3-4h

**Objetivo:** Tipado estricto en todo el módulo.

**Con Claude Dev:**
```
Busca todos los 'any' en modules/drywall/ y reemplázalos con tipos explícitos.

Prioridades:
1. Parámetros de funciones en services
2. cursorDoc?: any → QueryDocumentSnapshot<DocumentData>
3. updates: any en updateCoil
4. event handlers con (e: any)

Si un tipo es muy complejo, crea un type alias en types.ts.
Si es imposible tipar, deja comentario // @ts-expect-error [razón]

Objetivo: 0 any's en código nuevo, <5 any's en total con justificación.
```

**Validación:**
```bash
# Buscar any's restantes
grep -r "any" modules/drywall/ --include="*.ts" --include="*.tsx"

npm run lint    # Debe pasar
npm run build   # Debe compilar
```

**Entregables:**
- [ ] 20+ `any`s eliminados
- [ ] Tipos explícitos en su lugar
- [ ] Documento de los any's que quedaron con justificación

---

#### Tarea 1.8: Escribir ADR-001 y ADR-002 ⏱️ 2h

**ADR-001: Monorepo modularizado**
- Decisión: Un repo, módulos por línea
- Alternativas consideradas: multirepo, monolito
- Justificación técnica

**ADR-002: Firebase + Firestore**
- Decisión: Firebase como backend
- Alternativas: Postgres + Express, Supabase
- Justificación: tiempo de desarrollo, auth integrado, escalabilidad

**Usar template:** `docs/adr/TEMPLATE.md`

**Entregables:**
- [ ] `docs/adr/ADR-001-monorepo-modular.md`
- [ ] `docs/adr/ADR-002-firebase-backend.md`

---

## 📊 Definition of Done — Sprint 1

**Funcional:**
- [ ] Firestore rules deployed y probadas
- [ ] Storage rules deployed
- [ ] Custom claims configurados en todos los usuarios
- [ ] App funciona igual desde punto de vista del usuario

**Técnico:**
- [ ] Código de drywall en `modules/drywall/`
- [ ] Dominio puro extraído y testeado (coverage >80%)
- [ ] Custom hooks creados y en uso
- [ ] <5 any's en módulo drywall (con justificación)
- [ ] CI pasa (lint + test + build)

**Documentación:**
- [ ] ADR-001 y ADR-002 aprobados
- [ ] Firestore rules documentadas
- [ ] README actualizado en modules/drywall/

---

## 📋 Sprint 2 (Próximo) — TEMPLATE DE LÍNEA

**Inicio estimado:** En 2 semanas  
**Duración:** 2 semanas

**Preview de tareas principales:**
1. Definir interfaz `BusinessLineModule`
2. Implementarla en drywall
3. Crear selector de línea de negocio
4. Documentar template para nuevas líneas
5. Planificar línea 2 con cliente

---

## 🚀 Comandos rápidos Sprint 1

```bash
# Tests
npm run test

# Lint
npm run lint

# Build
npm run build

# Emulators (para probar rules)
firebase emulators:start

# Deploy rules
firebase deploy --only firestore:rules,storage

# Deploy functions (si actualizas)
firebase deploy --only functions

# Ver logs de functions
firebase functions:log
```

---

## 📞 Soporte

**¿Bloqueado?** Pregunta en este chat o usa Claude Dev en VS Code.

**Daily:** Actualiza este archivo con ✅ en cada tarea completada.
