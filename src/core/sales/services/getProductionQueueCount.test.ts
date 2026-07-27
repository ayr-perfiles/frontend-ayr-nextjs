import { describe, it, expect, vi, beforeEach } from "vitest";

const { getCountFromServerMock, whereMock, queryMock, collectionMock } = vi.hoisted(() => ({
  getCountFromServerMock: vi.fn(),
  whereMock: vi.fn((field: string, op: string, value: any) => ({ field, op, value })),
  queryMock: vi.fn((collRef: any, ...constraints: any[]) => ({ collRef, constraints })),
  collectionMock: vi.fn((_db: any, name: string) => ({ __collection: name })),
}));

vi.mock("firebase/firestore", () => ({
  collection: collectionMock,
  query: queryMock,
  where: whereMock,
  getCountFromServer: getCountFromServerMock,
}));

vi.mock("@/lib/algoliaClient", () => ({
  algoliaClient: { searchSingleIndex: vi.fn() },
  ALGOLIA_INDICES: { SALES: "sales_index" },
}));

import { getProductionQueueCount, PRODUCTION_QUEUE_FILTER } from "./salesService";

describe("getProductionQueueCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("arma la query con los 3 filtros exactos de la cola (status/productionStatus/businessLines) y devuelve el count crudo", async () => {
    getCountFromServerMock.mockResolvedValue({ data: () => ({ count: 23 }) });

    const result = await getProductionQueueCount();

    expect(collectionMock).toHaveBeenCalledWith(expect.anything(), "sales");
    expect(whereMock).toHaveBeenCalledWith("status", "==", "QUOTATION");
    expect(whereMock).toHaveBeenCalledWith("productionStatus", "==", "CONFIRMED");
    expect(whereMock).toHaveBeenCalledWith("businessLines", "array-contains", "metallic-roofing");
    expect(getCountFromServerMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(23);
  });

  it("no usa getDocs -- es una agregación, cero lectura de documentos", async () => {
    getCountFromServerMock.mockResolvedValue({ data: () => ({ count: 0 }) });
    await getProductionQueueCount();
    // getCountFromServer es la única vía de datos consumida (ver mock de arriba: no se mockea getDocs)
    expect(getCountFromServerMock).toHaveBeenCalled();
  });

  it("PRODUCTION_QUEUE_FILTER es la fuente única del criterio (mismo criterio que la página de la cola)", () => {
    expect(PRODUCTION_QUEUE_FILTER).toEqual({
      status: "QUOTATION",
      productionStatus: "CONFIRMED",
      businessLine: "metallic-roofing",
    });
  });
});
