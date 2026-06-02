# Informe de Proyecto — AYR Steel ERP
## Universidad Peruana de Ciencias Aplicadas (UPC)

> **Fuente de verdad técnica:** [`CLAUDE.md`](../../CLAUDE.md) (v6.4) · Sprint 8 activo
> **Estado del informe:** ver [`PROGRESS.md`](./PROGRESS.md)
> **Artefactos de apoyo:** [`docs/adr/`](../adr/) · [`docs/04-dominio/`](../04-dominio/)

---

## TABLA DE PROGRESO

| # | Sección | Estado |
|---|---|---|
| 1.1.1 | Descripción de la Startup | 🏗️ |
| 1.1.2 | Perfiles de integrantes | ❌ |
| 1.2 | Solution Profile / Lean UX | 🏗️ |
| 1.3 | Segmentos objetivo | 🏗️ |
| 2.1 | Competidores | ❌ |
| 2.2 | Entrevistas | ❌ |
| 2.3 | Needfinding | ❌ |
| 2.4 | Ubiquitous Language | 🏗️ |
| 3.1–3.4 | Requirements Specification | 🏗️ |
| 4.1–4.2 | Style & IA | 🏗️ |
| 4.3 | Landing Page UI | ❌ |
| 4.4–4.5 | Mobile UX/UI | ❌ |
| 4.6–4.7 | Web App UX/UI | 🏗️ |
| 4.8 | DDD Architecture (Context/Container/Components) | 🏗️ |
| 4.9 | Class Diagrams & Dictionary | 🏗️ |
| 4.10 | Database Design (NoSQL Firestore) | 🏗️ |
| 5.1 | SCM | 🏗️ |
| 5.2.x | Sprint Evidence 1–8 | 🏗️ |
| 6.1.1–6.1.2 | Unit & Integration Tests | 🏗️ |
| 6.1.3 | Core BDD | ❌ |
| 6.2 | Static Analysis | 🏗️ |
| 6.3–6.4 | Validation & UX Audit | ❌ |
| 7.x | DevOps | ❌ |
| 8.x | Experiment-Driven Dev | ❌ |

---

# Capítulo 1: Introducción

## 1.1 Startup Profile

### 1.1.1 Descripción de la Startup

> 🏗️ **Insumo:** CLAUDE.md §1 — expandir con perfil formal de la empresa.

AYR Steel ERP es un sistema de gestión empresarial (ERP) modular desarrollado para una empresa peruana de **transformación y comercialización de acero y PVC**. El sistema abarca cinco líneas de negocio: Drywall (perfiles de acero en seco), Metallic Roofing (coberturas metálicas por conformado), Roofing UPVC (coberturas PVC compra-venta), Trading (comercio de terceros) y Services (sin stock).

**Problema central:** Operaciones de inventario, ventas, compras y facturación electrónica gestionadas en hojas de cálculo desconectadas — sin control de stock en tiempo real ni trazabilidad de auditoría. La obligatoriedad de facturación electrónica SUNAT añadía un requisito regulatorio urgente.

**Solución:** ERP cloud-native (Next.js + Firebase) con arquitectura modular por capacidad operativa, importador masivo de ventas con manejo de Notas de Crédito/Débito, costeo por Promedio Ponderado (WAC) y emisión electrónica directa a SUNAT vía Cloud Functions.

**Stack:** Next.js 14 (App Router) · Firebase (Firestore, Auth, Functions v2) · TypeScript · Tailwind CSS · Algolia · GCP Secret Manager · Vitest.

### 1.1.2 Perfiles de Integrantes del Equipo

> ❌ **Pendiente:** requiere trabajo de campo (no inventar). Incluir nombres, roles y habilidades del equipo.

---

## 1.2 Solution Profile

### 1.2.1 Antecedentes y Problemática

> 🏗️ **Insumo:** CLAUDE.md §1 y §7 Log de Decisiones.

| Dimensión | Detalle |
|---|---|
| **What** | Ausencia de ERP integrado para stock, ventas multi-línea, compras y facturación electrónica SUNAT. |
| **Who** | Empresa peruana de transformación/comercialización de acero/PVC. Usuarios: ADMIN, SUPERVISOR, OPERATOR. |
| **Where** | Operaciones en Perú, sujetas a normativa SUNAT (UBL 2.1, Comunicación de Baja). |
| **When** | Escala de 1 a 5 líneas de negocio; obligatoriedad de facturación electrónica. |
| **Why** | Hojas de cálculo no garantizan idempotencia, trazabilidad ni RBAC. Un error en NC corrompe inventario sin rollback. |
| **How** | ERP cloud con Strategy Pattern por línea, `runTransaction` atómico, Custom Claims JWT, Secret Manager. |
| **How much** | 5 líneas · 8 sprints · stack 100 % serverless Firebase (costo operativo mínimo). |

