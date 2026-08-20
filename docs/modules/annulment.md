# MÓDULO: annulment (anulación de venta, `annulSale`) — verdad de arquitectura
> ÚLTIMA VERIFICACIÓN CÓDIGO+PROD: 2026-08-19 (v6.50.0, swap completo a callable, commit `204bbada`, runtime validado en prod `ayr.mareliac.pe`).
> ⚠️ SE PUDRE. Antes de tocar `annulSale`/rules de `sales.status`: verificá (checklist). No confíes si la fecha está vieja.

## 1. Componente principal
- `functions/src/callables/sales.ts` — callable `annulSale`, `onCall` v2 gen2, ÚNICO escritor legítimo de `sales.status → 'VOIDED'`.
- Cliente: `src/core/sales/services/salesService.ts` (export `annulSale`) — wrapper thin de `httpsCallable`, ~15 líneas, **NO hace catch/rewrap del error** (necesario para que `parseAnnulError` lea `error.details` estructurado).

## 2. Helpers puros (DUPLICADOS mecánicamente cliente↔server)
- `src/core/sales/saleProductionLink.ts` (`resolveSaleQuotationLink`) + `src/core/sales/annulment/{canAnnulSale,resolveSaleTwinPath,buildAnnulmentCascade,parseAnnulError}.ts` (cliente).
- `functions/src/domain/annulment/{saleQuotationLink,canAnnulSale,resolveSaleTwinPath,buildAnnulmentCascade}.ts` (server) — copias 1:1, con 4 parity tests en `__tests__/*.parity.test.ts` comparando contra la versión cliente.
- **Por qué duplicado y no compartido:** cross-boundary import (`functions/src/... → ../../../src/core/...`) rompe `tsc` (`TS6059`, `rootDir` de `functions/tsconfig.json`) y aunque compilara, `firebase.json` acota `source:"functions"` para el deploy — el zip nunca incluiría `../../../src/`. Mismo patrón sancionado que otros dominios (`coilProduction`, `drywallProduction`, `scrap`) — ver ADR "Dominio puro" en CLAUDE.md §10.
- `parseAnnulError.ts` es SOLO cliente (clasifica el `FunctionsError` que el SDK del browser lanza).

## 3. Stock strategies (server-side, `functions/src/domain/strategies/`)
- `types.ts` — interfaz `StockStrategy` compartida (antes vivía duplicada inline en cada strategy).
- `{metallicRoofing,drywall,roofing,trading,services}StockStrategy.ts` — 5 líneas de negocio completas. `drywallStockStrategy.ts` fue extendido ADITIVAMENTE con `writeSaleDecrement`/`writeSaleReversal` (antes solo tenía `writeProductionIncrement`) — sin romper sus consumidores existentes (`drywallProduction.ts`).
- `index.ts` — registry `getStockStrategy(businessLine)`, espejo del registry cliente (`src/core/sales/strategies/index.ts`).

## 4. Utilidad de traducción
- `functions/src/utils/translateCascadeFields.ts` — traduce los placeholders serializables que `buildAnnulmentCascade` (100% puro, sin `firebase-admin`) emite (`'SERVER_TIMESTAMP'` / `'DELETE_FIELD'` / `'ARRAY_UNION:{json}'`) a los sentinels reales (`FieldValue.serverTimestamp()`/`.delete()`/`.arrayUnion()`). Recibe `FieldValue` como parámetro (inyección de dependencia) para poder testearse con un mock, sin `firebase-admin` real.
- ⚠️ **`FieldValue` SIEMPRE modular** (`import { FieldValue } from "firebase-admin/firestore"`), NUNCA `admin.firestore.FieldValue` (namespace clásico) — el namespace clásico resuelve `undefined` en el emulador LOCAL de Functions (aunque funciona en Cloud Functions real desplegado). Ver CLAUDE.md v6.50.0 aprendizajes.

## 5. UI
- `src/components/sales/SaleDetailsModal.tsx` — `handleAnnul`: llama `annulSale({saleId})` (sin `userEmail`, viene de `request.auth.token.email` server-side), en el `catch` usa `parseAnnulError(error)` para decidir modal vs toast.
- `src/components/sales/ProductionBlockedAnnulModal.tsx` — se dispara si `parsed.type==='production-block' && parsed.quotationId`. CTA "Ir a anular producción" navega a `/admin/lines/metallic-roofing/production/queue` (sin filtro por quote — scope futuro).
- ⚠️ **DEUDA:** en un smoke real de browser (prod) el modal no disparó, cayó a toast plano — investigado a fondo (body HTTP crudo del callable + código fuente de ambos SDKs, todo correcto), sin repro, hipótesis timing de cache Vercel edge post-deploy. Ver CLAUDE.md deudas v6.50.0.

