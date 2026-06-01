> ⚠️ **DEPRECADO** — Este archivo era la guía para el agente Gemini. La fuente de verdad activa es **`CLAUDE.md`** en la raíz del proyecto. No usar como referencia. Archivado el 2026-05-31.

---

# CLAUDE.md — AYR Steel ERP (v6.4)

> **Sprint actual:** Sprint 8 (Facturación Electrónica SUNAT + Refactor Import Ventas) — En progreso 🏗️
> **Estado:** Build 🟢 | Functions v2 (Firebase) con secretos en Secret Manager. Consultas RUC/DNI operativas (decolecta). Emisión SUNAT: código portado, falta prueba real contra BETA.
> **v6.4:** Cloud Functions (emisión SUNAT directa + consulta validez CPE + RUC/DNI), colección `integrations`, refactor del importador masivo de ventas (página propia, peso por UM, Notas Crédito/Débito, idempotencia).

---

## 1. Contexto del Producto

ERP modular para transformación y comercialización de acero/PVC. 5 líneas de negocio integradas bajo navegación por capacidad operativa. Internamente el sistema **trabaja en kg**.

| # | Línea | Módulo | Estado | Materia Prima | Modelo |
|---|---|---|---|---|---|
| 1 | **Drywall** | `drywall` | ✅ | Bobina (vía Flejes) | Transformación |
| 2 | **Metallic Roofing**| `metallic-roofing` | 🏗️ Sprint 6B (BLOQUEADO) | Bobina (Conformado) | Transformación |
| 3 | **Roofing (UPVC)** | `roofing` | ✅ | Producto Terminado | Compra-Venta |
| 4 | **Trading** | `trading` | ✅ | Terceros | Compra-Venta |
| 5 | **Services** | `services` | ✅ | N/A | No-OP Stock |

---

## 2. Módulo de Facturación Electrónica SUNAT (v6.4) 🆕

### 2.1 Arquitectura
- **Emisión DIRECTA a SUNAT** (certificado `.p12` + credenciales SOL propias), NO vía PSE/OSE.
- Corre en **Cloud Functions v2** (Firebase, Node 20, `us-central1`). `admin.initializeApp()`.
- Base reutilizada de un proyecto de referencia funcional (carpeta `sunat/`): xmlGenerator (UBL 2.1 Factura/Boleta), xmlSigner (XMLDSig con node-forge + xml-crypto v6), xmlVoidGenerator (Comunicación de Baja), apiSunat (SOAP sendBill), correlativeService (correlativos atómicos por serie en `sunatCounters`).

### 2.2 Secretos (Secret Manager, NUNCA en Firestore)
Definidos con `defineSecret` en `functions/src/config/secrets.ts`. Se setean con `firebase functions:secrets:set NOMBRE`:
- `SUNAT_USER_SOL`, `SUNAT_PASS_SOL`, `SUNAT_CERT_BASE64`, `SUNAT_CERT_PASSWORD` (emisión)
- `SUNAT_CONSULTA_CLIENT_ID`, `SUNAT_CONSULTA_CLIENT_SECRET` (validez CPE)
- `APISNET_TOKEN` (consultas RUC/DNI), `ALGOLIA_ADMIN_KEY`
- **Binding mínimo:** cada callable bindea SOLO los secretos que consume. `ALL_SECRETS` eliminado (era código muerto tras quitar el binding de `initializeIntegrations`).

### 2.3 Colección `integrations` (config NO-secreta, editable)
Un doc por integración: `sunat-emision`, `sunat-consulta`, `apisnet`, `algolia`. Estructura: `{ provider, enabled, environment: 'beta'|'prod', config: {...}, status: {lastCheck, ok, message} }`. Helper `getIntegrationConfig<T>(id)` + `getSunatEndpoint()`. Sembrado vía callable `initializeIntegrations` (ADMIN) o script standalone para emulador.

### 2.4 Callables
- **Emisión:** `emitirComprobante({saleId})`, `comunicarBaja({saleId, motivo})`, `consultarEstadoBaja({ticket})`. Resultado vive en `sales/{id}.sunat = { documentType, serie, correlativo, estado, rucEmisor (snapshot), cdrPath, xmlPath, pdfPath, hash, mensajeSunat }`.
- **Validez CPE:** `validarCpeSunat(...)` → API oficial SUNAT `validarcomprobante`. Token endpoint: `https://api-seguridad.sunat.gob.pe/v1/clientesextranet/{client_id}/oauth2/token/` (grant probable `client_credentials`, confirmar en manual). Solo da estado de validez, NO el motivo de una NC.
- **RUC/DNI:** `consultarRuc`, `consultarDni` → **decolecta.com** (apis.net.pe migró). Base `https://api.decolecta.com/v1`, endpoints `/sunat/ruc?numero=`, `/sunat/ruc/full?numero=`, `/reniec/dni?numero=`. Header `Authorization: Bearer {token}`. SOLO enrichment de datos, NO valida comprobantes.