### 1.2.2 Lean UX Process

> ❌ **Pendiente:** requiere talleres con usuarios (Lean UX Assumptions, Canvas, Hypothesis Statements, Experiments). No inventar resultados.

---

## 1.3 Segmentos Objetivo

> 🏗️ **Insumo:** Derivable del dominio — expandir con datos de mercado.

**Segmento 1 — PYME de manufactura de acero/PVC (Lima):**
- 10–100 empleados, 2–6 líneas de producto.
- Necesidad: control de stock por transformación (bobina → terminado), costeo WAC, facturación electrónica.

**Segmento 2 — Distribuidores de materiales de construcción:**
- Modelo compra-venta sin producción, múltiples proveedores.
- Necesidad: registro de compras con TC, importación masiva de ventas desde Excel SUNAT.

---

# Capítulo 2: Requirements Elicitation & Analysis

## 2.1 Análisis de Competidores

> ❌ **Pendiente:** requiere investigación de mercado (no inventar). Analizar ERPs locales (Alegra, Defontana, SAP Business One) y sus brechas para manufactura de acero/PVC en Perú.

---

## 2.2 Entrevistas

> ❌ **Pendiente:** requiere trabajo de campo (no inventar).
>
> Incluir: diseño de entrevistas, registro (audio/transcripción), análisis de resultados.

---

## 2.3 Needfinding

> ❌ **Pendiente:** requiere trabajo de campo (no inventar).
>
> Incluir: User Personas, User Task Matrix, User Journey Maps, Empathy Maps, As-Is Scenario Map.

---

## 2.4 Ubiquitous Language

> 🏗️ **Insumo:** docs/04-dominio/, ADR-004, ADR-008, CLAUDE.md §3–§4. Glosario derivado del dominio implementado.

Los **identificadores** de código están en inglés; los **valores de datos** del Excel SUNAT se conservan en español (convenio ADR-008).

### Glosario del Dominio

| Término | Definición | Fuente |
|---|---|---|
| **businessLine** | Identificador de línea de negocio: `drywall`, `roofing`, `metallic-roofing`, `trading`, `services`. Determina qué `StockStrategy` aplica. | ADR-004 |
| **StockStrategy** | Interfaz del patrón Strategy. Abstrae operaciones de stock por línea. Implementaciones: roofing, drywall, metallic-roofing, trading, services (NO-OP). | ADR-004 |
| **documentType** | Tipo de comprobante normalizado: `"Factura"`, `"Boleta"`, `"Nota Crédito"`, `"Nota Débito"`. Valor en español (SUNAT). | ADR-008 |
| **documentNumber** | Serie-número del comprobante (ej. `"FFA1-1059"`). Clave de idempotencia en colección `sales`. | CLAUDE.md §3.3 |
| **adjustedDocument** | Serie-número del comprobante original que ajusta una NC o ND. | ADR-008 |
| **ncStockAction** | Enum interno (inglés): `RETURNS_STOCK` (devuelve stock), `MONEY_ONLY` (solo monetario), `UNDECIDED` (bloquea guardado). | ADR-008 |
| **unitOfMeasure** | UM normalizada del Excel: `"UNIDAD"`, `"METRO LINEAL"`, `"KILOGRAMO"`, `"TONELADA"`. | CLAUDE.md §3.1 |
| **standardWeight** | Peso unitario del SKU en kg, almacenado en catálogo. Base para `calcPesoKg()`. | CLAUDE.md §3.1 |
| **avgCost / WAC** | Costo promedio ponderado (Weighted Average Cost) en PEN. Se recalcula solo en entradas. | docs/05-formulas/costeo-pvc.md |
| **runTransaction** | Operación atómica de Firestore: lecturas antes que escrituras. Obligatorio para toda modificación de stock. | ADR-002 |
| **idempotencia** | Importar el mismo comprobante dos veces no genera duplicados ni doble movimiento de stock. | CLAUDE.md §3.3 |
| **audit_logs** | Colección inmutable de eventos críticos (EMIT_COMPROBANTE, VOID_SALE, IMPORT_*, etc.). Nunca se borra. | CLAUDE.md §4 |
| **Bobina / Coil** | Materia prima de acero en rollo para líneas de transformación (Drywall, Metallic Roofing). | docs/04-dominio/ |
| **Fleje / Strip** | Sección longitudinal de la bobina, insumo de la conformadora. | docs/04-dominio/ |
| **SKU** | Stock Keeping Unit. ID de producto = ID del doc en colecciones de catálogo. | roofing.md §2 |
| **stock_movements** | Colección inmutable por línea (ej. `roofing_stock_movements`): ENTRADA, SALIDA, AJUSTE. | roofing.md §3 |
| **SUNAT** | Ente regulador peruano. Receptor de comprobantes electrónicos vía SOAP/API. | ADR-005 |
| **UBL 2.1** | Formato XML estándar para comprobantes electrónicos en Perú (Factura, Boleta, Baja). | ADR-005 |
| **SOL** | SUNAT Operaciones en Línea. Credenciales de emisión (usuario + clave). | ADR-005, ADR-006 |
| **Secret Manager** | GCP. Almacena secretos del servidor con cifrado y auditoría. Nunca en Firestore. | ADR-006 |
| **integrations** | Colección Firestore con config no-secreta de SUNAT, Algolia, decolecta. | CLAUDE.md §2.3 |
| **sunatCounters** | Correlativos atómicos por serie para emisión, gestionados vía `runTransaction`. | CLAUDE.md §2.4 |
| **decolecta.com** | Proveedor activo de consultas RUC/DNI. Reemplazó a apis.net.pe (ADR-007). | ADR-007 |
| **CPE** | Comprobante de Pago Electrónico. Término SUNAT para comprobantes validados digitalmente. | CLAUDE.md §2.4 |
| **ADMIN / SUPERVISOR / OPERATOR** | Roles RBAC via Custom Claims JWT en Firebase Auth. | ADR-003 |
| **TC (Tipo de Cambio)** | Tasa USD→PEN por fecha de emisión. Sin fallback silencioso; bloquea si no se obtiene. | CLAUDE.md §3.4 |

