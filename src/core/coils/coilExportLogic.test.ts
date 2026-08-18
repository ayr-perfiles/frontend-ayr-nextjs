import { describe, it, expect } from "vitest";
import { buildCoilExportRows, buildCoilExportSummary } from "./coilExportLogic";
import { Coil } from "@/types";

function mkCoil(overrides: Partial<Coil> & { id: string }): Coil {
  return {
    initialWeight: 1000,
    currentWeight: 1000,
    masterWidth: 1220,
    thickness: 0.3,
    finish: "ALZ-ROJO-3020",
    pricePerKg: 5,
    status: "AVAILABLE",
    metadata: {
      provider: "PROVEEDOR TEST",
      invoiceNumber: "F001-1",
      currency: "PEN",
      exchangeRate: 1,
    },
    ...overrides,
  } as Coil;
}

const fixture: Coil[] = [
  mkCoil({ id: "AVAIL-1", status: "AVAILABLE", initialWeight: 1000, currentWeight: 1000 }),
  mkCoil({ id: "PROG-1", status: "IN_PROGRESS", initialWeight: 1000, currentWeight: 400 }),
  mkCoil({ id: "NEG-1", status: "PROCESSED", initialWeight: 500, currentWeight: -20 }),
  mkCoil({ id: "VOID-1", status: "VOIDED", initialWeight: 800, currentWeight: 800 }),
];

describe("buildCoilExportRows", () => {
  it("mapea las 13 columnas existentes + Estado + Observaciones, una fila por bobina", () => {
    const rows = buildCoilExportRows(fixture);
    expect(rows).toHaveLength(4);
    expect(Object.keys(rows[0])).toEqual([
      "ID Bobina",
      "Acabado",
      "Proveedor",
      "Factura N°",
      "Fecha de Compra",
      "Espesor (mm)",
      "Ancho Maestro (mm)",
      "Peso Compra (Kg)",
      "Stock Actual (Kg)",
      "Costo Unitario (S/ por Kg)",
      "Valorización Total (S/)",
      "Moneda Original",
      "Tipo de Cambio",
      "Estado",
      "Observaciones",
    ]);
  });

  it("traduce el status a la misma etiqueta que StatusBadge (InventoryTable)", () => {
    const rows = buildCoilExportRows(fixture);
    expect(rows.find((r) => r["ID Bobina"] === "AVAIL-1")!.Estado).toBe("DISPONIBLE");
    expect(rows.find((r) => r["ID Bobina"] === "PROG-1")!.Estado).toBe("EN PROCESO");
    expect(rows.find((r) => r["ID Bobina"] === "NEG-1")!.Estado).toBe("PROCESADA");
    expect(rows.find((r) => r["ID Bobina"] === "VOID-1")!.Estado).toBe("ANULADA");
  });

  it("marca Observaciones para peso negativo y para anuladas; vacío si no aplica", () => {
    const rows = buildCoilExportRows(fixture);
    expect(rows.find((r) => r["ID Bobina"] === "AVAIL-1")!.Observaciones).toBe("");
    expect(rows.find((r) => r["ID Bobina"] === "PROG-1")!.Observaciones).toBe("");
    expect(rows.find((r) => r["ID Bobina"] === "NEG-1")!.Observaciones).toBe("Peso negativo");
    expect(rows.find((r) => r["ID Bobina"] === "VOID-1")!.Observaciones).toBe("Anulada");
  });

  it("una bobina VOIDED con peso negativo lleva ambas observaciones", () => {
    const rows = buildCoilExportRows([
      mkCoil({ id: "VOID-NEG", status: "VOIDED", initialWeight: 300, currentWeight: -5 }),
    ]);
    expect(rows[0].Observaciones).toBe("Peso negativo / Anulada");
  });
});

describe("buildCoilExportSummary", () => {
  it("cuenta por estado y arma el listado de negativas", () => {
    const summary = buildCoilExportSummary(fixture, "Todas");
    expect(summary.filtro).toBe("Todas");
    expect(summary.totalBobinas).toBe(4);
    expect(summary.conteoPorEstado).toEqual({
      DISPONIBLE: 1,
      "EN PROCESO": 1,
      PROCESADA: 1,
      ANULADA: 1,
    });
    expect(summary.negativas).toEqual([{ id: "NEG-1", currentWeight: -20 }]);
  });

  it("el total BRUTO incluye ANULADAS y negativas; el NETO las excluye", () => {
    const summary = buildCoilExportSummary(fixture, "Todas");
    // Bruto: initialWeight de las 4 = 1000+1000+500+800 = 3300; currentWeight = 1000+400-20+800 = 2180
    expect(summary.pesoCompraBrutoKg).toBe(3300);
    expect(summary.stockBrutoKg).toBe(2180);
    // Neto: excluye NEG-1 (negativa) y VOID-1 (anulada) -> solo AVAIL-1 + PROG-1
    expect(summary.pesoCompraNetoKg).toBe(2000);
    expect(summary.stockNetoKg).toBe(1400);
    expect(summary.bobinasExcluidasDelNeto).toBe(2);
  });

  it("sin negativas ni anuladas, bruto y neto coinciden", () => {
    const clean = [
      mkCoil({ id: "A", initialWeight: 100, currentWeight: 100, status: "AVAILABLE" }),
      mkCoil({ id: "B", initialWeight: 200, currentWeight: 50, status: "IN_PROGRESS" }),
    ];
    const summary = buildCoilExportSummary(clean, "Disponibles + En Proceso");
    expect(summary.pesoCompraBrutoKg).toBe(summary.pesoCompraNetoKg);
    expect(summary.stockBrutoKg).toBe(summary.stockNetoKg);
    expect(summary.bobinasExcluidasDelNeto).toBe(0);
    expect(summary.negativas).toEqual([]);
  });

  it("avisoBusqueda aparece con searchTermApplied y no aparece sin él", () => {
    const conSearch = buildCoilExportSummary(fixture, "Todas", "TREAM-ALZ");
    expect(conSearch.avisoBusqueda).toBe(
      "Búsqueda de texto activa: los resultados reflejan la búsqueda 'TREAM-ALZ'.",
    );

    const sinSearch = buildCoilExportSummary(fixture, "Todas");
    expect(sinSearch.avisoBusqueda).toBeUndefined();

    const searchVacio = buildCoilExportSummary(fixture, "Todas", "   ");
    expect(searchVacio.avisoBusqueda).toBeUndefined();
  });
});