### 2.5 Alcance / pendientes
- Fase 1: Factura (01) + Boleta (03) + Comunicación de Baja. Notas Crédito/Débito y GRE quedan fuera de emisión electrónica por ahora.
- **Pendiente prueba real** de emisión contra SUNAT BETA (requiere `.p12` válido). El emulador prueba lógica, no la firma/envío real.
- **Compras:** validación de comprobante de proveedor vía API oficial SUNAT (consulta de validez), NO emisión (en Perú no se emite en compras, se recibe).

---

## 3. Refactor Importador Masivo de Ventas (v6.4) 🆕

Página propia `/admin/sales/import` (grupo Comercial). El importador del Excel a `sales`.

### 3.1 Peso por Unidad de Medida (sistema en kg)
`calcPesoKg(unitOfMeasure, cantidad, unitWeight)` normaliza TODO a kg:
- UNIDAD → `qty × unitWeight` (kg/unidad)
- METRO LINEAL → `qty × unitWeight` (kg/metro)
- KILOGRAMO → `qty` (ya es kg)
- TONELADA → `qty × 1000`
Catálogo `standardWeight` debe estar en kg por la UM de venta del SKU.

### 3.2 Notas Crédito / Débito
- El importer ahora lee `documentType` (Factura/Boleta/Nota Crédito/Nota Débito) y `adjustedDocument` (serie-número original).
- **Nota Crédito:** decisión vía `ncStockAction` (enum INTERNO inglés): `RETURNS_STOCK` (devolución → entra stock IN + resta ingreso), `MONEY_ONLY` (solo resta ingreso), `UNDECIDED` (default, bloquea guardado).
- SUNAT no expone el motivo de la NC → si no viene definido, el usuario decide inline en el preview. Reversa de stock vía `getStockStrategy(line)` (NO hardcode), cantidad/SKU desde la fila de la NC (puede ser parcial).
- **Nota Débito:** suma monto, NO mueve stock.
- Atributo `affectsStock` (de un intento previo) ELIMINADO; única fuente de decisión = `ncStockAction`.

### 3.3 Idempotencia
- Doc de venta ID = `documentNumber` (serie-número).
- Guarda anti doble-import: dentro del `runTransaction`, leer `sales/{documentNumber}` PRIMERO; si existe → omitir (no re-crear, no mover stock). Reporte "importadas / omitidas". Misma guarda para NC/ND.

### 3.4 Tipo de Cambio
- USD→PEN por fecha de emisión vía API del proyecto `/api/tipo-cambio?fecha=`.
- **Ya NO usa fallback 3.75 silencioso:** si no obtiene TC, marca flag y bloquea hasta que el usuario revise.

### 3.5 UX
- Drawer lateral con las 15 columnas obligatorias (referencia, no ocupa espacio fijo).
- Plantilla descargable (`public/templates/`), preview de columnas antes de descargar.
- Alta de SKU faltante: formulario COMPLETO por línea (esquema dinámico), `standardWeight` obligatorio. Nunca auto-crear sin confirmación.
- Validación de archivo vacío/inválido (sin hoja, solo headers, faltan columnas, 0 declarados) antes de procesar.
- Barra de indicadores totales (comprobantes por tipo, ítems, monto neto, peso kg, costo/utilidad, rango fechas, alertas). Recalcula en vivo. Alertas gobiernan el bloqueo de Guardar.
- Badge moneda + TC por ítem; decisión inline de `ncStockAction` para NC sin definir.

### 3.6 Convención de nombres
- NOMBRES de variables/atributos en **inglés**; CONTENIDO/valores en **español** tal como vienen del Excel (no traducir datos). Ej: `documentType="Factura"`, `unitOfMeasure="METRO LINEAL"`, `adjustedDocument`.
- Excepción: `ncStockAction` es campo interno (no del Excel) → su valor es enum inglés.

---

## 4. Arquitectura de Datos

- `integrations`: config no-secreta de SUNAT/decolecta/Algolia. 🆕
- `sunatCounters`: correlativos atómicos por serie. 🆕
- `purchases`: facturas de compra (PEPPS/WAC). Validación de validez vía SUNAT pendiente de UI.
- `cut_orders` / `strips_stock`: corte tercerizado (drywall).
- `sales`: transversal, items por `businessLine`. Sub-objeto `sunat` para comprobante electrónico. NC/ND como docs propios enlazados vía `adjustedDocument`.
- `audit_logs`: operaciones críticas (EMIT_COMPROBANTE, VOID_COMPROBANTE, ENRICH_PARTY_DATA, IMPORT_*, PRODUCT_CREATED_FROM_IMPORT, etc).

