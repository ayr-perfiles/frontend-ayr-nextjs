import { describe, it, expect } from "vitest";
import { quoteFulfillmentRows, bucketLogsBySourceId } from "./fulfillmentLogic";

describe("quoteFulfillmentRows", () => {
  it("dos líneas mismo SKU (360+1440), producido 1800 → 1 fila, requested 1800, produced 1800, pending 0, pct 100", () => {
    const items: any[] = [
      { sku: "SKU1", quantity: 360, businessLine: "metallic-roofing" },
      { sku: "SKU1", quantity: 1440, businessLine: "metallic-roofing" }
    ];
    const logs: any[] = [
      { sku: "SKU1", piecesProduced: 1800, status: "ACTIVE" }
    ];
    
    const rows = quoteFulfillmentRows(items, logs);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(expect.objectContaining({
      sku: "SKU1",
      quantityRequested: 1800,
      quantityProduced: 1800,
      pending: 0,
      pct: 100
    }));
  });

  it("dos líneas mismo SKU (360+1440), producido 360 → 1 fila, requested 1800, produced 360, pending 1440, pct 20", () => {
    const items: any[] = [
      { sku: "SKU1", quantity: 360, businessLine: "metallic-roofing" },
      { sku: "SKU1", quantity: 1440, businessLine: "metallic-roofing" }
    ];
    const logs: any[] = [
      { sku: "SKU1", piecesProduced: 360, status: "ACTIVE" }
    ];
    
    const rows = quoteFulfillmentRows(items, logs);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(expect.objectContaining({
      sku: "SKU1",
      quantityRequested: 1800,
      quantityProduced: 360,
      pending: 1440,
      pct: 20
    }));
  });

  it("dos SKUs distintos → 2 filas independientes", () => {
    const items: any[] = [
      { sku: "SKU1", quantity: 100, businessLine: "metallic-roofing" },
      { sku: "SKU2", quantity: 200, businessLine: "metallic-roofing" }
    ];
    const logs: any[] = [
      { sku: "SKU1", piecesProduced: 50, status: "ACTIVE" }
    ];
    
    const rows = quoteFulfillmentRows(items, logs);
    expect(rows).toHaveLength(2);
    expect(rows.find(r => r.sku === "SKU1")?.quantityRequested).toBe(100);
    expect(rows.find(r => r.sku === "SKU2")?.quantityRequested).toBe(200);
  });

  it("logs VOIDED excluidos del produced", () => {
    const items: any[] = [
      { sku: "SKU1", quantity: 100, businessLine: "metallic-roofing" }
    ];
    const logs: any[] = [
      { sku: "SKU1", piecesProduced: 50, status: "ACTIVE" },
      { sku: "SKU1", piecesProduced: 20, status: "VOIDED" }
    ];
    
    const rows = quoteFulfillmentRows(items, logs);
    expect(rows[0].quantityProduced).toBe(50);
    expect(rows[0].pending).toBe(50);
  });

  it("producido 0 → pending = requested, pct 0", () => {
    const items: any[] = [
      { sku: "SKU1", quantity: 100, businessLine: "metallic-roofing" }
    ];
    const logs: any[] = [];
    
    const rows = quoteFulfillmentRows(items, logs);
    expect(rows[0].quantityProduced).toBe(0);
    expect(rows[0].pending).toBe(100);
    expect(rows[0].pct).toBe(0);
  });

  it("sobre-producido (producido > requested) → pending 0; pct igual que queueLogic", () => {
    const items: any[] = [
      { sku: "SKU1", quantity: 100, businessLine: "metallic-roofing" }
    ];
    const logs: any[] = [
      { sku: "SKU1", piecesProduced: 120, status: "ACTIVE" }
    ];
    
    const rows = quoteFulfillmentRows(items, logs);
    expect(rows[0].quantityProduced).toBe(120);
    expect(rows[0].pending).toBe(0);
    expect(rows[0].pct).toBe(120); // (120/100)*100 = 120
  });
});

describe("bucketLogsBySourceId", () => {
  it("dos logs mismo source.id → un bucket con los 2", () => {
    const logs: any[] = [
      { id: "L1", source: { id: "QUOTE1", type: "QUOTE" } },
      { id: "L2", source: { id: "QUOTE1", type: "QUOTE" } }
    ];
    
    const buckets = bucketLogsBySourceId(logs);
    expect(buckets.size).toBe(1);
    expect(buckets.get("QUOTE1")).toHaveLength(2);
    expect(buckets.get("QUOTE1")?.[0].id).toBe("L1");
  });

  it("logs con distinto source.id → buckets separados", () => {
    const logs: any[] = [
      { id: "L1", source: { id: "QUOTE1", type: "QUOTE" } },
      { id: "L2", source: { id: "QUOTE2", type: "QUOTE" } }
    ];
    
    const buckets = bucketLogsBySourceId(logs);
    expect(buckets.size).toBe(2);
    expect(buckets.get("QUOTE1")).toHaveLength(1);
    expect(buckets.get("QUOTE2")).toHaveLength(1);
  });

  it("log sin source / sin source.id → NO aparece en el bucket de ninguna cotización real", () => {
    const logs: any[] = [
      { id: "L1", source: { id: "QUOTE1", type: "QUOTE" } },
      { id: "L2", source: undefined },
      { id: "L3" }
    ];
    
    const buckets = bucketLogsBySourceId(logs);
    
    expect(buckets.size).toBe(1);
    expect(buckets.has("QUOTE1")).toBe(true);
    expect(buckets.get("QUOTE1")).toHaveLength(1);
    expect(buckets.has(undefined as never)).toBe(false);
  });
});
