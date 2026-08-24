# ADR-002: Firebase + Firestore como backend

**Estado:** Aceptada  
**Fecha:** 2026-05-26  
**Decisores:** Giancarlo Sinuiri  
**Consulta técnica:** —

---

## Contexto y problema

El ERP necesita un backend capaz de manejar:

- **Autenticación** con roles (Admin, Supervisor, Operario, Comercial, Gerencia)
- **Base de datos transaccional** para kardex, producción, ventas e inventario de bobinas
- **Tiempo real** en vistas de operario (flejes disponibles, stock en vivo)
- **Archivos** para facturas XML y documentos de compra
- **Funciones servidor** para numeración correlativa y triggers de auditoría
- **Búsqueda full-text** sobre bobinas, clientes y registros de producción

El equipo es pequeño (1–3 desarrolladores frontend) sin DevOps dedicado. El tiempo de lanzamiento del MVP era crítico.

- **Pain point principal:** construir y mantener un servidor REST propio (autenticación, migraciones, escalado, backups) requeriría al menos un desarrollador backend a tiempo completo
- **Restricción de equipo:** equipo 100 % frontend; experiencia cero en administración de servidores
- **Restricción temporal:** MVP drywall en < 3 meses

---

## Opciones consideradas

### Opción 1: PostgreSQL + Express (Node.js custom)

**Descripción:** Backend REST propio con Express, Prisma como ORM, PostgreSQL en un VPS o RDS. Autenticación con JWT.

**Pros:**
- ✅ Control total del modelo de datos y las consultas
- ✅ SQL es más expresivo para reportes complejos (agregaciones, joins)
- ✅ Sin lock-in de proveedor

**Contras:**
- ❌ Requiere al menos un desarrollador backend/DevOps dedicado
- ❌ Migraciones de base de datos manuales; riesgo en producción con datos reales
- ❌ Auth, roles, tokens refresh — todo a implementar desde cero
- ❌ Sockets/tiempo real requieren una capa adicional (ej: Pusher, Ably)
- ❌ Backups, escalado, SSL, CORS, logging — overhead operativo permanente

**Impacto en:**
- Complejidad de implementación: Alta
- Mantenibilidad: Media (requiere perfil backend)
- Performance: Alta (SQL optimizable)
- Developer Experience: Mala (para un equipo frontend)

---

### Opción 2: Supabase

**Descripción:** BaaS sobre PostgreSQL con API REST y realtime generados automáticamente, auth incluido, storage, edge functions.

**Pros:**
- ✅ PostgreSQL real — consultas relacionales completas
- ✅ Auth, storage y realtime incluidos
- ✅ Open source; posibilidad de self-host
- ✅ Menor lock-in que Firebase

**Contras:**
- ❌ Realtime en Supabase es menos maduro que Firestore onSnapshot (basado en Postgres LISTEN/NOTIFY con limitaciones de concurrencia)
- ❌ Sin SDK offline-first nativo para React Native (relevante si hay app móvil futura)
- ❌ Row-level security (RLS) de Postgres es poderoso pero más complejo de razonar que las Firestore Security Rules para el equipo actual
- ❌ Menor ecosistema de ejemplos y librerías que Firebase para Next.js

**Impacto en:**
- Complejidad de implementación: Media
- Mantenibilidad: Media-Alta
- Performance: Alta
- Developer Experience: Buena

---

### Opción 3: Firebase + Firestore *(elegida)*

**Descripción:** BaaS de Google. Firestore como base de datos NoSQL con transacciones ACID, Auth con custom claims para RBAC, Storage para archivos, Cloud Functions para lógica servidor, Emulator Suite para desarrollo local.

**Pros:**
- ✅ Auth + RBAC con custom claims: roles en tokens JWT, validados también en Firestore Rules
- ✅ `onSnapshot` para tiempo real: ideal para vistas de operario en planta
- ✅ `runTransaction` con garantías ACID: crítico para kardex y producción
- ✅ Emulator Suite: desarrollo local 100 % offline, sin costo y sin riesgo de pisar datos reales
- ✅ Algolia se integra limpiamente vía Firebase Extension o trigger de Cloud Function
- ✅ SDK oficial para Next.js (App Router), React 19, TypeScript
- ✅ Escalado automático, backups gestionados por Google

**Contras:**
- ❌ NoSQL: Firestore no soporta joins; consultas relacionales complejas requieren desnormalización o múltiples queries
- ❌ No se puede combinar `where("field", "in", [...])` con filtros de rango (limitación conocida, workaround documentado en `CLAUDE.md` § 8)
- ❌ `runTransaction` reintenta automáticamente: los efectos secundarios (emails, APIs externas) deben lanzarse **después** del commit
- ❌ Dependencia de GCP; costos pueden escalar si hay muchas escrituras (mitigable con batches)
- ❌ Las reglas de Firestore expiran el 30/01/2026 si no se renuevan

