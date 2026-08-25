# Búsqueda (Algolia) — Estado Real

> Estado: Vigente
> Última verificación: 2026-08-25 (v6.61.0) — records, filtros y conteos medidos contra el índice real de prod con la search-key, valor por valor contra Firestore.
> Fuente de verdad del INDEXADO: la config de la extensión (Firebase console) + el dashboard de Algolia. **Ninguna de las dos está versionada en el repo** — ver §4.

## 1. El indexador NO es código del repo

La indexación Firestore→Algolia la hace la extensión **`algolia/firestore-algolia-search`** (instalada 2026-03-19, `LOCATION=us-central1`), un trigger `onWrite` por colección. Un grep de "algolia" en el repo solo encuentra el CLIENTE de búsqueda (`src/lib/algoliaClient.ts` + los call-sites) — por eso el recon de v6.60.0 concluyó "cero writers" hasta correr `firebase ext:export`.

Son **5 instancias**, una por índice (export crudo en el scratch de la sesión 2026-08-24; versiones: 4× `@1.2.10`, `production-logs` en `@1.2.11`):

| instancia | colección | índice | `FIELDS` |
|---|---|---|---|
| `firestore-algolia-search` | `coils` | `coils_index` | `id,status,masterWidth,thickness,metadata.provider,metadata.currency,finish,currentWeight,initialWeight` *(los 2 últimos de metadata/finish agregados en v6.61.0)* |
| `firestore-algolia-search-sales` | `sales` | `sales_index` | `customerName, documentNumber, totalAmount, status, sellerId, timestamp` |
| `firestore-algolia-search-customers` | `customers` | `customers_index` | `name` |
| `firestore-algolia-search-contacts` | `contacts` | `contacts_index` | `name, phone, email, associatedCompanyIds` |
| `firestore-algolia-search-production-logs` | `production_logs` | `production_logs_index` | `parentCoilId,sku,status,timestamp` |

Detalles de shape que muerden: la extensión **aplana los paths con punto a keys literales** (el record trae la key `"metadata.provider"`, no un objeto anidado `metadata:{provider}`) y agrega un `lastmodified` con payload `{_operation:"IncrementSet", value:<epoch-ms>}`. El `path`/`objectID` siempre están.

## 2. Facets: qué está declarado hoy (medido 2026-08-25)

Un filtro (`filters: "campo:valor"`) solo funciona si el atributo está en `attributesForFaceting` del índice (dashboard de Algolia). Estado por índice:

| índice | facets | evidencia (nbHits vs Firestore) |
|---|---|---|
| `coils_index` | ✅ `filterOnly(status)`, `filterOnly(finish)`, `filterOnly(metadata.currency)`, `filterOnly(metadata.provider)` — declarados v6.61.0 | 8/8 filtros cuadran; Σ 7 finish = Σ 4 status = 168 |
| `production_logs_index` | ✅ funcionan (`status`, `sku`) — **sin registro de cuándo/quién los declaró** | `status:ACTIVE` 250/250 · `sku` 77/77 |
| `sales_index` | ❌ sin facets (los campos SÍ están en el record, 329/330) | `status:COMPLETED` 0/191 · `sellerId` 0/261 |
| `customers_index` | ❌ sin facets (campo presente) | `name:"<real>"` 0/1 |
| `contacts_index` | no medible (índice y colección vacíos) | 0/0 |

`filterOnly(...)` a propósito: nadie pide `facets` ni renderiza conteos — los dropdowns salen de Firestore (`coil_finishes`, etc.), no de Algolia.

## 3. Los 3 modos de fallo, todos SILENCIOSOS

1. **Filtro sobre atributo NO facetable → nbHits 0 sin error.** Indistinguible de "sin resultados". Y una NEGACIÓN sobre atributo no facetable **no excluye nada**: `NOT status:VOIDED` devolvía los 168 con el VOIDED incluido — o sea el filtro por defecto de `fetchInventory` también estaba roto, no solo el de acabado.
2. **Valor con espacios sin comillas → error de sintaxis del parser** (`Unexpected token`). Cerrado para coils en `5c83f7bb`: `buildCoilAlgoliaFilters` (`src/core/coils/coilAlgoliaFilters.ts`) es la fuente única de los filtros de `fetchInventory`/`fetchCoilsForExport` y cita el valor de provider (los 13 proveedores de prod tienen espacios).
3. **`algoliaClient.ts:37-39` traga TODO error y devuelve `{hits:[]}`** — el error nunca llega al estado de error de los hooks (`useCoils`, etc.); el usuario ve tabla vacía. Deuda viva (v6.61.0): propagar en vez de tragar.

## 4. Config sin versionar + sin paridad test

- **Dos superficies de config, ninguna en git:** `FIELDS` (Firebase console, por instancia de extensión) y `attributesForFaceting` (dashboard de Algolia, por índice). Cambios ahí no dejan rastro — el registro en CLAUDE.md/este doc es la única memoria.
- **Orden obligatorio al agregar un campo filtrable:** declarar el facet PRIMERO, ampliar `FIELDS` después. Al revés, el re-sync corre y el campo entra sin ser facetable.
- **`ayrsteel-test` tiene 0 extensiones instaladas** → la búsqueda NO existe en test; todo fix de búsqueda se valida directo en prod (deuda v6.61.0: instalar las 5 en test).
- Los deletes se propagan por el mismo trigger, asíncrono — y pueden perderse: `sales_index` arrastra 1 record fantasma (`SMOKE-EDIT-PROD-Q-NATIVA`) de un cleanup de smoke que no barrió el índice.

## 5. Cómo verificar sin admin key

Con la search-key (en `settings/integrations` de Firestore) alcanza: `searchSingleIndex` con `query:''` + el filtro, y comparar `nbHits` contra un count en vivo de Firestore, **valor por valor, con suma de control sobre el universo** (Σ de todos los valores del campo == total de records). Un sample de 1 record NO es evidencia del shape — el histograma de key-sets sobre el universo entero sí (lección v6.61.0: el único record muestreado resultó ser el fantasma). Scripts de referencia en el scratch `2026-08-24-algolia-finish/` (`verify-post-save.cjs`, `g-otros-indices.cjs`, `h-sales-index.cjs`).
