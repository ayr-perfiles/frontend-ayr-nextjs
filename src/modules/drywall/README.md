# Módulo: Drywall (Perfilería)

Línea de negocio: Producción de perfiles para drywall (Parantes, Rieles, Omega).

**Proceso:**
1. Compra de bobina madre (steel coil)
2. Plan de corte (slitter) → define flejes
3. Conformado (roll forming) → flejes → perfiles
4. Inventario y venta

**Estructura:**
- `components/` — UI específica de drywall
- `services/` — acceso a Firebase (productionService, cuttingPlanService)
- `domain/` — lógica pura (slitter, costing, validation)
- `hooks/` — custom hooks (useCoils, useProductionLogs)
- `routes/` — páginas en /admin/drywall/*
- `types.ts` — tipos específicos de drywall

⚠️ Si algo es compartido con otras líneas → muévelo a `core/`
