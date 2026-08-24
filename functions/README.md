# AYR Steel ERP - Firebase Functions

Backend logic for AYR Steel ERP using Firebase Functions v2.

## Configuración de Secretos

Para que las integraciones (SUNAT, APISNET, Algolia) funcionen, es necesario configurar los siguientes secretos en Firebase:

```bash
# SUNAT SOL
firebase functions:secrets:set SUNAT_USER_SOL
firebase functions:secrets:set SUNAT_PASS_SOL
firebase functions:secrets:set SUNAT_CERT_BASE64
firebase functions:secrets:set SUNAT_CERT_PASSWORD

# APIS.NET.PE
firebase functions:secrets:set APISNET_TOKEN

# Algolia
firebase functions:secrets:set ALGOLIA_ADMIN_KEY
```

## Inicialización

Después de desplegar las funciones por primera vez en producción, ejecuta la función `initializeIntegrations` desde la consola de Firebase o mediante una llamada desde el frontend (como ADMIN) para crear la colección `integrations` con la configuración base.

### Seed en Emulador (Desarrollo)

Para sembrar la colección `integrations` en el emulador local sin necesidad de autenticación:

```bash
cd functions
npm run seed:emulator
```

> **Recomendación:** Para persistir los datos del emulador entre reinicios, usa los flags de importación/exportación:
> `firebase emulators:start --import=./.emulator-data --export-on-exit`

## Desarrollo Local

Para ejecutar las funciones localmente con los emuladores:

```bash
cd functions
npm run serve
```

## Estructura

- `src/config/secrets.ts`: Definición de secretos usando `defineSecret`.
- `src/config/integrations.ts`: Helpers para obtener configuración de Firestore.
- `src/services/correlative.ts`: Manejo de correlativos (SUNAT Counters).