---

## 5. Guía de Desarrollo

### Comandos
```bash
npm run dev                              # :3000
npm run emulate                          # Firebase emulators
firebase emulators:start --import=./.emulator-data --export-on-exit  # persistir datos
.\node_modules\.bin\tsc.cmd --noEmit     # Type check
.\node_modules\.bin\eslint.cmd .         # Lint
.\node_modules\.bin\vitest.cmd run       # Tests
# Functions:
cd functions && npm run build            # compila TS -> lib/ (recompilar tras editar)
npm run seed:emulator                    # siembra integrations en el emulador
```

### Emulador + Secretos
- El emulador NO usa Secret Manager: provee valores en `functions/.secret.local` (formato .env, gitignored). Requiere firebase-tools ≥ 13.15.1.
- Cada secreto BINDEADO necesita su línea en `.secret.local` (valor dummy si no se prueba) o el emulador tira warning 404 contra Secret Manager.
- El emulador arranca con Firestore VACÍO → correr el seed de `integrations` o no existirán los docs.
- **Recompilar** (`npm run build`) tras editar TS: el emulador corre `lib/*.js`, no el `.ts`.

### Reglas No Negociables
1. **Rutas:** línea activa SIEMPRE por `lineId` de la URL (nunca localStorage/context).
2. **Stock:** siempre `getStockStrategy(line)`. Nunca hardcodear colecciones. Reversa de NC usa la misma strategy.
3. **Costeo:** IGV NO es costo (crédito fiscal). Detracción = forma de pago. Solo base gravada × TC.
4. **Secretos:** NUNCA en Firestore ni UI. Solo Secret Manager. Binding mínimo por callable.
5. **Nombres en inglés**, valores/datos y errores de usuario en español. 0 `any` nuevos.
6. **Transacciones:** `runTransaction` lee antes de escribir. Idempotencia estricta.
7. **NUNCA** borrado físico: status ANULADA/VOIDED + audit_logs.

---

## 6. Roadmap

- **HECHO (v6.4):**
  - Módulo SUNAT en Cloud Functions: emisión (Factura/Boleta/Baja), validez CPE, RUC/DNI (decolecta).
  - Colección `integrations` + secretos en Secret Manager + binding mínimo.
  - Consultas RUC/DNI operativas.
- **EN PROGRESO (Sprint 8):**
  - Refactor importador ventas (cola de prompts): página propia + plantilla/preview/SKU → peso por UM (✅ aplicado) → rename inglés + eliminar affectaStock → ncStockAction (enum + propagación + peso neto) → idempotencia → badges USD/TC + decisión inline NC → indicadores totales.
  - Prueba real de emisión contra SUNAT BETA (requiere `.p12`).
- **Sprint 6B — Producción Metallic 🛑 BLOQUEADO:** esperando 3 respuestas del cliente (kg vs ML×peso; plan previo vs directo; merma de despunte).
- **Sprint 7 🔴 (Deuda Crítica):** `firestore.rules` por rol/colección (hoy 100% abierta) + migrar writes críticos a Functions.
- **TODO Menor:** validación de CPE de proveedor en UI de compras; emisión electrónica de NC/ND y GRE; migrar compra de bobinas a `purchases`; branch protection master/develop.

---

## 7. Log de Decisiones v6.4

- **SUNAT directo (no PSE/OSE):** se reutilizó proyecto de referencia funcional con cert + SOL propios.
- **Secretos fuera de Firestore:** aunque las rules estén abiertas (Sprint 7), los secretos del servidor no tienen razón de estar en Firestore; Secret Manager es la vía correcta.
- **RUC snapshot en venta:** cada venta guarda el `rucEmisor` con que se emitió → cambiar de RUC no altera comprobantes históricos.
- **decolecta vs apis.net:** apis.net.pe migró a decolecta.com; el token `sk_` corresponde a la plataforma nueva (`api.decolecta.com/v1`).
- **NC sin motivo:** SUNAT no entrega el motivo de una NC ajena → decisión manual del usuario (`ncStockAction`), no se adivina (mover stock mal corrompe inventario).
- **Nombres inglés / valores español:** solo identificadores en inglés; los datos del Excel se conservan en español.
- **TC sin fallback silencioso:** asumir 3.75 ocultaba conversiones erradas → ahora bloquea y avisa.