**Impacto en:**
- Complejidad de implementación: Baja
- Mantenibilidad: Alta (para equipo frontend)
- Performance: Alta en lectura; limitada en consultas relacionales complejas
- Developer Experience: Muy buena

---

## Decisión

**Opción elegida:** Opción 3 — Firebase + Firestore

**Justificación:**

1. **Velocidad de desarrollo:** el equipo es 100 % frontend; Firebase elimina el overhead de DevOps y permite iterar sin servidor propio
2. **Tiempo real nativo:** `onSnapshot` de Firestore es la mejor API de realtime disponible en el mercado BaaS; crítico para el operario de planta
3. **Transacciones ACID:** `runTransaction` garantiza la integridad del kardex y el plan de corte; es el núcleo del negocio
4. **Emulator Suite:** permite un ciclo de desarrollo rápido y seguro sin tocar producción
5. Las limitaciones de NoSQL (sin joins) son aceptables para el dominio: los documentos de producción son naturalmente jerárquicos (bobina → flejes → logs)

Supabase fue una opción seria pero el realtime menos maduro y la menor familiaridad del equipo con RLS lo descartaron.

---

## Consecuencias

### Positivas ✅
- MVP en < 3 meses con equipo de 1 desarrollador
- Cero administración de servidores, backups automáticos, SSL gestionado
- `onSnapshot` en vistas de operario: actualizaciones en < 1 segundo
- Emulator Suite permite desarrollo y testing sin costo y sin riesgo

### Negativas ⚠️
- **Workaround de Firestore `in` + rango:** Firestore no permite combinar `where("status", "in", [...])` con filtros de fecha. Documentado en `inventoryService.fetchInventory` — no modificar sin entender por qué
- **Efectos secundarios en transacciones:** cualquier llamada a API externa (SUNAT, email) debe ir en `.then()` tras el commit de `runTransaction`, nunca dentro
- **Costos a escala:** si las escrituras superan ~100 K/día, revisar uso de batches y caché
- **Expiración de rules:** `storage.rules` expira el 30/01/2026

### Neutrales 🔵
- Búsqueda full-text delegada a Algolia (Firebase no tiene búsqueda nativa); siempre se hidrata contra Firestore para datos frescos
- Cloud Functions actualmente vacías; numeración correlativa y triggers de auditoría viven en cliente y dependen de Firestore Rules

---

## Implementación

**Servicios en uso:**

| Servicio Firebase | Uso |
|---|---|
| Authentication | Login, sesiones, custom claims para roles |
| Firestore | Bobinas, producción, ventas, kardex, auditoría, stock |
| Storage | Facturas XML, documentos de compra |
| Cloud Functions | (En roadmap) numeración de ventas, triggers de auditoría |
| Emulator Suite | Desarrollo local completo |

**Tareas técnicas:**
- [x] Configurar Firestore Rules con roles ADMIN / SUPERVISOR / OPERATOR
- [x] Emulator Suite funcionando con `npm run emulate`
- [x] Custom claims en Auth para RBAC server-side
- [ ] Migrar numeración correlativa de ventas a Cloud Function
- [ ] Migrar triggers de auditoría a Cloud Function
- [ ] Renovar `storage.rules` antes del 30/01/2026
- [ ] Evaluar costos cuando producción supere 10 K registros/mes

**Criterio de éxito:**
- `runTransaction` nunca lanza errores de conflicto en producción bajo carga normal
- Latencia de `onSnapshot` < 2 s en red normal de planta
- Cero incidentes de reglas de seguridad excesivamente permisivas

---

## Validación y revisión

**Fecha de revisión:** 2027-05-26 (1 año tras go-live)

**Trigger para re-evaluar:**
- Si los costos de Firestore superan $200/mes y pueden reducirse con un backend propio
- Si se necesitan consultas relacionales complejas para reportes de gerencia (ej: cruces entre líneas de negocio)
- Si se incorpora una app móvil con requisitos offline que Firestore no satisfaga

---

## Referencias

- [Firestore transactions documentation](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firebase Security Rules reference](https://firebase.google.com/docs/rules)
- [Algolia + Firebase integration](https://www.algolia.com/doc/guides/sending-and-managing-data/send-and-update-your-data/how-to/sending-data-from-firebase/)
- Workaround Firestore `in` + rango: `src/modules/drywall/services/inventoryService.ts` comentario inline
- `CLAUDE.md` § 4 (Integridad transaccional), § 8 (Trampas conocidas)
- ADR relacionado: [[ADR-001-monorepo-modularizado]]

---

## Notas adicionales

La Algolia *search key* es la única clave que se permite en `settings/general_settings` de Firestore (es pública por diseño). Todas las demás credenciales deben ir en variables de entorno o Secret Manager.
