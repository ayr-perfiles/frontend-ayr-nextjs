import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCoils, CoilFilters } from "./useCoils";
import { fetchInventory } from "../services/coilService";
import { useFinishes } from "./useFinishes";
import type { CoilFinish } from "../services/finishService";

/**
 * Regla del archivo: nunca esperar sobre el MOCK para saber que el hook terminó
 * (`waitFor(() => expect(mock).toHaveBeenCalledTimes(N))`) — eso se cumple en cuanto
 * `fetchInventory` es INVOCADO (síncrono, antes del `await` interno), no cuando la
 * promesa se resuelve y los `setState` posteriores corrieron. Esperar siempre sobre
 * el ESTADO del hook (`result.current.loading`, `.filteredTotal`, etc.), que solo
 * queda asentado después de la resolución real.
 */

vi.mock("../services/coilService", () => ({
  fetchInventory: vi.fn(),
}));

vi.mock("./useFinishes", () => ({
  useFinishes: vi.fn(),
}));

const mockedFetchInventory = vi.mocked(fetchInventory);
const mockedUseFinishes = vi.mocked(useFinishes);

const ALUZINC_FINISH: CoilFinish = {
  id: "ALZ-NATURAL",
  label: "ALUZINC NATURAL",
  active: true,
  lines: ["metallic-roofing"],
};

const baseFilters: CoilFilters = {
  searchTerm: "",
  statusFilter: "ALL",
  startDate: "",
  endDate: "",
  pageSize: 10,
};

const memoryResult = (totalCount: number) => ({
  coils: [],
  isAlgolia: false as const,
  isMemory: true as const,
  firstDoc: null,
  lastDoc: null,
  totalCount,
});

const cursorResult = () => ({
  coils: [],
  isAlgolia: false as const,
  firstDoc: null,
  lastDoc: null,
  totalCount: 0,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useCoils — indexado 0-based (page pasado a fetchInventory)", () => {
  it("mount → page:0, next → page:1, next → page:2, prev → page:1", async () => {
    mockedUseFinishes.mockReturnValue({ finishes: [ALUZINC_FINISH], loading: false, error: null });
    mockedFetchInventory.mockImplementation(async () => memoryResult(100));

    const { result } = renderHook(() =>
      useCoils({ ...baseFilters, lineFilter: "metallic-roofing" }),
    );

    await waitFor(() => expect(result.current.filteredTotal).toBe(100));
    expect(mockedFetchInventory.mock.calls[0][0].page).toBe(0);
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      result.current.nextPage();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockedFetchInventory.mock.calls[1][0].page).toBe(1);

    await act(async () => {
      result.current.nextPage();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockedFetchInventory.mock.calls[2][0].page).toBe(2);

    await act(async () => {
      result.current.prevPage();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockedFetchInventory.mock.calls[3][0].page).toBe(1);
  });
});

describe("useCoils — guard (a): finishes todavía cargando", () => {
  it("con lineFilter y finishes cargando, NO fetchea y queda loading:true", async () => {
    mockedUseFinishes.mockReturnValue({ finishes: [], loading: true, error: null });
    mockedFetchInventory.mockImplementation(async () => memoryResult(0));

    const { result } = renderHook(() =>
      useCoils({ ...baseFilters, lineFilter: "metallic-roofing" }),
    );

    // No hay estado que esperar (nada async va a resolver esto — el guard corta antes
    // de tocar loading). Igual dejamos correr los microtasks pendientes ANTES de leer
    // el 0: un 0 asserteado antes de tiempo es un 0 garantizado, no una prueba de nada.
    await act(async () => {});

    expect(mockedFetchInventory).toHaveBeenCalledTimes(0);
    expect(result.current.loading).toBe(true);
  });
});

describe("useCoils — guard (b): línea sin finishes activos (spinner eterno)", () => {
  it("con lineFilter y finishes ya cargados pero [], NO fetchea y queda vacío honesto", async () => {
    mockedUseFinishes.mockReturnValue({ finishes: [], loading: false, error: null });
    mockedFetchInventory.mockImplementation(async () => memoryResult(0));

    const { result } = renderHook(() =>
      useCoils({ ...baseFilters, lineFilter: "metallic-roofing" }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockedFetchInventory).toHaveBeenCalledTimes(0);
    expect(result.current.coils).toEqual([]);
    expect(result.current.filteredTotal).toBe(0);
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe("useCoils — no-regresión: bobinas-supervisor (sin lineFilter)", () => {
  it("sin lineFilter, fetchea de inmediato sin esperar los finishes, con lineFinishIds undefined", async () => {
    mockedUseFinishes.mockReturnValue({ finishes: [], loading: true, error: null });
    mockedFetchInventory.mockImplementation(async () => cursorResult());

    const { result } = renderHook(() => useCoils({ ...baseFilters, pageSize: 9999 }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockedFetchInventory).toHaveBeenCalledTimes(1);
    expect(mockedFetchInventory.mock.calls[0][0].lineFinishIds).toBeUndefined();
  });
});

describe("useCoils — estabilidad (riesgo de bucle infinito)", () => {
  it("re-renderizar 3 veces sin cambiar filtros no dispara fetchs nuevos", async () => {
    mockedUseFinishes.mockReturnValue({ finishes: [ALUZINC_FINISH], loading: false, error: null });
    mockedFetchInventory.mockImplementation(async () => memoryResult(100));

    const filters: CoilFilters = { ...baseFilters, lineFilter: "metallic-roofing" };
    const { result, rerender } = renderHook((props: CoilFilters) => useCoils(props), {
      initialProps: filters,
    });

    // Asentado ANTES de re-renderizar: si re-renderizamos a mitad de una carga en
    // curso, un segundo llamado podría deberse a esa carga en vuelo, no a las deps.
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ ...baseFilters, lineFilter: "metallic-roofing" });
    rerender({ ...baseFilters, lineFilter: "metallic-roofing" });
    rerender({ ...baseFilters, lineFilter: "metallic-roofing" });

    expect(mockedFetchInventory).toHaveBeenCalledTimes(1);
  });
});
