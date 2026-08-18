import { describe, it, expect } from "vitest";
import { buildAggregateStatusFilter, buildListStatusFilter, buildAlgoliaStatusFilter } from "./salesAggregateLogic";

describe("salesAggregateLogic - Lógica de Agregados de Ventas (RED PHASE)", () => {
  // 1. statusFilter 'ALL' -> statuses === ['COMPLETED']. NO incluye QUOTATION ni CONVERTED.
  it("1. statusFilter 'ALL' para agregados debe incluir ÚNICAMENTE ['COMPLETED']", () => {
    const result = buildAggregateStatusFilter("ALL");
    expect(result.statuses).toEqual(["COMPLETED"]);
    expect(result.statuses).not.toContain("QUOTATION");
    expect(result.statuses).not.toContain("CONVERTED");
  });

  // 2. statusFilter 'ALL' -> label === 'Vendido'
  it("2. statusFilter 'ALL' debe tener label 'Vendido'", () => {
    const result = buildAggregateStatusFilter("ALL");
    expect(result.label).toBe("Vendido");
  });

  // 3. statusFilter 'QUOTATION' -> statuses === ['QUOTATION'], label === 'Cotizado'
  it("3. statusFilter 'QUOTATION' debe incluir ['QUOTATION'] y label 'Cotizado'", () => {
    const result = buildAggregateStatusFilter("QUOTATION");
    expect(result.statuses).toEqual(["QUOTATION"]);
    expect(result.label).toBe("Cotizado");
  });

  // 4. statusFilter 'CONVERTED' -> statuses === ['CONVERTED'], label === 'Cotizado'
  it("4. statusFilter 'CONVERTED' debe incluir ['CONVERTED'] y label 'Cotizado'", () => {
    const result = buildAggregateStatusFilter("CONVERTED");
    expect(result.statuses).toEqual(["CONVERTED"]);
    expect(result.label).toBe("Cotizado");
  });

  // 5. statusFilter 'COMPLETED' -> statuses === ['COMPLETED'], label === 'Vendido'
  it("5. statusFilter 'COMPLETED' debe incluir ['COMPLETED'] y label 'Vendido'", () => {
    const result = buildAggregateStatusFilter("COMPLETED");
    expect(result.statuses).toEqual(["COMPLETED"]);
    expect(result.label).toBe("Vendido");
  });

  // 6. statusFilter 'VOIDED' / 'CANCELLED' -> NO cuentan como venta (statuses vacío)
  it("6. statusFilter 'VOIDED' o 'CANCELLED' no cuentan para agregados (statuses vacío)", () => {
    const resVoided = buildAggregateStatusFilter("VOIDED");
    const resCancelled = buildAggregateStatusFilter("CANCELLED");
    expect(resVoided.statuses).toEqual([]);
    expect(resCancelled.statuses).toEqual([]);
  });

  // 7. Frente #9-A: buildListStatusFilter('ALL') = whitelist de venta real (COMPLETED + VOIDED),
  // ya NO incluye QUOTATION/CONVERTED — esas perchas viven en /admin/quotations.
  it("7. Frente #9-A: buildListStatusFilter('ALL') incluye ÚNICAMENTE COMPLETED y VOIDED", () => {
    const listStatuses = buildListStatusFilter("ALL");
    expect(listStatuses).toEqual(["COMPLETED", "VOIDED"]);
    expect(listStatuses).not.toContain("QUOTATION");
    expect(listStatuses).not.toContain("CONVERTED");
  });

  // 8. buildListStatusFilter con un status concreto (ej. 'QUOTATION') sigue pasando 1:1, sin whitelist.
  it("8. buildListStatusFilter con status concreto no aplica whitelist, pasa el valor tal cual", () => {
    expect(buildListStatusFilter("QUOTATION")).toEqual(["QUOTATION"]);
    expect(buildListStatusFilter("VOIDED")).toEqual(["VOIDED"]);
  });

  // 9. Frente #9-B.1: buildAlgoliaStatusFilter('ALL') arma el OR del whitelist, con paréntesis
  // (necesario para componer con AND de otros filtros sin que Algolia lo parsee mal).
  it("9. buildAlgoliaStatusFilter('ALL') produce '(status:COMPLETED OR status:VOIDED)'", () => {
    expect(buildAlgoliaStatusFilter("ALL")).toBe("(status:COMPLETED OR status:VOIDED)");
  });

  // 10. buildAlgoliaStatusFilter con status concreto produce un solo término, igual entre paréntesis.
  it("10. buildAlgoliaStatusFilter('COMPLETED') produce '(status:COMPLETED)'", () => {
    expect(buildAlgoliaStatusFilter("COMPLETED")).toBe("(status:COMPLETED)");
  });

  // 11. Misma fuente que buildListStatusFilter: cualquier status concreto se refleja 1:1.
  it("11. buildAlgoliaStatusFilter('QUOTATION') produce '(status:QUOTATION)' (sin whitelist)", () => {
    expect(buildAlgoliaStatusFilter("QUOTATION")).toBe("(status:QUOTATION)");
  });
});