---

# Capítulo 3: Requirements Specification

## 3.1 To-Be Scenario Maps

> 🏗️ **Insumo:** flujos implementados (importar ventas, registrar compra, emitir comprobante). Generar diagramas en docs/report/assets/.

---

## 3.2 User Stories

> 🏗️ **Insumo:** ver plantilla en [docs/01-scrum/user-story-template.md](../01-scrum/user-story-template.md). Completar tabla con todas las épicas.

| Epic | ID | Historia de Usuario | Criterios de Aceptación | Prioridad |
|---|---|---|---|---|
| Ventas | US-01 | Como administrador, quiero importar ventas desde Excel SUNAT para registrar histórico sin duplicados. | Dado un Excel válido, cuando importo, entonces las ventas se crean con idempotencia y el stock se descuenta por línea. | Alta |
| Ventas | US-02 | Como administrador, quiero decidir si una NC devuelve stock o solo dinero para no corromper inventario. | Dado una NC con `UNDECIDED`, cuando selecciono la acción, entonces el botón de guardar se habilita y el stock solo se mueve si `RETURNS_STOCK`. | Alta |
| Compras | US-03 | Como supervisor, quiero registrar una factura de compra para actualizar el WAC del SKU. | Dado una factura con TC, cuando registro, entonces `avgCost` se recalcula y se crea un movimiento de ENTRADA. | Alta |
| SUNAT | US-04 | Como administrador, quiero emitir una Factura electrónica a SUNAT para cumplir normativa. | Dado una venta completada, cuando emito, entonces se genera XML UBL 2.1, se firma y se obtiene CDR de aceptación. | Alta |
| Seguridad | US-05 | Como administrador, quiero asignar roles ADMIN/SUPERVISOR/OPERATOR para controlar acceso. | Dado un usuario sin rol, cuando asigno OPERATOR, entonces solo accede a rutas permitidas. | Media |

_Completar con épicas: Inventario, Producción, Configuración, Reportes._

---

## 3.3 Impact Mapping

> ❌ **Pendiente:** requiere sesión con stakeholders (no inventar). Incluir actores, impactos, entregables y métricas.

---

## 3.4 Product Backlog

> 🏗️ **Insumo:** CLAUDE.md §6 Roadmap.

| # | Historia | SP | Sprint | Estado |
|---|---|---|---|---|
| 1 | Importador masivo ventas (Excel → Firestore) | 13 | 6–8 | ✅ |
| 2 | NC/ND con ncStockAction | 8 | 8 | ✅ |
| 3 | Módulo compras PEPPS/WAC | 8 | 6 | ✅ |
| 4 | Emisión electrónica SUNAT directa (Factura/Boleta/Baja) | 13 | 8 | 🏗️ |
| 5 | Validez CPE + consulta RUC/DNI (decolecta) | 8 | 8 | ✅ |
| 6 | Secretos en Secret Manager + binding mínimo | 5 | 8 | ✅ |
| 7 | Cierre firestore.rules por rol/colección | 13 | Pendiente | ❌ Deuda crítica |
| 8 | Migración writes críticos a Cloud Functions | 13 | Pendiente | ❌ |
| 9 | Producción Metallic Roofing | 13 | 6B BLOQUEADO | 🛑 |

---

# Capítulo 4: Product Design

## 4.1 Style Guidelines

### 4.1.1 General Style Guidelines

> 🏗️ **Insumo:** convenciones del proyecto — completar con paleta de colores y tipografía formal.

