import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockNextQuotationNumber, setCalls } = vi.hoisted(() => ({
  mockNextQuotationNumber: { value: 1 },
  setCalls: [] as Array<{ ref: any; data: any }>,
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db: any, collectionName: string, id?: string) => ({
    __collection: collectionName,
    __id: id,
  })),
  runTransaction: vi.fn(async (_db: any, updateFn: any) => {
    const tx = {
      get: vi.fn(async () => ({
        exists: () => true,
        data: () => ({ nextQuotationNumber: mockNextQuotationNumber.value }),
      })),
      set: vi.fn((ref: any, data: any) => {
        setCalls.push({ ref, data });
      }),
    };
    return updateFn(tx);
  }),
  serverTimestamp: vi.fn(() => "MOCK_SERVER_TIMESTAMP"),
}));

vi.mock("@/lib/algoliaClient", () => ({
  algoliaClient: { searchSingleIndex: vi.fn() },
  ALGOLIA_INDICES: { SALES: "sales_index" },
}));

import { createQuotation } from "./salesService";

describe("createQuotation - productionStatus (RED PHASE)", () => {
  beforeEach(() => {
    setCalls.length = 0;
    mockNextQuotationNumber.value = 1;
  });

  it("1. La cotización comercial (C-xxxxxx) nace con productionStatus 'PENDING'", async () => {
    await createQuotation(
      "MADICOP S.A.C.",
      "20601234567",
      [
        {
          sku: "COB030ROJO",
          quantity: 100,
          unitPrice: 12,
          unitValue: 10.169,
          baseCost: 8,
          unitWeight: 0,
          businessLine: "metallic-roofing",
        } as any,
      ],
      "vendedor@ayrsteel.com",
    );

    const salesSetCall = setCalls.find((c) => c.ref.__collection === "sales");
    expect(salesSetCall).toBeDefined();
    // FAILS IN RED! createQuotation todavía no escribe el campo productionStatus.
    expect(salesSetCall!.data.productionStatus).toBe("PENDING");
  });
});
