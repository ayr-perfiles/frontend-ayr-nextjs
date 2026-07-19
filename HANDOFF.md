# Handoff — AYR Steel ERP (Siguiente Sesión)

> Subir SIEMPRE al inicio: este HANDOFF + GEMINI.md (v6.22).
> Preferencias: Prompts Gemini Code por defecto. Caveman mode. PASO 0 read-only en cada prompt.
> Preguntar ante duda de negocio. NUNCA cerrar en verde sin RUNTIME (lo corre el USUARIO, no Gemini).
> npm run build LOCAL antes de merge a master. Un frente a la vez, confirmar cierre antes de seguir.
> backend en prod antes que master.

## 🔴 CRÍTICO Y URGENTE (WRITE 7 drywall)
- `revertProductionLog` (drywall) está implementado en `develop`+`master` y el front usa thin-client, PERO falta validación en runtime (ver sección inferior). El despliegue de la Cloud Function a PROD se hizo en esta sesión, por lo que ya no debería dar error 404, **pero requiere prueba runtime de validación urgente**.

## ✅ Cerrado esta sesión (v6.22)
- **Metallic Frente 1:** filtro espesor tolerancia ±0.02 (helper entero) + input cantidad×longitud→ML derivado (piecesCount/pieceLengthM en perCoilBreakdown).
- **Frente 1.5:** fix coilRef.id en voidProductionFromCoils (bobinas sin campo id → kardex sku undefined). Runtime validado.
- **Cotización↔producción:** production_log.source={type:'QUOTE',id,label}, selector "producir contra cotización" + fulfillment derivado (getProducedForSourceLine) + warning sobre-producción (base pendiente) + vista en SaleDetailsModal + botón ver cotización. Índice production_logs(source.id,status,timestamp).
- **HARD GATE:** producción metallic SOLO contra cotización (eliminado ad-hoc + descartado Slice 2 solicitudes manuales). Backend guard: produceFromCoils exige source.type=='QUOTE'.
- **Bug Ventas:** índice sales(businessLines CONTAINS,timestamp,totalAmount,totalProfit,totalWeight) + useSales muestra error visible en /admin/sales.
- **RUC/DNI en prod RESUELTO:** consultarRuc/Dni extraídas de codebase 'sunat' a 'default'; secret APISNET_TOKEN + doc integrations/apisnet en prod.
- **Factura de Compra (AddCoilForm):** fix botón, espesor ensanchado, warning TC USD manual. COMPOSITE ID en registerCoil. isClosed toggle agregado (setCoilClosed). Todo desplegado a PROD.

## Pendientes Manuales en PROD
- **Vercel APIS_PERU_TOKEN (TC):** pendiente de configuración manual en prod.
- **Rotar token decolecta:** (expuesto en un chat).
- **Verificar rules counters en prod:** deploy de rules se saltó.

## 🔴 ARRANCAR PRÓXIMA SESIÓN — Opciones de arranque (en orden)

1. **WRITE 7 drywall (URGENTE):** Probar en runtime `revertProductionLog` (drywall) para confirmar que no se haya roto en prod, resolver cualquier error resultante de la migración a thin-client.
2. **WRITE 8 (cutOrder):** monstruo de prorrateo/WAC (5 funciones).
3. **WRITE 9 (salesService):** payload crítico precio/correlativo.

- **MANTENER:** las reglas de oro (runtime lo corre el usuario; números crudos no conclusiones; npm run build local antes de merge; deploy por función específica leyendo el plan; PASO 0 read-only; un frente a la vez; backend en prod antes que master).
- **Recordatorio de disciplina:** contra PROD, revisar uid del ADMIN + guard de proyecto ANTES de correr el script.

## Deudas vivas (detalle en GEMINI.md §11)
- Detalle extendido en GEMINI.md.
