import { describe, it, expect } from "vitest";
import { buildAggregateStatusFilter, buildListStatusFilter } from "./salesAggregateLogic";

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

  // 7. Anti-regresión LISTA: buildListStatusFilter('ALL') mantiene COMPLETED + QUOTATION + CONVERTED
  it("7. Anti-regresión: buildListStatusFilter('ALL') conserva los 3 estados para la tabla de lista", () => {
    const listStatuses = buildListStatusFilter("ALL");
    expect(listStatuses).toContain("COMPLETED");
    expect(listStatuses).toContain("QUOTATION");
    expect(listStatuses).toContain("CONVERTED");
  });
});