- **Framework CSS:** Tailwind CSS (utility-first, v3).
- **Iconos:** Lucide React.
- **Responsive:** prioridad desktop (ERP de gestión); breakpoints Tailwind sm/md/lg/xl.
- **Paleta y tipografía:** pendiente captura de pantalla de la app → docs/report/assets/.

### 4.1.2 Web Style Guidelines

> 🏗️ Sidebar colapsable v3 (260px ↔ 72px). Grupos: Comercial, Producción, Abastecimiento, Materia Prima, Líneas de Negocio, Administración.

---

## 4.2 Information Architecture

### 4.2.1 Organization Systems

> 🏗️ Navegación por capacidad operativa. Rutas: `/admin/lines/[id]/(catalog|inventory|production)`. Línea activa siempre por URL (nunca localStorage).

### 4.2.2 Labeling Systems

Términos: Inventario · Catálogo · Producción · Ventas · Compras · Configuración · Importar.

### 4.2.3 SEO Tags

> ❌ Aplicación interna, sin SEO público.

### 4.2.4 Searching Systems

> 🏗️ Búsqueda de catálogo vía **Algolia** (índice por línea de negocio). Ver ADR-001.

### 4.2.5 Navigation Systems

Sidebar colapsable · tooltips en modo compacto · badge ámbar en Bobinas · pill "Próximamente" donde no hay módulo disponible.

---

## 4.3 Landing Page UI Design

> ❌ **Pendiente:** no existe landing page pública. Documentar wireframes cuando se desarrolle.

---

## 4.4 Mobile Applications UX/UI Design

> ❌ **Pendiente:** no hay app móvil nativa. El ERP es web (responsive).

---

## 4.5 Mobile Applications Prototyping

> ❌ **Pendiente:** ver 4.4.

---

## 4.6 Web Applications UX/UI Design

> 🏗️ **Insumo:** capturas de pantalla de la app. Añadir a docs/report/assets/.

Capturas a incluir:
- Dashboard con sidebar colapsable.
- Importador de ventas (`/admin/sales/import`): tabla preview, indicadores KPI, dropdown NC.
- Módulo de compras: formulario nueva compra.
- Catálogo por línea: `/admin/lines/[id]/catalog`.

---

## 4.7 Web Applications Prototyping

> 🏗️ **Insumo:** Figma / screenshots anotados. Añadir enlace o imágenes a assets/.

---

## 4.8 Domain-Driven Software Architecture

> 🏗️ **Insumo:** ADR-001, ADR-002, ADR-004, CLAUDE.md §2 y §4. Generar diagramas C4 → docs/report/assets/.

### 4.8.1 Software Architecture Context Diagram

Actores y sistemas externos del ERP:

| Actor / Sistema | Tipo | Descripción |
|---|---|---|
| Administrador / Supervisor / Operador | Usuario | Roles con acceso diferenciado (Custom Claims JWT). |
| AYR Steel ERP (Next.js) | Sistema principal | Web app con rutas por capacidad operativa. |
| Firebase Auth | Sistema externo | Autenticación JWT + Custom Claims RBAC. |
| Cloud Firestore | Sistema externo | Base de datos NoSQL (documentos/colecciones). |
| Cloud Functions v2 | Sistema externo | Backend serverless: emisión SUNAT, consultas RUC/DNI. |
| GCP Secret Manager | Sistema externo | Secretos del servidor (cert .p12, SOL, tokens). |
| SUNAT (API SOAP) | Sistema externo | Emisión electrónica (`sendBill`) + validez CPE. |
| decolecta.com | Sistema externo | Consultas RUC (SUNAT) y DNI (RENIEC). |
| Algolia | Sistema externo | Búsqueda full-text de catálogo por línea. |

### 4.8.2 Software Architecture Container Diagram

| Contenedor | Tecnología | Responsabilidad |
|---|---|---|
| Web App | Next.js 14, React 18, TypeScript | UI, rutas protegidas, importador, formularios. |
| Cloud Functions | Firebase Functions v2, Node 20, TS | Emisión SUNAT, validez CPE, RUC/DNI, RBAC setup. |
| Firestore | NoSQL documentos | Persistencia de ventas, stock, compras, audit_logs. |
| Firebase Auth | JWT, Custom Claims | Autenticación y autorización por rol. |
| Secret Manager | GCP | Secretos del servidor (nunca en Firestore). |
| Algolia | SaaS | Índice de búsqueda por línea de negocio. |

### 4.8.3 Software Architecture Components Diagram

Componentes del Web App (ADR-001 — arquitectura modular):

