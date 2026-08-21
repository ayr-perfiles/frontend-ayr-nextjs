import { describe, it, expect, vi } from "vitest";
import { roofingStockStrategy } from "../roofingStockStrategy";
import { tradingStockStrategy } from "../tradingStockStrategy";
import { servicesStockStrategy } from "../servicesStockStrategy";
import { drywallStockStrategy } from "../drywallStockStrategy";
import { metallicRoofingStockStrategy } from "../metallicRoofingStockStrategy";
import { getStockStrategy } from "../index";

/** Doble fake mínimo de Firestore Admin: solo lo que writeSaleReversal necesita. */
function makeFakeDb() {
  const tx = { update: vi.fn(), set: vi.fn() };
  const db = {
    collection: vi.fn((name: string) => ({
      doc: vi.fn((id?: string) => ({ __collection: name, __id: id ?? "auto-id" })),
    })),
  };
  return { db: db as any, tx: tx as any };
}

function makeSnap(data: Record<string, unknown> | null) {
  return {
    exists: data !== null,
    data: () => data,
  } as any;
}

describe("roofingStockStrategy.writeSaleReversal", () => {
  it("recalcula avgCost/totalValue con el costo congelado (frozenCost) y escribe movimiento ENTRADA", () => {
    const { db, tx } = makeFakeDb();
    const snap = makeSnap({ quantity: 5, avgCost: 20, totalValue: 100, productName: "Plancha X" });

    roofingStockStrategy.writeSaleReversal(
      { sku: "SKU-R", quantity: 5, newBalance: 10, saleId: "V-1", customerName: "Cliente", sellerId: "seller@x.com", frozenCost: 10 },
      snap,
      tx,
      db,
    );

    // returnedValue = 5*10=50; newTotalValue = 100+50=150; newAvgCost = 150/10 = 15
    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({ __collection: "roofing_stock" }),
      expect.objectContaining({ quantity: 10, avgCost: 15, totalValue: 150 }),
    );
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ __collection: "roofing_stock_movements" }),
      expect.objectContaining({ type: "ENTRADA", quantity: 5, costPerUnit: 10, businessLine: "roofing" }),
    );
  });

  it("snap null (SKU no existía en stock) -> tx.set en vez de update", () => {
    const { db, tx } = makeFakeDb();
    roofingStockStrategy.writeSaleReversal(
      { sku: "SKU-NEW", quantity: 2, newBalance: 2, saleId: "V-2", customerName: "Cliente", sellerId: "seller@x.com", frozenCost: 5 },
      null,
      tx,
      db,
    );
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ __collection: "roofing_stock" }),
      expect.objectContaining({ quantity: 2 }),
    );
  });
});

describe("tradingStockStrategy.writeSaleReversal", () => {
  it("recalcula avgCost/totalValue igual que roofing (mismo molde)", () => {
    const { db, tx } = makeFakeDb();
    const snap = makeSnap({ quantity: 3, avgCost: 8, totalValue: 24, productName: "Item Trading" });

    tradingStockStrategy.writeSaleReversal(
      { sku: "SKU-T", quantity: 2, newBalance: 5, saleId: "V-3", customerName: "Cliente", sellerId: "seller@x.com", frozenCost: 4 },
      snap,
      tx,
      db,
    );

    // returnedValue=2*4=8; newTotalValue=24+8=32; newAvgCost=32/5=6.4
    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({ __collection: "trading_stock" }),
      expect.objectContaining({ quantity: 5, avgCost: 6.4, totalValue: 32 }),
    );
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ __collection: "trading_stock_movements" }),
      expect.objectContaining({ businessLine: "trading" }),
    );
  });
});

describe("servicesStockStrategy (no-op)", () => {
  it("writeSaleReversal no llama tx.update ni tx.set", () => {
    const { db, tx } = makeFakeDb();
    servicesStockStrategy.writeSaleReversal(
      { sku: "SERVICE-1", quantity: 1, newBalance: 1, saleId: "V-4", customerName: "Cliente", sellerId: "seller@x.com" },
      null,
      tx,
      db,
    );
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.set).not.toHaveBeenCalled();
  });

  it("getStockRef apunta a _noop_stock", () => {
    const { db } = makeFakeDb();
    const ref = servicesStockStrategy.getStockRef("SERVICE-1", db);
    expect((ref as any).__collection).toBe("_noop_stock");
  });

  it("extractQuantity devuelve Infinity (servicios nunca se quedan sin stock)", () => {
    expect(servicesStockStrategy.extractQuantity(makeSnap(null))).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("drywallStockStrategy.writeSaleReversal (agregado aditivo)", () => {
  it("usa totalQuantity (no quantity) y kardex_movements con type IN", () => {
    const { db, tx } = makeFakeDb();
    const snap = makeSnap({ totalQuantity: 100 });

    drywallStockStrategy.writeSaleReversal(
      { sku: "DW-1", quantity: 10, newBalance: 110, saleId: "V-5", customerName: "Cliente", sellerId: "seller@x.com" },
      snap,
      tx,
      db,
    );

    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({ __collection: "inventory_stock" }),
      expect.objectContaining({ totalQuantity: 110 }),
    );
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ __collection: "kardex_movements" }),
      expect.objectContaining({ type: "IN", quantity: 10, balance: 110 }),
    );
  });
});

