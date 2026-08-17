import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTipoCambio } from "./tipoCambio";

function mockFetch(impl: () => Promise<{ ok: boolean; json: () => Promise<{ venta?: string; fallback?: boolean }> }>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchTipoCambio", () => {
  it("res ok con venta string -> parsea a numero, fallback false", async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ venta: "3.75" }) }));
    expect(await fetchTipoCambio("2026-08-17")).toEqual({ venta: 3.75, fallback: false });
  });

  it("res ok con fallback:true -> respeta venta y fallback", async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ venta: "3.60", fallback: true }) }));
    expect(await fetchTipoCambio("2026-08-17")).toEqual({ venta: 3.6, fallback: true });
  });

  it("res no ok (500) -> venta null, fallback true", async () => {
    mockFetch(async () => ({ ok: false, json: async () => ({}) }));
    expect(await fetchTipoCambio("2026-08-17")).toEqual({ venta: null, fallback: true });
  });

  it("fetch lanza excepcion -> venta null, fallback true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    expect(await fetchTipoCambio("2026-08-17")).toEqual({ venta: null, fallback: true });
  });

  it("res ok sin venta -> venta null, fallback true", async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({}) }));
    expect(await fetchTipoCambio("2026-08-17")).toEqual({ venta: null, fallback: true });
  });
});