```
src/
├── core/
│   ├── sales/strategies/    ← StockStrategy por línea (ADR-004)
│   └── import/              ← catalogImport, classifyLine
├── modules/                 ← Módulos autocontenidos por línea
│   ├── drywall/
│   ├── roofing/
│   ├── metallic-roofing/
│   ├── trading/
│   └── services/
├── app/admin/               ← Páginas Next.js (App Router)
│   ├── lines/[id]/          ← catalog | inventory | production
│   ├── sales/import/        ← Importador masivo
│   └── purchases/           ← Módulo compras
├── utils/
│   └── importHelpers.ts     ← calcPesoKg, normalizeDocType, classifyNCStockAction
└── lib/firebase/            ← Singleton Firestore/Auth
```

Cloud Functions (`functions/src/`):

```
callables/
├── emitirComprobante.ts     ← UBL 2.1 + XMLDSig + SOAP sendBill
├── comunicarBaja.ts
├── validarCpeSunat.ts       ← API oficial validez CPE
├── consultarRuc.ts          ← decolecta.com
└── consultarDni.ts
sunat/
├── xmlGenerator.ts          ← UBL 2.1 Factura/Boleta
├── xmlSigner.ts             ← XMLDSig (node-forge + xml-crypto v6)
└── apiSunat.ts              ← SOAP client
services/
└── correlativeService.ts    ← Correlativos atómicos (sunatCounters)
```

---

## 4.9 Software Object-Oriented Design

> 🏗️ **Insumo:** `src/core/sales/strategies/index.ts`, `src/types/index.ts`, `src/utils/importHelpers.ts`.

### 4.9.1 Class Diagrams

> 🏗️ Generar diagrama UML formal → docs/report/assets/. Descripción textual:

```
<<interface>> StockStrategy
  + getStockRef(sku: string): DocumentReference
  + extractQuantity(snap: DocumentSnapshot): number
  + extractAvgCost(snap: DocumentSnapshot): number
  + writeSaleDecrement(params: StockWriteParams, snap, tx: Transaction): void
  + writeSaleReversal(params: StockWriteParams, snap, tx: Transaction): void
  + writeProductionIncrement(params: ProductionIncrementParams, snap, tx): void

RoofingStockStrategy    --|> StockStrategy
DrywallStockStrategy    --|> StockStrategy
MetallicRoofingStrategy --|> StockStrategy
TradingStockStrategy    --|> StockStrategy
ServicesStockStrategy   --|> StockStrategy  [NO-OP]

StockWriteParams
  sku: string
  quantity: number
  newBalance: number
  saleId: string
  customerName: string
  sellerId: string
  avgCost?: number
  motivo?: string
  ref?: string

Sale
  documentNumber: string   [PK]
  documentType: NormalizedDocType
  adjustedDocument: string
  ncStockAction: NcStockAction
  items: SaleItem[]
  totalAmount: number
  totalWeight: number
  currency: string
  exchangeRateApplied: number
  sunat?: SunatResult

SaleItem
  sku: string
  quantity: number
  unitOfMeasure: string
  calculatedWeight: number
  businessLine: BusinessLine
  baseCost: number

Purchase
  documentNumber: string   [PK]
  supplierRuc: string
  items: PurchaseItem[]
  totalAmount: number
  exchangeRate: number

Sale "1" *-- "N" SaleItem
Purchase "1" *-- "N" PurchaseItem
```

### 4.9.2 Class Dictionary

| Clase / Función | Descripción |
|---|---|
| `StockStrategy` | Contrato Strategy para las 5 operaciones estándar de stock por línea de negocio. |
| `getStockStrategy(line)` | Factory function — retorna implementación correcta según `BusinessLine`. Nunca retorna `undefined`. |
| `calcPesoKg(unitOfMeasure, cantidad, unitWeight)` | Función pura. Normaliza UM + cantidad → kg. Soporta UNIDAD, METRO LINEAL, KILOGRAMO, TONELADA. |
| `classifyNCStockAction(rawValue)` | Normaliza el campo AFECTA_STOCK del Excel (con diacríticos) → `NcStockAction`. |
| `normalizeDocType(tipo)` | Normaliza tipo de comprobante raw → `NormalizedDocType` (sin acentos, mayúsculas). |
| `NcStockAction` | `'RETURNS_STOCK' \| 'MONEY_ONLY' \| 'UNDECIDED'` |
| `NormalizedDocType` | `'FACTURA' \| 'BOLETA' \| 'NOTA CRÉDITO' \| 'NOTA DÉBITO' \| 'OTROS'` |
| `BusinessLine` | `'drywall' \| 'roofing' \| 'metallic-roofing' \| 'trading' \| 'services'` |

---

## 4.10 Database Design

> 🏗️ **Insumo:** CLAUDE.md §4, ADR-002, docs/04-dominio/lineas-negocio/roofing.md §3.

### 4.10.1 Database Diagram (NoSQL — Cloud Firestore)

Firestore es orientado a documentos. No hay JOINs; la desnormalización es intencional. Cada línea de negocio tiene sus propias colecciones de stock y movimientos.

