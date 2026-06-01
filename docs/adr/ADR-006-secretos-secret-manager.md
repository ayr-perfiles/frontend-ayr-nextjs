# ADR-006: Secretos de integración en Secret Manager (nunca en Firestore)

**Estado:** Aceptada
**Fecha:** 2026-05-31
**Decisores:** Equipo AYR Steel
**Sprint:** 8

---

## Contexto y problema

El módulo SUNAT y las integraciones externas requieren credenciales altamente sensibles: certificado digital `.p12` (base64) y su contraseña, usuario/clave SOL, `client_secret` de la API de validez, token de consultas RUC/DNI y la admin key de Algolia.

Surgió la duda de si esos valores podían vivir en una colección de configuración en Firestore (junto a la config no-secreta). Riesgo agravado: hoy `firestore.rules` está 100 % abierta (deuda del Sprint 7), por lo que cualquier dato en Firestore es potencialmente legible.

## Opciones consideradas

1. **Guardar todo en Firestore (`integrations`):** cómodo y editable por el cliente, pero expone secretos en backups, exportaciones, logs y ante reglas mal configuradas. Inaceptable para `.p12`/clave SOL.
2. **Secret Manager vía `defineSecret` (elegida):** los secretos los consume solo el servidor (Cloud Functions). Cifrado, versionado, acceso auditado, nunca viajan al cliente.

## Decisión

- **Secretos** → Secret Manager (`defineSecret` de Firebase Functions v2). Se setean con `firebase functions:secrets:set NOMBRE`. Nunca en Firestore ni en la UI.
- **Config no-secreta** (RUC, razón social, series, endpoints, entorno, appId/searchKey de Algolia) → colección `integrations` en Firestore, editable.
- Regla práctica: si el dato lo consume el servidor y nunca el cliente, no va a Firestore aunque las reglas sean perfectas.
- **Binding mínimo:** cada Cloud Function bindea SOLO los secretos que consume (no una lista global). La constante `ALL_SECRETS` se eliminó por ser código muerto.

## Consecuencias

- En la UI del panel de config, los secretos aparecen solo como indicador "configurado / falta", sin mostrar el valor.
- En el emulador, los secretos se proveen en `functions/.secret.local` (formato .env, gitignored); cada secreto bindeado necesita su línea o el emulador intenta leer Secret Manager y falla con 404. Requiere firebase-tools ≥ 13.15.1.
- Rotación de RUC = rotar secretos afectados (nuevo `.p12` + SOL) en Secret Manager, no editar Firestore.
- Cualquier credencial que se filtre (ej. pegada por error) debe rotarse en su origen (portal SOL / proveedor).
