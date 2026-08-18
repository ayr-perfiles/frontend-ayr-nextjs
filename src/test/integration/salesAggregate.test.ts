import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import {
  setupIntegrationTest,
  clearFirestore,
  cleanupIntegrationTest
} from './firestore-helpers';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';
import { fetchSales } from "@/core/sales/services/salesService";

vi.unmock("@/lib/firebase/clientApp");

describe("Agregados Sales - Corrección de Doble Conteo (RED PHASE)", () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest();
  });

  beforeEach(async () => {
    await clearFirestore();

    // Sembrado de los 4 docs de prueba con montos exactos
    const baseDate = new Date("2026-06-15T12:00:00.000Z");

    await setDoc(doc(db, "sales", "V-TEST-A"), {
      documentNumber: "V-TEST-A",
      customerName: "CLIENTE A",
      status: "COMPLETED",
      totalAmount: 1000,
      totalProfit: 200,
      totalWeight: 100,
      timestamp: baseDate,
      items: [{ sku: "P25GALV", quantity: 10, unitPrice: 100, businessLine: "drywall" }],
      businessLines: ["drywall"],
    });

    await setDoc(doc(db, "sales", "C-TEST-B"), {
      documentNumber: "C-TEST-B",
      customerName: "CLIENTE B",
      status: "QUOTATION",
      totalAmount: 500,
      totalProfit: 100,
      totalWeight: 50,
      timestamp: baseDate,
      items: [{ sku: "COB030ROJO", quantity: 50, unitPrice: 10, businessLine: "metallic-roofing" }],
      businessLines: ["metallic-roofing"],
    });

    await setDoc(doc(db, "sales", "C-TEST-C"), {
      documentNumber: "C-TEST-C",
      customerName: "CLIENTE C",
      status: "CONVERTED",
      convertedToId: "V-TEST-D",
      totalAmount: 381.6,
      totalProfit: 70,
      totalWeight: 40,
      timestamp: baseDate,
      items: [{ sku: "COB030ROJO", quantity: 38.16, unitPrice: 10, businessLine: "metallic-roofing" }],
      businessLines: ["metallic-roofing"],
    });

    await setDoc(doc(db, "sales", "V-TEST-D"), {
      documentNumber: "V-TEST-D",
      customerName: "CLIENTE C",
      status: "COMPLETED",
      originQuoteId: "C-TEST-C",
      totalAmount: 381.6,
      totalProfit: 70,
      totalWeight: 40,
      timestamp: baseDate,
      items: [{ sku: "COB030ROJO", quantity: 38.16, unitPrice: 10, businessLine: "metallic-roofing" }],
      businessLines: ["metallic-roofing"],
    });
  });

  // 8. Agregado con statusFilter 'ALL' -> totalAmount === 1381.60 EXACTO (Hoy da 2263.20)
  it("8. Agregado totalAmount con statusFilter 'ALL' debe dar 1381.60 (Ventas COMPLETED) sin duplicar", async () => {
    const result = await fetchSales({ pageSize: 10, statusFilter: "ALL", searchTerm: "", startDate: "", endDate: "", skipAggregates: false });
    // En la FASE RED, la implementación actual de fetchSales suma 1000 + 500 + 381.60 + 381.60 = 2263.20
    expect(result.aggregates?.totalAmount).toBe(1381.6); // FAILS IN RED! Expected: 1381.60, Received: 2263.20
  });

  // 9. Agregado con statusFilter 'QUOTATION' -> totalAmount === 500
  it("9. Agregado totalAmount con statusFilter 'QUOTATION' debe ser 500.00", async () => {
    const result = await fetchSales({ pageSize: 10, statusFilter: "QUOTATION", searchTerm: "", startDate: "", endDate: "", skipAggregates: false });
    expect(result.aggregates?.totalAmount).toBe(500.0);
  });

  // 10. Conteo en statusFilter 'ALL' para agregados debe dar 2 (no 4)
  it("10. Conteo de ventas (count) en statusFilter 'ALL' para agregados debe ser 2 (solo COMPLETED)", async () => {
    const result = await fetchSales({ pageSize: 10, statusFilter: "ALL", searchTerm: "", startDate: "", endDate: "", skipAggregates: false });
    expect(result.totalCount).toBe(2); // FAILS IN RED! Expected: 2, Received: 4
  });

  // 11. Frente #9-A: la LISTA en 'ALL' ahora es whitelist de venta real (COMPLETED+VOIDED) —
  // las cotizaciones (QUOTATION/CONVERTED) quedan afuera de /admin/sales, viven en /admin/quotations.
  it("11. Frente #9-A: La LISTA (tabla) en statusFilter 'ALL' devuelve solo los 2 COMPLETED, sin las cotizaciones", async () => {
    const result = await fetchSales({ pageSize: 10, statusFilter: "ALL", searchTerm: "", startDate: "", endDate: "", skipAggregates: true });
    expect(result.sales.length).toBe(2);
    expect(result.sales.map((s) => s.documentNumber).sort()).toEqual(["V-TEST-A", "V-TEST-D"]);
  });

  // 12. Guard de array vacío: statusFilter 'VOIDED' no lanza excepción y retorna agregados en 0 sin consultar Firestore
  it("12. Guard de array vacío: statusFilter 'VOIDED' retorna ceros sin lanzar excepción", async () => {
    const result = await fetchSales({ pageSize: 10, statusFilter: "VOIDED", searchTerm: "", startDate: "", endDate: "", skipAggregates: false });
    expect(result.totalCount).toBe(0);
    expect(result.aggregates).toEqual({ totalAmount: 0, totalProfit: 0, totalWeight: 0 });
  });

  // 13. Frente #9-A: statusFilter 'ALL' ahora coincide listTotalCount (2) y aggregateCount (2) —
  // ambos son whitelist de venta real (COMPLETED+VOIDED para la lista, COMPLETED para el agregado
  // de dinero), sin las 2 cotizaciones del fixture (QUOTATION/CONVERTED) de por medio.
  it("13. Frente #9-A: statusFilter 'ALL' retorna listTotalCount (2) y aggregateCount (2) sin cotizaciones", async () => {
    const result = await fetchSales({ pageSize: 10, statusFilter: "ALL", searchTerm: "", startDate: "", endDate: "", skipAggregates: false });
    expect((result as any).listTotalCount).toBe(2);
    expect(result.totalCount).toBe(2);
  });

  // 14. FIX PIE DE TABLA: statusFilter 'QUOTATION' retorna listTotalCount === 1 y aggregateCount === 1
  it("14. FIX PIE DE TABLA: statusFilter 'QUOTATION' coincide en listTotalCount (1) y aggregateCount (1)", async () => {
    const result = await fetchSales({ pageSize: 10, statusFilter: "QUOTATION", searchTerm: "", startDate: "", endDate: "", skipAggregates: false });
    expect((result as any).listTotalCount).toBe(1);
    expect(result.totalCount).toBe(1);
  });

  // 15. FIX PIE DE TABLA: statusFilter 'VOIDED' retorna listTotalCount === 0 sin lanzar excepción
  it("15. FIX PIE DE TABLA: statusFilter 'VOIDED' retorna listTotalCount 0 sin excepción de Firestore", async () => {
    const result = await fetchSales({ pageSize: 10, statusFilter: "VOIDED", searchTerm: "", startDate: "", endDate: "", skipAggregates: false });
    expect((result as any).listTotalCount).toBe(0);
    expect(result.totalCount).toBe(0);
  });
});