**Colecciones principales:**

| Colección | ID del doc | Descripción | ¿Inmutable? |
|---|---|---|---|
| `sales/{documentNumber}` | Serie-número | Ventas (formulario + importador). Sub-objeto `sunat`. NC/ND con `adjustedDocument`. | No (estado sunat) |
| `purchases/{id}` | Auto-ID | Facturas de compra con costo WAC. | No (anulación) |
| `customers/{docNumber}` | RUC/DNI | Datos de clientes, enriquecidos vía decolecta. | No |
| `roofing_stock/{sku}` | SKU | Stock Roofing: quantity, avgCost, totalValue. | No |
| `roofing_stock_movements/{id}` | Auto-ID | Movimientos Roofing: ENTRADA/SALIDA/AJUSTE. | Sí |
| `roofing_catalog/{sku}` | SKU | Catálogo PVC. | No (isActive) |
| `trading_stock/{sku}` | SKU | Stock Trading. | No |
| `trading_stock_movements/{id}` | Auto-ID | Movimientos Trading. | Sí |
| `metallic_roofing_stock/{sku}` | SKU | Stock Metallic Roofing. | No |
| `metallic_roofing_stock_movements/{id}` | Auto-ID | Movimientos Metallic. | Sí |
| `inventory_stock/{sku}` | SKU | Stock Drywall (perfiles). | No |
| `kardex_movements/{id}` | Auto-ID | Movimientos Drywall. | Sí |
| `coils/{id}` | Auto-ID | Bobinas de materia prima. | No |
| `cut_orders/{id}` | Auto-ID | Órdenes de corte tercerizado. | No |
| `integrations/{id}` | ID fijo | Config no-secreta SUNAT/Algolia/decolecta. | No |
| `sunatCounters/{serie}` | Serie | Correlativos atómicos por serie. | No (contador) |
| `audit_logs/{id}` | Auto-ID | Eventos críticos inmutables. | Sí |

**Documento `sales/{documentNumber}` — estructura:**

```json
{
  "documentNumber": "FFA1-1059",
  "documentType": "Factura",
  "adjustedDocument": "",
  "ncStockAction": "MONEY_ONLY",
  "customerName": "Empresa ABC S.A.C.",
  "customerDocument": "20123456789",
  "currency": "PEN",
  "exchangeRateApplied": 1,
  "items": [
    {
      "sku": "UPVC6MT",
      "quantity": 10,
      "unitOfMeasure": "UNIDAD",
      "calculatedWeight": 40.5,
      "businessLine": "roofing",
      "baseCost": 35.00
    }
  ],
  "totalAmount": 590.00,
  "totalWeight": 40.5,
  "timestamp": "2026-05-31T12:00:00Z",
  "sunat": {
    "documentType": "01",
    "serie": "FFA1",
    "correlativo": "00001059",
    "estado": "ACEPTADO",
    "rucEmisor": "20999888777",
    "hash": "…",
    "mensajeSunat": "La Factura FFA1-00001059 ha sido aceptada"
  }
}
```

---

# Capítulo 5: Product Implementation, Validation & Deployment

## 5.1 Software Configuration Management

> 🏗️ **Insumo:** CLAUDE.md §5, package.json, tsconfig.json, firebase.json.

### 5.1.1 Software Development Environment Configuration

| Herramienta | Versión | Propósito |
|---|---|---|
| Node.js | 20 LTS | Runtime (frontend + Cloud Functions) |
| Next.js | 14 (App Router) | Framework web |
| TypeScript | 5.x | Tipado estático (0 errores `tsc --noEmit`) |
| Firebase CLI | ≥ 13.15.1 | Emuladores, deploy, secretos |
| Vitest | 4.x | Tests unitarios e integración |
| Tailwind CSS | 3.x | Estilos utility-first |

**Comandos clave:**

```bash
npm run dev                           # Servidor :3000
npm run emulate                       # Emuladores Firebase (Firestore 8080, Auth 9099)
.\node_modules\.bin\tsc.cmd --noEmit  # Type check — debe dar 0 errores
.\node_modules\.bin\eslint.cmd .      # Lint — 0 errores, 413 warnings (heredados)
.\node_modules\.bin\vitest.cmd run    # Tests — 264 pass
cd functions && npm run build         # Compilar Cloud Functions TS → lib/
npm run seed:emulator                 # Sembrar integrations en emulador
```

### 5.1.2 Source Code Management

- **Repositorio:** Git monorepo `frontend-ayr-nextjs`.
- **Ramas:** `master` (producción) · `develop` (integración).
- **Estrategia:** Feature branches → develop → master.
- **Pendiente:** branch protection en master/develop (CLAUDE.md §6 TODO).

### 5.1.3 Source Code Style Guide & Conventions

