import { describe, it, expect } from "vitest";
import { computeCartTotals, addItemToCart } from "./cartLogic";
import type { CartItem } from "@/services/salesService";

/**
 * ⚠️ RED DE NO-REGRESIÓN DEL POS.
 *
 * `computeCartTotals` y `addItemToCart` salen de código LIVE inline de
 * `src/app/admin/sales/new/page.tsx` (el POS real). Este archivo copia las fórmulas
 * VIEJAS textualmente (bloque REFERENCE de abajo) y assertea que el helper extraído da
 * un resultado IDÉNTICO — antes de borrar el inline.
 *
 * La referencia NO se toca nunca: si alguien cambia el helper, el diff contra el
 * comportamiento original salta acá.
 */

const IGV_RATE = 0.18;

// ── REFERENCE: copia TEXTUAL del inline de new/page.tsx:305-316 (pre-extracción) ──
function referenceTotals(cart: CartItem[], minMarginAlert: number) {
  const totalAmount = cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const totalValue = cart.reduce((s, i) => s + i.quantity * i.unitValue, 0);
  const totalCost = cart.reduce((s, i) => s + i.quantity * i.baseCost, 0);
  const totalIGV = totalAmount - totalValue;
  const totalWeight = cart.reduce((s, i) => s + i.quantity * (i.unitWeight ?? 0), 0);
  const projectedProfit = totalValue - totalCost;
  const marginPercent = totalValue > 0 ? (projectedProfit / totalValue) * 100 : 0;
  return {
    totalAmount,
    totalValue,
    totalCost,
    totalIGV,
    totalWeight,
    projectedProfit,
    marginPercent,
    minMarginAlert,
  };
}

// ── REFERENCE: copia TEXTUAL del inline de new/page.tsx:284-303 (pre-extracción) ──
function referenceAdd(prev: CartItem[], newItem: CartItem): CartItem[] {
  const existingIdx = prev.findIndex(
    (i) =>
      i.sku === newItem.sku &&
      (i.businessLine ?? "drywall") === (newItem.businessLine ?? "drywall"),
  );
  if (existingIdx >= 0) {
    const updated = [...prev];
    updated[existingIdx] = {
      ...updated[existingIdx],
      quantity: updated[existingIdx].quantity + newItem.quantity,
      unitPrice: newItem.unitPrice,
      unitValue: newItem.unitValue,
    };
    return updated;
  }
  return [...prev, newItem];
}

const mk = (o: Partial<CartItem> & { sku: string }): CartItem =>
  ({
    productName: o.sku,
    quantity: 1,
    unitPrice: 118,
    unitValue: 100,
    baseCost: 60,
    businessLine: "metallic-roofing",
    isCoil: false,
    ...o,
  }) as CartItem;

/** Carritos que ejercitan los bordes de las 2 fórmulas. */
const CARTS: Array<{ name: string; cart: CartItem[] }> = [
  { name: "vacío", cart: [] },
  { name: "1 ítem simple", cart: [mk({ sku: "A", quantity: 4, unitWeight: 2 })] },
  {
    name: "multi-ítem con líneas distintas",
    cart: [
      mk({ sku: "A", quantity: 4, unitWeight: 2 }),
      mk({ sku: "B", quantity: 3, unitPrice: 59, unitValue: 50, baseCost: 20, businessLine: "drywall" }),
      mk({ sku: "C", quantity: 1, unitPrice: 10, unitValue: 8.47, baseCost: 0, businessLine: "trading" }),
    ],
  },
  // totalValue 0 -> la división de marginPercent tiene que caer al 0, no a NaN/Infinity.
  { name: "unitValue 0 en todos (marginPercent no debe ser NaN)", cart: [mk({ sku: "A", unitValue: 0, quantity: 5 })] },
  { name: "unitWeight ausente (?? 0)", cart: [mk({ sku: "A", quantity: 3, unitWeight: undefined })] },
  { name: "margen NEGATIVO (venta bajo costo)", cart: [mk({ sku: "A", unitValue: 10, baseCost: 90, quantity: 2 })] },
  { name: "cantidad decimal (coberturas en ML)", cart: [mk({ sku: "A", quantity: 12.5, unitWeight: 1.2 })] },
  { name: "monto 0 legítimo", cart: [mk({ sku: "A", unitPrice: 0, unitValue: 0, baseCost: 0 })] },
];

