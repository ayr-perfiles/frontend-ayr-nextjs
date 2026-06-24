import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import {
  setupIntegrationTest,
  clearFirestore,
  cleanupIntegrationTest,
} from './firestore-helpers';

import { db } from "@/lib/firebase/clientApp";
vi.unmock('@/lib/firebase/clientApp');

import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { annulSale } from "@/core/sales/services/salesService";
import { runTransaction } from "firebase/firestore";
import { getStockStrategy, StockStrategy } from "@/core/sales/strategies";
import { BusinessLine } from "@/types";

describe("Sales Reversal WAC calculation", () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  beforeEach(async () => {
    await clearFirestore();
  });

  afterAll(async () => {
    await cleanupIntegrationTest(null as any, db);
  });

  const TEST_SKU = "TEST-WAC-REVERSAL";
  const TEST_SALE_ID = "V-TEST-WAC-1";

  const setupStock = async (collectionName: string, quantity: number, avgCost: number) => {
    const stockRef = doc(db, collectionName, TEST_SKU);
    await setDoc(stockRef, {
      sku: TEST_SKU,
      quantity,
      avgCost,
      totalValue: quantity * avgCost,
    });
  };

  const setupSale = async (businessLine: BusinessLine, quantity: number, frozenCost: number) => {
    const saleRef = doc(db, "sales", TEST_SALE_ID);
    await setDoc(saleRef, {
      status: "COMPLETED",
      customerName: "Test Customer",
      items: [
        {
          sku: TEST_SKU,
          quantity,
          baseCost: frozenCost,
          businessLine,
        },
      ],
    });
  };

  const cleanup = async (collectionName: string) => {
    await deleteDoc(doc(db, collectionName, TEST_SKU));
    await deleteDoc(doc(db, "sales", TEST_SALE_ID));
  };

  const testStrategyWAC = async (businessLine: BusinessLine, collectionName: string) => {
    // 1. Setup sale with frozen cost 10
    await setupSale(businessLine, 5, 10);

    // 2. Setup current stock with DIFFERENT cost (simulating a purchase happened after sale)
    // 5 units at cost 20. Total value = 100
    await setupStock(collectionName, 5, 20);

    // 3. Annul sale
    await annulSale({ saleId: TEST_SALE_ID, userEmail: "test@test.com" });

    // 4. Assert
    const stockSnap = await getDoc(doc(db, collectionName, TEST_SKU));
    const data = stockSnap.data()!;

    // Expected:
    // Returned 5 units * 10 (frozenCost) = 50 value
    // Current stock: 5 units * 20 = 100 value
    // New total quantity = 10
    // New total value = 150
    // New WAC = 150 / 10 = 15
    expect(data.quantity).toBe(10);
    expect(data.totalValue).toBeCloseTo(150, 2);
    expect(data.avgCost).toBeCloseTo(15, 2);

    await cleanup(collectionName);
  };

  it("should calculate WAC correctly for metallic-roofing", async () => {
    await testStrategyWAC("metallic-roofing", "metallic_roofing_stock");
  });

  it("should calculate WAC correctly for trading", async () => {
    await testStrategyWAC("trading", "trading_stock");
  });

  it("should calculate WAC correctly for roofing", async () => {
    await testStrategyWAC("roofing", "roofing_stock");
  });

  it("should handle quantity returning to 0 without NaN", async () => {
    const collectionName = "metallic_roofing_stock";
    await setupSale("metallic-roofing", 5, 10);
    // Set stock to -5 units with 0 avgCost (stock was oversold to 0 previously, maybe?)
    // Actually, if we return to exactly 0 balance...
    // Let's set stock to -5. The return of 5 units makes balance 0.
    const stockRef = doc(db, collectionName, TEST_SKU);
    await setDoc(stockRef, {
      sku: TEST_SKU,
      quantity: -5,
      avgCost: 10,
      totalValue: -50,
    });

    await annulSale({ saleId: TEST_SALE_ID, userEmail: "test@test.com" });

    const stockSnap = await getDoc(doc(db, collectionName, TEST_SKU));
    const data = stockSnap.data()!;
    expect(data.quantity).toBe(0);
    expect(data.avgCost).toBe(0);
    expect(data.totalValue).toBe(0);

    await cleanup(collectionName);
  });

  it("should enforce idempotency: aborts on double annulment", async () => {
    const collectionName = "metallic_roofing_stock";
    await setupSale("metallic-roofing", 5, 10);
    await setupStock(collectionName, 5, 20);

    await annulSale({ saleId: TEST_SALE_ID, userEmail: "test@test.com" });

    await expect(
      annulSale({ saleId: TEST_SALE_ID, userEmail: "test@test.com" })
    ).rejects.toThrow("Esta venta ya ha sido anulada.");

    await cleanup(collectionName);
  });
});
