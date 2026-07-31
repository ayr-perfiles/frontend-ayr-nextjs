import { CosteoAluzincRow } from "./costeoAluzincLogic";

/** costoPorKg => null cuando no hubo producción (peso 0), para que el renderer del hub lo muestre como "-" en vez de "S/ 0.00". */
export function mapCosteoAluzincToReportRows(rows: CosteoAluzincRow[]) {
  return rows.map((row) => ({
    tipo: row.tipo,
    pesoProduccionKg: row.pesoProduccionKg,
    costoPEN: row.costoPEN,
    costoPorKg: row.pesoProduccionKg === 0 ? null : row.costoPorKg,
    ventaPEN: row.ventaPEN,
    ventaKg: row.ventaKg,
    mermaKg: row.mermaKg,
  }));
}
