# Gestión de Secretos - AYR Steel ERP

Este documento detalla la configuración y el mantenimiento de los secretos necesarios para las integraciones de Cloud Functions (SUNAT, APIS.NET, Algolia).

## 1. Lista de Secretos

| Secreto | Descripción |
|---------|-------------|
| `SUNAT_CERT_BASE64` | Certificado digital (.p12 / .pfx) codificado en Base64. |
| `SUNAT_CERT_PASSWORD` | Contraseña del certificado digital. |
| `SUNAT_USER_SOL` | Usuario SOL secundario con permisos de emisión/consulta. |
| `SUNAT_PASS_SOL` | Contraseña del usuario SOL secundario. |
| `SUNAT_CLIENT_SECRET` | Secret para la API de emisión (si aplica flujo REST). |
| `SUNAT_CONSULTA_CLIENT_ID` | Client ID para la API de Validez de CPE (OAuth2). |
| `SUNAT_CONSULTA_CLIENT_SECRET` | Client Secret para la API de Validez de CPE (OAuth2). |
| `APISNET_TOKEN` | Token de acceso para el servicio apis.net.pe (RUC/DNI). |
| `ALGOLIA_ADMIN_KEY` | Llave maestra de Algolia para operaciones de indexación. |

## 2. Configuración de Secretos

Usa el CLI de Firebase para establecer o actualizar cada secreto. El comando solicitará el valor de forma segura (no se mostrará en pantalla).

```bash
firebase functions:secrets:set SUNAT_CERT_BASE64
firebase functions:secrets:set SUNAT_CERT_PASSWORD
firebase functions:secrets:set SUNAT_USER_SOL
firebase functions:secrets:set SUNAT_PASS_SOL
firebase functions:secrets:set SUNAT_CLIENT_SECRET
firebase functions:secrets:set SUNAT_CONSULTA_CLIENT_ID
firebase functions:secrets:set SUNAT_CONSULTA_CLIENT_SECRET
firebase functions:secrets:set APISNET_TOKEN
firebase functions:secrets:set ALGOLIA_ADMIN_KEY
```

## 3. Generar SUNAT_CERT_BASE64

El archivo `.p12` o `.pfx` debe convertirse a una cadena Base64 antes de guardarse como secreto.

### En Windows (PowerShell)
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("mi_certificado.p12"))
```

### En macOS / Linux
```bash
base64 -i mi_certificado.p12
```

**Instrucción:** Copia el output resultante y pégalo cuando el comando `firebase functions:secrets:set SUNAT_CERT_BASE64` te lo solicite.

## 4. Firestore vs. Secret Manager

Para mantener la seguridad y flexibilidad, separamos la configuración en dos capas:

| Característica | Firestore (`integrations`) | Secret Manager (`defineSecret`) |
|----------------|---------------------------|---------------------------------|
| **Tipo de datos** | Configuración no sensible. | Credenciales y llaves privadas. |
| **Ejemplos** | RUC, Razón Social, Endpoints, Series. | Claves SOL, Passwords, Tokens. |
| **Acceso** | Legible desde UI y Functions. | **SOLO** accesible desde Functions. |
| **Visibilidad** | Visible en consola Firebase. | Oculto (encriptado en reposo). |

> **REGLA DE ORO:** Nunca guardes contraseñas o el certificado Base64 en documentos de Firestore ni los expongas en el Frontend.

## 5. Procedimiento de Rotación de RUC

El cambio de RUC es un evento mayor que requiere una actualización coordinada:

1.  **Nuevas Credenciales**: Obtener el nuevo `.p12` y crear un nuevo usuario SOL secundario para el nuevo RUC.
2.  **Actualizar Secretos**: Ejecutar `functions:secrets:set` para `SUNAT_CERT_BASE64`, `SUNAT_CERT_PASSWORD`, `SUNAT_USER_SOL` y `SUNAT_PASS_SOL`. Esto creará una nueva versión del secreto que las funciones usarán tras el próximo despliegue.
3.  **Configuración Firestore**: Actualizar el documento `integrations/sunat-emision` con el nuevo RUC, Razón Social y Dirección Fiscal.
4.  **Reiniciar Correlativos**: Limpiar o resetear la colección `sunatCounters` para las series del nuevo RUC (ej. F001, B001 empezarán de nuevo en 1).
5.  **Persistencia Histórica**: Las ventas emitidas con el RUC anterior mantienen sus datos originales ya que se guardaron como un "snapshot" en el objeto `sunat` de la venta. No se requiere migración de datos históricos.

## 6. Rotación por Compromiso de Seguridad

Si un secreto (ej. Clave SOL) se ve comprometido:

1.  Genera una nueva clave en el portal SOL de SUNAT.
2.  Actualiza el secreto inmediatamente: `firebase functions:secrets:set SUNAT_PASS_SOL`.
3.  Despliega las funciones afectadas para que tomen el nuevo valor.
4.  Verifica los logs en Google Cloud Console para asegurar que las nuevas peticiones son exitosas.
