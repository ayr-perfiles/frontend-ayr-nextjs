import { Coil } from "@/types";

/** Mismo vocabulario que StatusBadge en InventoryTable.tsx — una sola fuente de verdad visual. */
const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "DISPONIBLE",
  IN_PROGRESS: "EN PROCESO",
  PROCESSED: "PROCESADA",
  VOIDED: "ANULADA",
  EN_TERCERO: "EN TERCERO",
  SOLD: "VENDIDA",
  SPLIT_PARENT: "PARTIDA",
};

function statusLabel(status: string | undefined): string {
  if (!status) return "—";
  return STATUS_LABELS[status] ?? status;
}

function buildObservaciones(coil: Coil): string {
  const notes: string[] = [];
  if ((coil.currentWeight ?? 0) < 0) notes.push("Peso negativo");
  if (coil.status === "VOIDED") notes.push("Anulada");
  return notes.join(" / ");
}

export interface CoilExportRow {
  "ID Bobina": string;
  Acabado: string;
  Proveedor: string;
  "Factura N°": string;
  "Fecha de Compra": string;
  "Espesor (mm)": number | undefined;
  "Ancho Maestro (mm)": number | undefined;
  "Peso Compra (Kg)": number;
  "Stock Actual (Kg)": number;
  "Costo Unitario (S/ por Kg)": number;
  "Valorización Total (S/)": number;
  "Moneda Original": string;
  "Tipo de Cambio": number;
  Estado: string;
  Observaciones: string;
}

/** Mismas 13 columnas del export original + Estado + Observaciones al final. */
export function buildCoilExportRows(coils: Coil[]): CoilExportRow[] {
  return coils.map((coil) => {
    const invoiceDate = coil.metadata?.invoiceDate?.toDate
      ? coil.metadata.invoiceDate.toDate().toLocaleDateString("es-PE")
      : "Sin fecha";
    return {
      "ID Bobina": coil.id,
      Acabado: coil.finish || "N/A",
      Proveedor: coil.metadata?.provider || "N/A",
      "Factura N°": coil.metadata?.invoiceNumber || "S/N",
      "Fecha de Compra": invoiceDate,
      "Espesor (mm)": coil.thickness,
      "Ancho Maestro (mm)": coil.masterWidth,
      "Peso Compra (Kg)": coil.initialWeight,
      "Stock Actual (Kg)": coil.currentWeight,
      "Costo Unitario (S/ por Kg)": coil.pricePerKg,
      "Valorización Total (S/)": Number(
        ((coil.currentWeight || 0) * (coil.pricePerKg || 0)).toFixed(2),
      ),
      "Moneda Original": coil.metadata?.currency || "PEN",
      "Tipo de Cambio": coil.metadata?.exchangeRate || 1,
      Estado: statusLabel(coil.status),
      Observaciones: buildObservaciones(coil),
    };
  });
}

export interface CoilExportSummary {
  filtro: string;
  totalBobinas: number;
  conteoPorEstado: Record<string, number>;
  pesoCompraBrutoKg: number;
  stockBrutoKg: number;
  pesoCompraNetoKg: number;
  stockNetoKg: number;
  bobinasExcluidasDelNeto: number;
  negativas: Array<{ id: string; currentWeight: number }>;
  /** Presente solo si el export salió con búsqueda de texto activa (rama Algolia) — no es el inventario completo. */
  avisoBusqueda?: string;
}

/**
 * Bruto = todo lo exportado (incluye ANULADAS y peso negativo).
 * Neto = excluye ANULADAS y bobinas con currentWeight < 0 — es el número "de confianza".
 */
export function buildCoilExportSummary(
  coils: Coil[],
  filterLabel: string,
  searchTermApplied?: string,
): CoilExportSummary {
  const conteoPorEstado: Record<string, number> = {};
  let pesoCompraBrutoKg = 0;
  let stockBrutoKg = 0;
  let pesoCompraNetoKg = 0;
  let stockNetoKg = 0;
  let bobinasExcluidasDelNeto = 0;
  const negativas: Array<{ id: string; currentWeight: number }> = [];

  for (const coil of coils) {
    const label = statusLabel(coil.status);
    conteoPorEstado[label] = (conteoPorEstado[label] || 0) + 1;

    const iw = coil.initialWeight ?? 0;
    const cw = coil.currentWeight ?? 0;
    pesoCompraBrutoKg += iw;
    stockBrutoKg += cw;

    const isVoided = coil.status === "VOIDED";
    const isNegative = cw < 0;
    if (isNegative) negativas.push({ id: coil.id, currentWeight: cw });

    if (isVoided || isNegative) {
      bobinasExcluidasDelNeto++;
    } else {
      pesoCompraNetoKg += iw;
      stockNetoKg += cw;
    }
  }

  return {
    filtro: filterLabel,
    totalBobinas: coils.length,
    conteoPorEstado,
    pesoCompraBrutoKg: Number(pesoCompraBrutoKg.toFixed(2)),
    stockBrutoKg: Number(stockBrutoKg.toFixed(2)),
    pesoCompraNetoKg: Number(pesoCompraNetoKg.toFixed(2)),
    stockNetoKg: Number(stockNetoKg.toFixed(2)),
    bobinasExcluidasDelNeto,
    negativas,
    ...(searchTermApplied && searchTermApplied.trim()
      ? { avisoBusqueda: `Búsqueda de texto activa: los resultados reflejan la búsqueda '${searchTermApplied.trim()}'.` }
      : {}),
  };
}
