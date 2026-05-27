# ADR-003: Implementación de RBAC con Custom Claims

**Estado:** Aceptada  
**Fecha:** 2026-05-27
**Decisores:** Equipo AYR Steel
**Sprint:** 0 / 1

---

## 1. Contexto y Problema

Inicialmente, las reglas de Firestore (`firestore.rules`) permitían acceso total de lectura y escritura a cualquier usuario autenticado en la plataforma. Esto representaba un riesgo de seguridad crítico, dado que operadores o usuarios de bajo nivel podían modificar información sensible como el catálogo, ventas completadas y registros de auditoría. 

Se requería implementar un sistema de Control de Acceso Basado en Roles (RBAC) que fuera robusto, no incrementara los costos por lectura en la base de datos de manera excesiva, y se integrara de forma natural con Firebase Auth.

## 2. Opciones Consideradas

1. **Roles en Documentos de Firestore:** Leer un documento `/users/{uid}` en cada regla de seguridad para verificar el rol.
   * *Pros:* Fácil de implementar, fácil de actualizar desde la base de datos.
   * *Contras:* Añade al menos una lectura (read) extra facturable a Firestore por cada operación, lo que puede ser costoso e impactar el rendimiento.
2. **Firebase Auth Custom Claims (Elegida):** Insertar el rol directamente en el token JWT del usuario durante la autenticación.
   * *Pros:* Validación síncrona en las reglas sin lecturas adicionales a la base de datos. Mejor rendimiento y menores costos.
   * *Contras:* Requiere Firebase Admin SDK para la asignación y actualización de los roles (Cloud Functions o scripts backend). El token debe ser refrescado en el cliente para que refleje un cambio de rol inmediato.

## 3. Decisión

Se decide implementar RBAC utilizando **Firebase Auth Custom Claims**.

Los roles oficiales de la plataforma son:
- **ADMIN:** Acceso total, incluyendo gestión de usuarios, catálogos, configuraciones y reglas de inventario restrictivas.
- **SUPERVISOR:** Acceso operativo alto, puede registrar ventas formales, modificar stock, y anular registros de producción. No tiene permisos sobre configuración del sistema.
- **OPERATOR:** Nivel operativo básico, centrado en reportar producción (`production_logs`), consumir materiales, y consultar inventarios en modo de solo lectura.

## 4. Consecuencias

- **Rendimiento:** Las reglas de seguridad se resuelven de inmediato sin latencia extra por lectura a la base de datos.
- **Complejidad de Gestión:** La administración de los roles debe realizarse a través del panel de administrador que utilizará Cloud Functions o un entorno seguro con el `firebase-admin` SDK para llamar a `setCustomUserClaims`.
- **Sincronización:** Los clientes deberán ser forzados a refrescar su sesión (`getIdToken(true)`) si su rol se actualiza mientras están utilizando la aplicación.
- **Seguridad:** Cerramos la brecha crítica en `firestore.rules` al tiempo que preparamos el terreno para escalar los permisos granulares.
