# Documentación del Proyecto AYR Steel ERP

Bienvenido al índice de la documentación del proyecto. Toda la arquitectura, el dominio y las decisiones técnicas relevantes están centralizadas aquí. 

Esta carpeta contiene el conocimiento del negocio y los estándares que permiten que este ERP sea modular, seguro y escalable.

---

## 📂 Índice de Documentación

### 1. Decisiones Arquitectónicas (ADRs)
Los Registros de Decisiones Arquitectónicas (ADRs) explican el *por qué* detrás de las decisiones técnicas clave.

- [ADR-001: Monorepo Modularizado](adr/ADR-001-monorepo-modularizado.md) - Por qué usamos Next.js App Router con arquitectura modular (core vs modules).
- [ADR-002: Backend en Firebase (Firestore + Auth)](adr/ADR-002-firebase-firestore.md) - Por qué se prefirió Firebase sobre una BD SQL tradicional.
- [ADR-003: Implementación de RBAC con Custom Claims](adr/ADR-003-rbac-con-custom-claims.md) - Por qué migramos la seguridad de Firestore hacia tokens JWT de Firebase Auth.
- [ADR-004: Multi-línea en módulo de ventas (Strategy Pattern)](adr/ADR-004-multilinea-strategy-pattern.md) - Por qué usamos el Patrón Strategy para manejar inventarios cruzados.
- [ADR-005: Emisión electrónica SUNAT directa (sin PSE/OSE)](adr/ADR-005-emision-sunat-directa.md) - Emisión directa a SUNAT sin intermediarios PSE/OSE; reutiliza proyecto de referencia en Cloud Functions v2.
- [ADR-006: Secretos en Secret Manager](adr/ADR-006-secretos-secret-manager.md) - Credenciales sensibles (`.p12`, SOL, tokens) en Secret Manager con binding mínimo; nunca en Firestore.
- [ADR-007: Consultas RUC/DNI vía decolecta.com](adr/ADR-007-decolecta-ruc-dni.md) - Migración del proveedor de consultas de identidad desde apis.net.pe a decolecta.com.
- [ADR-008: Notas de Crédito/Débito en importación de ventas](adr/ADR-008-notas-credito-import.md) - Manejo de NC/ND con `ncStockAction` (`RETURNS_STOCK` / `MONEY_ONLY` / `UNDECIDED`).
- [Template para ADRs](adr/TEMPLATE.md)

### 2. Dominio y Líneas de Negocio
Aquí se documenta cómo se modelan las diferentes ramas de venta y producción de la empresa.

- **Guías de Implementación:**
  - [Template / Guía para Nueva Línea de Negocio](04-dominio/lineas-negocio/template.md) - Los pasos exactos para integrar un nuevo módulo.
- **Líneas Activas:**
  - [Roofing (PVC)](04-dominio/lineas-negocio/roofing.md) - Contexto de productos termoacústicos, stock y SKU.

### 3. Matemáticas y Fórmulas
Para evitar _magic numbers_ y concentrar la lógica pura, documentamos todas las fórmulas:

- [Fórmulas de Costeo PVC](05-formulas/costeo-pvc.md) - Promedio ponderado y manejo de SKU.

### 4. Seguridad
Documentación relativa al modelo de seguridad y control de acceso.

- [Reglas de Firestore Explicadas](09-seguridad/firestore-rules-explicadas.md) - El detalle sobre cómo y por qué operan nuestras restricciones sobre Firestore.

### 5. Procesos (Scrum / Ágil)
Metodologías de trabajo de equipo:

- [Template de User Story](01-scrum/user-story-template.md) - Formato estándar para nuevas funcionalidades.

---

## 🏗️ Relación con `CLAUDE.md` / `GEMINI.md`

Este directorio complementa a `CLAUDE.md` (ubicado en la raíz), que es la **fuente de verdad** del proyecto.

- Usa `CLAUDE.md` para **reglas no negociables**, **stack técnico**, el roadmap de sprints y el resumen rápido indispensable.
- Usa esta carpeta (`docs/`) para **contexto profundo**, **historial de decisiones (ADRs)** y detalles largos sobre **reglas de negocio**.

> **Nota:** `GEMINI.md` (en la raíz y subcarpetas) está **deprecado** en favor de `CLAUDE.md`. No ha sido eliminado para preservar el historial, pero no debe usarse como referencia activa.