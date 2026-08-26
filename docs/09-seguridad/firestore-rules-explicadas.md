# Reglas de Seguridad de Firestore (Explicadas)

> ⚠️ **ESTE DOCUMENTO NO CORRESPONDE AL `firestore.rules` REAL (verificado 2026-08-26,
> v6.66.0).** Describe funciones (`isAuthenticated()`/`isSupervisor()`/`isOperator()`) que
> **nunca existieron** en el archivo real, en ninguna versión — las funciones reales son
> `isSignedIn()`/`hasRole()`/`isAdmin()`/`isStaff()`/`canWrite()` (desde v6.66.0)/`isOwner()`/
> `fieldsUnchanged()`. Stale desde su origen (Sprint 1, mayo 2026), preexistente — no
> introducido por ningún frente reciente. **Fuente de verdad:** el propio `firestore.rules`
> + CLAUDE.md §8 (y su historial de versiones para el porqué de cada regla). El cuerpo de
> abajo NO se reescribió — reescribirlo es un frente propio.

> **Actualizado:** Sprint 1 (Mayo 2026)  
> **Ubicación:** `firestore.rules`

Esta guía detalla la lógica y el propósito detrás de las reglas de seguridad implementadas en Firebase Firestore para el proyecto AYR Steel ERP.

## 1. Concepto Base: RBAC con Custom Claims

Nuestras reglas utilizan el Control de Acceso Basado en Roles (RBAC), leyendo los privilegios directamente desde el token de autenticación (Custom Claims).

Funciones principales de validación:
```javascript
function isAuthenticated() {
  return request.auth != null;
}
function isAdmin() {
  return isAuthenticated() && request.auth.token.role == "ADMIN";
}
function isSupervisor() {
  return isAuthenticated() && request.auth.token.role == "SUPERVISOR";
}
function isOperator() {
  return isAuthenticated() && request.auth.token.role == "OPERATOR";
}
```

## 2. Reglas por Colección

### 2.1 Usuarios (`users/{uid}`)
- **Lectura/Escritura:** Solo el propio usuario propietario de la cuenta (`request.auth.uid == uid`) puede modificar su documento. Un ADMIN tiene acceso a todos los usuarios.

### 2.2 Bobinas - Drywall (`coils/{document=**}`)
- **Lectura:** Cualquier usuario autenticado.
- **Creación/Actualización:** Solo `ADMIN` y `SUPERVISOR`.
- **Validación de Datos:** 
  - Al crear, `initialWeight` debe ser mayor a 0.
  - El estado (`status`) solo puede ser uno de los permitidos: `['AVAILABLE','IN_PROGRESS','PROCESSED','VOIDED']`.

### 2.3 Producción (`production_logs/{document=**}`)
- **Lectura:** Todos los usuarios autenticados.
- **Creación:** `OPERATOR`, `SUPERVISOR`, `ADMIN`.
- **Actualización/Void (Anulación):** Solo `SUPERVISOR` y `ADMIN` pueden anular un registro.
- **Validación:** No se permiten crear registros con cantidades negativas (`piecesProduced > 0`, `costPerPiece >= 0`).

### 2.4 Ventas (`sales/{document=**}`)
- **Lectura:** `ADMIN` y `SUPERVISOR`. Los operadores no tienen por qué visualizar historiales de ventas financieras.
- **Creación/Cotización:** Un `SUPERVISOR` puede crear registros si están en estado `'QUOTATION'`.
- **Actualización (Confirmación/Pago):** Solo `ADMIN` puede confirmar pagos y finalizar ventas formales.
- **Validación:** El monto total debe ser mayor a 0 (`totalAmount > 0`) y el array de items no debe estar vacío.

### 2.5 Catálogos y Configuración (`roofing_catalog`, `settings`, `products`)
- **Lectura:** Todos los autenticados.
- **Escritura:** Exclusivamente `ADMIN`. (Soft delete aplicable para catálogos).

### 2.6 Inventarios (`inventory_stock`, `roofing_stock`)
- **Lectura:** Todos los autenticados.
- **Escritura:** Restringido a `ADMIN` o `SUPERVISOR`, con preferencia de que la modificación sea realizada mediante transacciones controladas por funciones del backend o clientes validados.

### 2.7 Auditoría (`audit_logs/{document=**}`)
- **Escritura:** Solo a nivel de Backend / Cloud Functions (En el cliente, las rules están cerradas a creación para prevenir spam). En caso de estar habilitadas, requieren esquema validado.
- **Lectura:** Exclusivamente `ADMIN`.

## 3. Pruebas y Simulaciones

Para probar estas reglas de manera local, asegúrate de levantar los emuladores:
```bash
npm run emulate
```
Puedes generar un token temporal modificando el claim de rol en el inspector del emulador de Firebase en `localhost:4000`. No abras reglas de Firestore "temporalmente" en producción bajo ninguna circunstancia.
