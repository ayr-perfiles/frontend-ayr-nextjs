import { StockBobinaRow } from "./stockBobinasLogic";

export function mapStockBobinasToReportRows(rows: StockBobinaRow[]) {
  return rows.map((row) => ({
    tipo: row.tipo,
    estado: row.estado,
    espesor: row.espesor,
    acabado: row.acabado ?? "—",
    proveedor: row.proveedor ?? "—",
    numBobinas: row.numBobinas,
    pesoKg: row.pesoKg,
    metrajeML: row.metrajeML,
  }));
}