- **Identificadores:** inglés (`documentType`, `unitOfMeasure`). Valores de datos del Excel: español (`"Factura"`, `"METRO LINEAL"`).
- **Tipado:** TypeScript estricto. 0 `any` nuevos.
- **Stock:** siempre `getStockStrategy(line)`. Nunca hardcode de colecciones.
- **Transacciones:** `runTransaction` con lecturas antes de escrituras. Idempotencia estricta.
- **No borrado físico:** estado `ANULADA/VOIDED` + registro en `audit_logs`.
- **Secretos:** nunca en Firestore ni en código. Solo Secret Manager.

### 5.1.4 Software Deployment Configuration

- **Frontend:** Vercel (Next.js nativo). Variables de entorno en Vercel Dashboard.
- **Cloud Functions:** `firebase deploy --only functions`.
- **Secretos en producción:** `firebase functions:secrets:set NOMBRE`.
- **Emulador:** `functions/.secret.local` (gitignored, valores dummy).

---

## 5.2 Landing Page, Services & Applications Implementation

> 🏗️ Completar cada sprint con: Planning, Sprint Backlog, Burndown, Development Evidence (commits), Testing Evidence, Services Documentation Evidence, Team Collaboration Insights.

### 5.2.1 Sprint 1

> 🏗️ Completar con git log del Sprint 1 y evidencia de commits.

### 5.2.2 Sprint 2

> 🏗️ Completar con git log del Sprint 2.

### 5.2.3 Sprint 3

> 🏗️ Completar con git log del Sprint 3.

### 5.2.4 Sprint 4

> 🏗️ Completar con git log del Sprint 4.

### 5.2.5 Sprint 5

> 🏗️ Completar con git log del Sprint 5.

### 5.2.6 Sprint 6

> 🏗️ Completar con git log del Sprint 6.

### 5.2.7 Sprint 7

> 🏗️ Completar con git log del Sprint 7.

### 5.2.8 Sprint 8 (actual)

> 🏗️ Sprint en curso.

**Sprint Goal:** Módulo de facturación electrónica SUNAT (Factura + Boleta + Baja) + refactor completo del importador masivo de ventas (NC/ND, peso por UM, idempotencia, rename inglés, ncStockAction).

**Hitos completados en Sprint 8:**
- Módulo SUNAT: xmlGenerator UBL 2.1, xmlSigner XMLDSig, apiSunat SOAP, correlativeService.
- Secretos en Secret Manager con binding mínimo por callable.
- Consultas RUC/DNI vía decolecta.com.
- Colección `integrations` + helper `getIntegrationConfig`.
- Refactor importador: peso por UM (`calcPesoKg`), NC/ND (`ncStockAction`), rename inglés, idempotencia.

**Pendiente del Sprint 8:**
- Prueba real de emisión contra SUNAT BETA (requiere `.p12` válido).

---

# Capítulo 6: Product Verification & Validation

## 6.1 Testing Suites & Validation

### 6.1.1 Unit Tests

> 🏗️ **Insumo:** `src/utils/importHelpers.test.ts` (15 tests). Herramienta: Vitest v4. Total proyecto: 264 passing.

Casos cubiertos en `importHelpers.test.ts`:

| Función | Caso | Resultado esperado |
|---|---|---|
| `calcPesoKg` | `('UNIDAD', 10, 2.5)` | `{ weight: 25 }` |
| `calcPesoKg` | `('METRO LINEAL', 5, 1.2)` | `{ weight: 6 }` |
| `calcPesoKg` | `('KILOGRAMO', 50, 2.5)` | `{ weight: 50 }` |
| `calcPesoKg` | `('TONELADA', 2, 2.5)` | `{ weight: 2000 }` |
| `calcPesoKg` | `('PAQUETE', 10, 5)` | `{ weight: 50, flag: 'UM no reconocida: PAQUETE' }` |
| `normalizeDocType` | `'NOTA DE CRÉDITO'` | `'NOTA CRÉDITO'` |
| `normalizeDocType` | `'FACTURA ELECTRÓNICA'` | `'FACTURA'` |
| `classifyNCStockAction` | `'Sí'` (con tilde SUNAT) | `'RETURNS_STOCK'` |
| `classifyNCStockAction` | `'NO'` | `'MONEY_ONLY'` |
| `classifyNCStockAction` | `''` | `'UNDECIDED'` |

### 6.1.2 Integration & E2E Tests

> 🏗️ **Insumo:** `src/test/integration/salesImport.test.ts` — tests contra Firebase Emulator local (Firestore 8080).

Casos cubiertos:

