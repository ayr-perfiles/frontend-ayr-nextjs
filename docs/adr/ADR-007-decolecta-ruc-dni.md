# ADR-007: Consultas RUC/DNI vía decolecta.com (migración desde apis.net.pe)

**Estado:** Aceptada
**Fecha:** 2026-05-31
**Decisores:** Equipo AYR Steel
**Sprint:** 8

---

## Contexto y problema

El sistema necesita enriquecer datos de proveedores y clientes consultando RUC (SUNAT) y DNI (RENIEC) para autocompletar razón social, dirección y nombres. La integración inicial apuntaba a `api.apis.net.pe/v2`, pero las consultas fallaban con `MicroService Not found`.

Causa: **apis.net.pe migró su servicio a decolecta.com**. El token vigente (formato `sk_...`) corresponde a la plataforma nueva, mientras el código seguía apuntando al host/versión antiguos.

## Opciones consideradas

1. Mantener `api.apis.net.pe/v2`: ya no resuelve correctamente con el token nuevo.
2. **Migrar a `api.decolecta.com/v1` (elegida):** host y versión que corresponden al token `sk_`.

## Decisión

Usar **decolecta.com v1** para las consultas:

- RUC: `https://api.decolecta.com/v1/sunat/ruc?numero={ruc}` (y `/sunat/ruc/full` para datos extendidos).
- DNI: `https://api.decolecta.com/v1/reniec/dni?numero={dni}`.
- Header `Authorization: Bearer {token}` + `Accept: application/json`. Token (`APISNET_TOKEN`) en Secret Manager.
- `baseUrl` se guarda en `integrations/apisnet` (config no-secreta) para no hardcodear.

Esta API es **solo para enriquecimiento de datos**; NO valida comprobantes (eso lo hace la API oficial de validez de SUNAT, integración aparte `sunat-consulta`).

## Consecuencias

- Los nombres de campo de decolecta difieren del apis.net antiguo (ej. `full_name`, `first_name`, `first_last_name` para DNI) → el mapeo de salida se ajusta a esos campos.
- Las consultas corren en backend (Cloud Functions), nunca desde el navegador.
- Si el proveedor vuelve a migrar, solo cambia `baseUrl` en `integrations/apisnet` y, de ser necesario, el mapeo de campos.