## 6. Firestore rules (`firestore.rules:64-80`, colección `sales`)
```
allow update: if isStaff()
  && fieldsUnchanged(['totalAmount','subtotal','igv','exchangeRate','currency','items','paymentType'])
  && !(request.resource.data.status == 'VOIDED' && resource.data.status != 'VOIDED')
  && !(resource.data.status == 'VOIDED');
```
- `sales.status` sigue mutable client-side para OTRAS transiciones (`approveQuotation`→`CONVERTED`, `cancelQuotation`→`CANCELLED`, ambos siguen 100% client-side, sin migrar).
- Transición a `VOIDED` **candada exclusivamente al callable** (Admin SDK bypassea rules por diseño).
- Un doc ya `VOIDED` queda **terminal/congelado** — ningún campo se toca desde el cliente una vez anulado (cierra de rebote un guard débil de `approveQuotation`, que no excluía `VOIDED` explícitamente).
- Test dedicado: `src/test/rules/salesStatus.rules.test.ts` (primer uso de `@firebase/rules-unit-testing` en el repo, 4 tests).

## 7. Contratos clave (shape de escritura)
- **Error del callable:** `HttpsError(code, message, details?)`. Códigos: `unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`, `failed-precondition`. Solo `ACTIVE_PRODUCTION` (bloqueo por producción) trae `details:{quotationId, activeLogIds}` estructurado — el resto no trae `details`.
- **`annulledSaleRef` (nativa, twin path `native`):** OBJETO `{saleId, saleNumber, annulledAt, annulledBy, reason?}` — **cambio de contrato vs la versión client-side vieja**, que escribía el `saleId` como STRING plano. El test viejo que asumía el string (`annulSaleCascade.integration.test.ts`) fue borrado por obsoleto en el mismo frente.
- **`annulledSaleRefs` (importada, twin path `imported`):** ARRAY de refs (mismo shape de objeto), vía `arrayUnion` — antes el client-side no escribía NADA acá (gap real cerrado).
- **`twinPath` orphan:** solo se escribe la venta misma (`status:VOIDED`), sin twin.
- **D3 (costos sincronizados):** `costSyncedAt`, `items[].baseCost` post-A1 (write-back de costo real de producción) NUNCA se revierten — son hechos históricos, no se tocan en la cascada de anulación.

## 8. Fixtures de test (`src/test/integration/fixtures/`)
- `seedAnnulFixtures.ts` — 7 fixtures (F1-F7, cubren native/imported/happy/block/ex-active/orphan/synced-cost), idempotentes, marcadas `metadata.isAnnulFixture:true`, IDs deterministas con prefijo `ANNUL-FIX-`.
- `seedAnnulFixtures.cli.ts` — wrapper CLI, `npm run seed:annul-fixtures`, guard duro contra correr fuera de `ayrsteel-test`.
- ⚠️ `Timestamp.now()` de `firebase-admin/firestore` NO se usa acá — usa `new Date()` nativo, porque este módulo se importa cross-boundary desde tests de `functions/` (que tiene su PROPIA copia de `firebase-admin` en su `node_modules`) y un `Timestamp` creado con una copia del paquete no es `instanceof` el `Timestamp` que la otra copia espera al validar el write ("dual package hazard").

## 9. VERIFICAR antes de cambio grande
- ¿El caller necesita `error.details` estructurado? Si sí, el wrapper NO debe hacer `catch`/rewrap (ver `productionService.ts` como contraejemplo del patrón que NO aplica acá).
- ¿Tocaste `functions/src/callables/sales.ts`? Correr `npm run build` DE VERDAD (no solo `tsc --noEmit`) antes de `test:emu` — el emulador carga `functions/lib/` compilado, no el TypeScript fuente.
- ¿Agregaste un test con `firebase-functions-test`'s `wrap()`? Recordá que NO pasa por el runtime real — complementar con un smoke HTTP real contra el callable desplegado antes de dar algo por validado.
- `FieldValue` siempre modular (`firebase-admin/firestore`), nunca `admin.firestore.FieldValue`.