| Test | Escenario | Verificación |
|---|---|---|
| Idempotencia | Re-importar misma factura | Stock no baja dos veces; solo 1 movimiento registrado. |
| NC RETURNS_STOCK vs MONEY_ONLY | 2 NCs con acciones distintas | Stock sube en RETURNS_STOCK, se mantiene en MONEY_ONLY; `totalWeight` difiere. |
| Fase 2 SUNAT | `'Sí'` (Excel) → `classifyNCStockAction` → `RETURNS_STOCK` | Stock IN correcto; movimiento tipo `ENTRADA`. |

### 6.1.3 Core BDD Scenarios

> ❌ **Pendiente:** requiere trabajo de campo (no inventar).
>
> `docs/report/6.1.3_Core_BDD.md` no existe aún. Cuando se cree, fusionar aquí.
> Incluir escenarios Gherkin (Given/When/Then) para: importar venta, registrar NC, emitir comprobante SUNAT.

---

## 6.2 Static Testing & Reviews

> 🏗️ **Insumo:** CLAUDE.md §5 Comandos. Estado al cierre Sprint 8.

### 6.2.1 Static Code Analysis

| Herramienta | Resultado | Configuración |
|---|---|---|
| `tsc --noEmit` | **0 errores** | `tsconfig.json` strict: true, paths `@/*` |
| ESLint | **0 errores · 413 warnings** | Next.js defaults + TypeScript rules |
| Vitest | **264 tests passing** | Vitest v4, emulador Firebase para integración |

Coverage formal (umbral) pendiente de configurar en CI.

---

## 6.3 Validation Interviews

> ❌ **Pendiente:** requiere trabajo de campo (no inventar). Incluir entrevistas de validación post-implementación con usuarios reales.

---

## 6.4 Video About-the-Product / Auditoría UX

> ❌ **Pendiente:** requiere trabajo de campo (no inventar). Incluir grabación de demo funcional + análisis de usabilidad (heurísticas de Nielsen o similar).

---

# Capítulo 7: DevOps Practices

## 7.1 Continuous Integration (CI)

> ❌ **Pendiente:** no hay pipeline CI configurado.
>
> Recomendación (para implementar): GitHub Actions en PR → `tsc --noEmit` + `eslint .` + `vitest run`.

## 7.2 Continuous Delivery (CD)

> ❌ **Pendiente:** deploy manual actual (`firebase deploy`).
>
> Recomendación: GitHub Actions en merge a master → `firebase deploy --only hosting,functions`.

## 7.3 Continuous Deployment & Release Management

> ❌ **Pendiente:** branch protection en master/develop. Documentado en CLAUDE.md §6 como TODO Menor.

---

# Capítulo 8: Experiment-Driven Development

> ❌ **Pendiente:** requiere trabajo de campo. No inventar hipótesis ni resultados.

## 8.1 Experiment Planning

> ❌ Pendiente: definir hipótesis de negocio y métricas de éxito formales.

## 8.2 Experiment Execution & Results

> ❌ Pendiente: ejecutar experimentos y registrar resultados.

## 8.3 Pivot or Persevere Decisions

> ❌ Pendiente: documentar decisiones basadas en resultados de experimentos.

---

## Referencias

| Documento | Descripción |
|---|---|
| [`CLAUDE.md`](../../CLAUDE.md) | Fuente de verdad técnica (v6.4, Sprint 8) |
| [`docs/adr/ADR-001`](../adr/ADR-001-monorepo-modularizado.md) | Monorepo modularizado (Next.js App Router) |
| [`docs/adr/ADR-002`](../adr/ADR-002-firebase-firestore.md) | Backend Firebase/Firestore |
| [`docs/adr/ADR-003`](../adr/ADR-003-rbac-con-custom-claims.md) | RBAC con Custom Claims JWT |
| [`docs/adr/ADR-004`](../adr/ADR-004-multilinea-strategy-pattern.md) | Strategy Pattern multi-línea |
| [`docs/adr/ADR-005`](../adr/ADR-005-emision-sunat-directa.md) | Emisión SUNAT directa |
| [`docs/adr/ADR-006`](../adr/ADR-006-secretos-secret-manager.md) | Secretos en Secret Manager |
| [`docs/adr/ADR-007`](../adr/ADR-007-decolecta-ruc-dni.md) | Consultas RUC/DNI vía decolecta.com |
| [`docs/adr/ADR-008`](../adr/ADR-008-notas-credito-import.md) | NC/ND con ncStockAction |
| [`docs/04-dominio/lineas-negocio/roofing.md`](../04-dominio/lineas-negocio/roofing.md) | Dominio Roofing PVC |
| [`docs/05-formulas/costeo-pvc.md`](../05-formulas/costeo-pvc.md) | Fórmulas WAC/PEPPS |
| [`docs/report/PROGRESS.md`](./PROGRESS.md) | Estado editable por sección |
| [`docs/report/assets/`](./assets/) | Diagramas, capturas, videos |

---

_Última actualización: 2026-05-31 — CLAUDE.md v6.4 / Sprint 8 activo_