describe("metallicRoofingStockStrategy.writeAnnulNCDecrement", () => {
  // Primitiva del replay INVERSO de una NC: al importar, una NC con
  // ncStockAction 'RETURNS_STOCK' SUMÓ stock (ENTRADA). Anularla lo saca (SALIDA).
  // El signo lo decide el CALLER via `newBalance`, igual que las otras 2 primitivas.

  it("emite SALIDA con el costo CONGELADO y escribe el balance que le pasa el caller", () => {
    const { db, tx } = makeFakeDb();
    const snap = makeSnap({ quantity: 100, avgCost: 9.5, totalValue: 950, productName: "COBERTURA ROJO" });

    metallicRoofingStockStrategy.writeAnnulNCDecrement!(
      {
        sku: "COB030ROJO",
        quantity: 10,
        newBalance: 90, // el caller ya restó
        saleId: "FFC1-44",
        customerName: "LITAN E.I.R.L.",
        sellerId: "admin@ayr.com",
        frozenCost: 7.86,
        ref: "FFA1-780",
      },
      snap,
      tx,
      db,
    );

    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({ __collection: "metallic_roofing_stock" }),
      expect.objectContaining({ quantity: 90 }),
    );
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ __collection: "metallic_roofing_stock_movements" }),
      expect.objectContaining({
        sku: "COB030ROJO",
        type: "SALIDA",
        quantity: 10,
        costPerUnit: 7.86,
        reason: "Anulación NC FFC1-44 — LITAN E.I.R.L.",
        adjustedDocument: "FFA1-780",
        businessLine: "metallic-roofing",
        createdBy: "admin@ayr.com",
      }),
    );
  });

  it("sin frozenCost -> costPerUnit 0; sin ref -> adjustedDocument null", () => {
    const { db, tx } = makeFakeDb();
    const snap = makeSnap({ quantity: 5, avgCost: 3, totalValue: 15, productName: "X" });

    metallicRoofingStockStrategy.writeAnnulNCDecrement!(
      { sku: "SKU-X", quantity: 2, newBalance: 3, saleId: "NC-1", customerName: "C", sellerId: "u" },
      snap,
      tx,
      db,
    );

    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ __collection: "metallic_roofing_stock_movements" }),
      expect.objectContaining({ type: "SALIDA", costPerUnit: 0, adjustedDocument: null }),
    );
  });

  it("snap inexistente -> tx.set del doc de stock (no update), sin romper", () => {
    const { db, tx } = makeFakeDb();

    metallicRoofingStockStrategy.writeAnnulNCDecrement!(
      { sku: "SKU-NUEVO", quantity: 1, newBalance: -1, saleId: "NC-2", customerName: "C", sellerId: "u" },
      makeSnap(null),
      tx,
      db,
    );

    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ __collection: "metallic_roofing_stock" }),
      expect.objectContaining({ sku: "SKU-NUEVO", quantity: -1 }),
    );
  });

  it("es ADITIVA: las otras 4 strategies NO la implementan (queda undefined)", () => {
    expect(roofingStockStrategy.writeAnnulNCDecrement).toBeUndefined();
    expect(tradingStockStrategy.writeAnnulNCDecrement).toBeUndefined();
    expect(drywallStockStrategy.writeAnnulNCDecrement).toBeUndefined();
    expect(servicesStockStrategy.writeAnnulNCDecrement).toBeUndefined();
  });
});

describe("getStockStrategy (registry)", () => {
  it("devuelve la strategy correcta para cada una de las 5 lineas", () => {
    expect(getStockStrategy("drywall")).toBe(drywallStockStrategy);
    expect(getStockStrategy("roofing")).toBe(roofingStockStrategy);
    expect(getStockStrategy("metallic-roofing").stockCollection).toBe("metallic_roofing_stock");
    expect(getStockStrategy("trading")).toBe(tradingStockStrategy);
    expect(getStockStrategy("services")).toBe(servicesStockStrategy);
  });

  it("linea no soportada -> throw", () => {
    expect(() => getStockStrategy("no-existe")).toThrow("Línea de negocio no soportada: no-existe");
  });
});
