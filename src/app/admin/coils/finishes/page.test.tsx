import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import FinishesPage from "./page";
import * as finishService from "@/core/coils/services/finishService";
import type { CoilFinish } from "@/core/coils/services/finishService";

// `useFinishes` NO se mockea a propósito: el mecanismo bajo prueba ES el refetch
// del hook. Se mockea la capa de datos (finishService), que es la frontera real.
vi.mock("@/core/coils/services/finishService", async (importOriginal) => {
  const real = await importOriginal<typeof finishService>();
  return {
    ...real, // conserva formatFinishChip/getFinishMeta (helpers puros que la página usa)
    listFinishes: vi.fn(),
    updateFinish: vi.fn(),
    createFinish: vi.fn(),
    migrateFinishDensityFactors: vi.fn(),
  };
});

const mockList = vi.mocked(finishService.listFinishes);
const mockUpdate = vi.mocked(finishService.updateFinish);
const mockMigrate = vi.mocked(finishService.migrateFinishDensityFactors);

const FINISH_A: CoilFinish = {
  id: "ALU-AZUL",
  label: "ALUZINC AZUL",
  active: true,
  lines: ["metallic-roofing"],
  densityFactor: 0.008,
  tipo: "Prepintado",
  color: "Azul",
};
const FINISH_A_EDITADO: CoilFinish = { ...FINISH_A, label: "ALUZINC AZUL RAL 5002" };

let reloadSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // resetAllMocks (no clearAllMocks): `clearAllMocks` NO vacía la cola de
  // `mockResolvedValueOnce`, así que un valor sin consumir de un test se filtra
  // al siguiente y produce fallos en CASCADA que no son señal real.
  vi.resetAllMocks();
  // jsdom no deja espiar window.location.reload directo: se redefine el objeto.
  reloadSpy = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { ...window.location, reload: reloadSpy, assign: vi.fn(), replace: vi.fn() },
  });
});

describe("FinishesPage — refresco sin recarga de página ([NAV-B-FINISHES])", () => {
  it("tras Guardar, la lista refleja el cambio SIN llamar a window.location.reload()", async () => {
    // 1ª carga: label viejo. 2ª carga (la del refetch): label nuevo.
    mockList.mockResolvedValueOnce([FINISH_A]).mockResolvedValueOnce([FINISH_A_EDITADO]);
    mockUpdate.mockResolvedValue(undefined as never);

    render(<FinishesPage />);
    expect(await screen.findByText("ALUZINC AZUL")).toBeInTheDocument();

    // Entrar a edición: formData queda precargado con un acabado válido.
    fireEvent.click(screen.getByTitle("Editar acabado ALU-AZUL"));
    fireEvent.click(await screen.findByRole("button", { name: /Guardar Acabado/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));

    // El mecanismo: la lista se re-consulta y muestra el dato nuevo…
    expect(await screen.findByText("ALUZINC AZUL RAL 5002")).toBeInTheDocument();
    expect(mockList).toHaveBeenCalledTimes(2);
    // …y NO por recargar la página.
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("tras Migrar Factores, re-consulta la lista SIN recargar la página", async () => {
    mockList.mockResolvedValueOnce([FINISH_A]).mockResolvedValueOnce([FINISH_A_EDITADO]);
    mockMigrate.mockResolvedValue(undefined as never);

    render(<FinishesPage />);
    expect(await screen.findByText("ALUZINC AZUL")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Migrar Factores/i }));

    await waitFor(() => expect(mockMigrate).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("ALUZINC AZUL RAL 5002")).toBeInTheDocument();
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("NO re-consulta ni recarga si el guardado falla (el error no debe disparar refetch)", async () => {
    mockList.mockResolvedValue([FINISH_A]);
    mockUpdate.mockRejectedValue(new Error("boom"));

    render(<FinishesPage />);
    expect(await screen.findByText("ALUZINC AZUL")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Editar acabado ALU-AZUL"));
    fireEvent.click(await screen.findByRole("button", { name: /Guardar Acabado/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockList).toHaveBeenCalledTimes(1); // solo la carga inicial
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