describe("computeCartTotals — paridad con el inline de new/page.tsx (no-regresión del POS)", () => {
  for (const { name, cart } of CARTS) {
    it(`identico al inline viejo: ${name}`, () => {
      expect(computeCartTotals(cart, 20)).toEqual(referenceTotals(cart, 20));
    });
  }

  it("propaga minMarginAlert tal cual", () => {
    expect(computeCartTotals([], 15).minMarginAlert).toBe(15);
  });

  it("las 7 derivadas + minMarginAlert: 8 claves exactas", () => {
    expect(Object.keys(computeCartTotals([], 20)).sort()).toEqual([
      "marginPercent",
      "minMarginAlert",
      "projectedProfit",
      "totalAmount",
      "totalCost",
      "totalIGV",
      "totalValue",
      "totalWeight",
    ]);
  });

  it("carrito vacío -> todo en 0, marginPercent 0 (no NaN)", () => {
    const t = computeCartTotals([], 20);
    expect(t.totalAmount).toBe(0);
    expect(t.marginPercent).toBe(0);
    expect(Number.isNaN(t.marginPercent)).toBe(false);
  });

  it("no muta el carrito de entrada", () => {
    const cart = [mk({ sku: "A", quantity: 2 })];
    const copia = JSON.parse(JSON.stringify(cart));
    computeCartTotals(cart, 20);
    expect(cart).toEqual(copia);
  });

  it("totalIGV = totalAmount - totalValue (coherente con IGV 18%)", () => {
    const cart = [mk({ sku: "A", quantity: 1, unitPrice: 118, unitValue: 100 })];
    const t = computeCartTotals(cart, 20);
    expect(t.totalIGV).toBeCloseTo(100 * IGV_RATE, 6);
  });
});

describe("addItemToCart — paridad con el inline de new/page.tsx (no-regresión del POS)", () => {
  const base = [mk({ sku: "A", quantity: 2, businessLine: "metallic-roofing" })];

  const CASES: Array<{ name: string; prev: CartItem[]; item: CartItem }> = [
    { name: "carrito vacío -> agrega", prev: [], item: mk({ sku: "A" }) },
    {
      name: "mismo sku + misma línea -> SUMA cantidad y pisa precio",
      prev: base,
      item: mk({ sku: "A", quantity: 3, unitPrice: 200, unitValue: 169.49 }),
    },
    {
      name: "mismo sku pero OTRA línea -> fila nueva (no fusiona)",
      prev: base,
      item: mk({ sku: "A", quantity: 3, businessLine: "drywall" }),
    },
    { name: "sku distinto -> fila nueva", prev: base, item: mk({ sku: "B", quantity: 1 }) },
    {
      name: "businessLine undefined en ambos -> default 'drywall', fusiona",
      prev: [mk({ sku: "Z", quantity: 1, businessLine: undefined })],
      item: mk({ sku: "Z", quantity: 2, businessLine: undefined }),
    },
    {
      name: "businessLine undefined vs 'drywall' explícito -> fusiona (mismo default)",
      prev: [mk({ sku: "Z", quantity: 1, businessLine: undefined })],
      item: mk({ sku: "Z", quantity: 2, businessLine: "drywall" }),
    },
  ];

  for (const { name, prev, item } of CASES) {
    it(`identico al inline viejo: ${name}`, () => {
      expect(addItemToCart(prev, item)).toEqual(referenceAdd(prev, item));
    });
  }

  it("no muta el carrito previo (devuelve uno nuevo)", () => {
    const prev = [mk({ sku: "A", quantity: 2 })];
    const copia = JSON.parse(JSON.stringify(prev));
    const out = addItemToCart(prev, mk({ sku: "A", quantity: 5 }));
    expect(prev).toEqual(copia);
    expect(out).not.toBe(prev);
  });

  it("al fusionar conserva el resto de campos del ítem existente (no lo reemplaza entero)", () => {
    const prev = [mk({ sku: "A", quantity: 2, unitWeight: 7, productName: "NOMBRE VIEJO" })];
    const out = addItemToCart(prev, mk({ sku: "A", quantity: 1, productName: "NOMBRE NUEVO" }));
    expect(out).toHaveLength(1);
    expect(out[0].quantity).toBe(3);
    expect(out[0].unitWeight).toBe(7);
    expect(out[0].productName).toBe("NOMBRE VIEJO"); // el inline solo pisa quantity/unitPrice/unitValue
  });
});
