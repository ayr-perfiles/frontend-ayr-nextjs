# ADR-005: Emisión electrónica SUNAT directa (sin PSE/OSE)

**Estado:** Aceptada
**Fecha:** 2026-05-31
**Decisores:** Equipo AYR Steel
**Sprint:** 8

---

## Contexto y problema

El ERP debe emitir comprobantes electrónicos (Factura 01, Boleta 03) y comunicar bajas ante SUNAT. Existen dos arquitecturas posibles:

- **Directa:** la empresa firma y envía los comprobantes a SUNAT con su propio certificado digital (`.p12`) y credenciales SOL.
- **Vía PSE/OSE:** delegar la emisión a un proveedor tercero (Nubefact, Efact, etc.).

Se contaba con un proyecto de referencia funcional (carpeta `sunat/`) que ya implementaba el camino directo: generación de XML UBL 2.1, firma XMLDSig, envío SOAP `sendBill`, correlativos atómicos y comunicación de baja.

## Opciones consideradas

1. **PSE/OSE (intermediario):** menos complejidad de firma/certificado, pero costo recurrente por comprobante, dependencia de un tercero y otro modelo de integración.
2. **Directa a SUNAT (elegida):** control total, sin costo por comprobante, reutiliza el proyecto de referencia ya probado. Requiere gestionar el certificado y las credenciales SOL.

## Decisión

Emisión **directa a SUNAT**, reutilizando el código de referencia, ejecutado en **Cloud Functions v2** (servidor, Node 20). Alcance Fase 1: Factura, Boleta y Comunicación de Baja. Notas de Crédito/Débito y Guía de Remisión (GRE) quedan fuera de la emisión electrónica por ahora.

## Consecuencias

- El resultado de la emisión se guarda en el propio documento de venta: `sales/{id}.sunat = { documentType, serie, correlativo, estado, rucEmisor (snapshot), cdrPath, xmlPath, pdfPath, hash, mensajeSunat }`.
- El `rucEmisor` se congela en cada venta (snapshot) → un futuro cambio de RUC no altera comprobantes históricos.
- Correlativos atómicos por serie en `sunatCounters` vía `runTransaction`.
- Pendiente: prueba real contra SUNAT BETA con un `.p12` válido. El emulador valida lógica, no la firma/envío real.
- Compras: en Perú no se emite en compras (se recibe). La validez del comprobante de proveedor se consulta vía la API oficial de SUNAT (ver módulo de validez CPE), no se emite.
