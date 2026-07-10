# Documentación del Proyecto AYR Steel ERP

> Última actualización del índice: 2026-07-07 · commit `71250ae6`
> Fuente de verdad TÉCNICA viva: **`CLAUDE.md` (raíz, v6.21)** + el código. Los docs de esta carpeta se validan contra el código, no al revés.

Bienvenido al índice de la documentación del proyecto. Cada entrada lleva su **estado**:

- **Vigente** — verificado contra el código recientemente.
- **Superseded** — la decisión/estructura cambió; se conserva por historia con banner.
- **Congelado** — snapshot de un sprint pasado (Sprint 3-8 / CLAUDE.md v6.4, mayo 2026); útil como historia, NO como referencia del estado actual.
- **Deprecado** — no usar.

---

## 📂 Índice por carpeta

### `02-glosario/` — Lenguaje ubicuo 🆕
| Doc | Estado | Qué cubre |
|---|---|---|
| [glosario.md](02-glosario/glosario.md) | Vigente | Términos de negocio ES ↔ código/colección (bobina, fleje, merma, WAC, costo congelado, ProductKind, TC, ...) |

### `03-arquitectura/` — Patrones transversales 🆕
| Doc | Estado | Qué cubre |
|---|---|---|
| [patrones-y-convenciones.md](03-arquitectura/patrones-y-convenciones.md) | Vigente | Strategy, thin-client/fat-backend, paridad SYNC-MARKER, runTransaction/append-only, auth claim-only, fallo ruidoso — con las EXCEPCIONES reales por archivo:línea |

### `05-formulas/` — Matemáticas y fórmulas (expandido 2026-07)
| Doc | Estado | Qué cubre |
|---|---|---|
| [README.md](05-formulas/README.md) | Vigente | Índice de ~45 fórmulas + convenciones de fichas + drift conocido |
| [modelo-de-costeo.md](05-formulas/modelo-de-costeo.md) | Vigente | Los 3 principios (costo congelado en reversas / WAC actual en ingresos / densidad única por acabado) + mapa fórmula→principio + peso↔ML↔UND |
| [costeo-coils.md](05-formulas/costeo-coils.md) | Vigente | pricePerKg, split, conformado, reversas (void*/reverse*), EPSILON 0.01, guards TC/peso |
| [costeo-drywall.md](05-formulas/costeo-drywall.md) | Vigente | WAC drywall (⚠️ ×3 copias), corte/leftover ≤40mm, flejes, reversa client-side (WRITE 7 pendiente) |
| [ventas-igv.md](05-formulas/ventas-igv.md) | Vigente | suggestedPrice real, deuda IGV_RATE ×6, writeSaleReversal, WAC compras (LINE_CONFIG 2/5) |
| [costeo-pvc.md](05-formulas/costeo-pvc.md) | Vigente (corregido 2026-07-07) | CPP roofing — corregidas 2 secciones que citaban archivos/fórmulas inexistentes |
| [_TEMPLATE.md](05-formulas/_TEMPLATE.md) | Vigente | Ficha estándar para nuevas fórmulas |

### `adr/` — Decisiones arquitectónicas
| ADR | Estado | Decisión |
|---|---|---|
| [ADR-001](adr/ADR-001-monorepo-modularizado.md) | Vigente | Monorepo modularizado (Next.js App Router) |
| [ADR-002](adr/ADR-002-firebase-firestore.md) | Vigente | Firebase/Firestore como backend |
| [ADR-003](adr/ADR-003-rbac-con-custom-claims.md) | Vigente | RBAC con custom claims JWT |
| [ADR-004](adr/ADR-004-multilinea-strategy-pattern.md) | ⚠️ Superseded (detalle) | Strategy multilínea — decisión vigente, interfaz documentada histórica (banner en el doc) |
| [ADR-005](adr/ADR-005-emision-sunat-directa.md) | ⚠️ Desalineado | Emisión SUNAT directa — OJO: SUNAT hoy solo está desplegado en `ayrsteel-test`, NO en prod (deuda infra, ver HANDOFF) |
| [ADR-006](adr/ADR-006-secretos-secret-manager.md) | Vigente | Secretos en Secret Manager |
| [ADR-007](adr/ADR-007-decolecta-ruc-dni.md) | Vigente | RUC/DNI vía decolecta.com |
| [ADR-008](adr/ADR-008-notas-credito-import.md) | Vigente | NC/ND con `ncStockAction` |
| [ADR-009](adr/ADR-009-costo-congelado-reversas.md) 🆕 | Vigente | Costo CONGELADO en toda reversa (nunca WAC actual) |
| [ADR-010](adr/ADR-010-guard-posterior-venta-completada.md) 🆕 | Vigente | Guard posterior de venta COMPLETED en anulación de producción (`approvedAt ?? timestamp`) |
| [ADR-011](adr/ADR-011-atomicidad-por-factura-bulk.md) 🆕 | Vigente | Atomicidad POR FACTURA en `registerCoilsBulk` |
| [TEMPLATE](adr/TEMPLATE.md) | Vigente | Plantilla |

### `04-dominio/` — Líneas de negocio
| Doc | Estado | Qué cubre |
|---|---|---|
| [lineas-negocio/roofing.md](04-dominio/lineas-negocio/roofing.md) | ⚠️ Congelado (Sprint 3) | Dominio Roofing PVC — dice "En desarrollo"; la línea está ✅ completa desde hace varios sprints (CLAUDE.md §1) |
| [lineas-negocio/template.md](04-dominio/lineas-negocio/template.md) | Congelado | Guía para nueva línea (Sprint 2) |

### `09-seguridad/`
| Doc | Estado | Qué cubre |
|---|---|---|
| [firestore-rules-explicadas.md](09-seguridad/firestore-rules-explicadas.md) | ⚠️ Congelado (Sprint 1) | Rules explicadas — el estado REAL de rules (claim-only, scrap_logs candada, FASE 2 abierta) está en CLAUDE.md §8 |

### `01-scrum/`
| Doc | Estado |
|---|---|
| [user-story-template.md](01-scrum/user-story-template.md) | Vigente (plantilla) |

### `report/` — Informe académico UPC
| Doc | Estado |
|---|---|
| [REPORT.md](report/REPORT.md) / [PROGRESS.md](report/PROGRESS.md) | ⚠️ Congelado (CLAUDE.md v6.4 / Sprint 8, 2026-05-31) — audiencia académica, NO referencia técnica |

### Raíz del repo
| Doc | Estado |
|---|---|
| `CLAUDE.md` | **Vigente — fuente de verdad técnica (v6.21)** |
| `HANDOFF.md` | Vigente (handoff de sesión) |
| `ROADMAP.md` | ⚠️ Congelado (plan histórico Sprints 0-4, mayo 2025) — no describe el estado actual |
| `GEMINI.md` (raíz y subcarpetas) | Deprecado (preservado por historia; ver `_archive/`) |

---

## 🏗️ Relación con `CLAUDE.md`

- Usa `CLAUDE.md` para **reglas no negociables**, estado del sprint, roadmap vivo y el resumen indispensable.
- Usa esta carpeta para **contexto profundo**: fórmulas verificadas (`05-formulas/`), glosario (`02-glosario/`), patrones con sus excepciones reales (`03-arquitectura/`), historial de decisiones (`adr/`).
- Ante conflicto entre un doc y el código: **gana el código**; reportá el drift y corregí el doc (no al revés).
