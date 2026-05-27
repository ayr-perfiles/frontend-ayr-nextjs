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

## 🏗️ Relación con `GEMINI.md` / `CLAUDE.md`

Este directorio complementa a `GEMINI.md` (ubicado en la raíz). 
- Usa `GEMINI.md` para **reglas no negociables**, **stack técnico** y el resumen rápido indispensable del proyecto.
- Usa esta carpeta (`docs/`) para **contexto profundo**, **historial de decisiones (ADRs)** y detalles largos sobre **reglas de negocio**.