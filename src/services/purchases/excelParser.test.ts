import { describe, it, expect } from "vitest";

// Simulación del parser de Excel (lógica extraída del componente)
function parseExcelData(rows: any[]) {
  const purchasesMap: Record<string, any> = {};
  rows.forEach((row) => {
    if (!row[0] || !row[3] || !row[4]) return;
    const ruc = row[0].toString();
    const serie = row[3].toString();
    const numero = row[4].toString();
    const key = `${ruc}_${serie}-${numero}`;
    if (!purchasesMap[key]) {
      purchasesMap[key] = { ruc, serie, numero, total: 0, lines: [] };
    }
    const base = parseFloat(row[12]) || 0;
    const igv = parseFloat(row[13]) || 0;
    purchasesMap[key].lines.push({ description: row[8], totalValue: base });
    purchasesMap[key].total += (base + igv);
  });
  return Object.values(purchasesMap);
}

describe("Purchase Excel Parser", () => {
  it("should group rows by invoice and calculate totals", () => {
    const mockRows = [
      ["20123456789", "PROV 1", "01", "F001", "10", "01/01/2026", "PEN", "1", "ITEM 1", "1", "NIU", "100", "100", "18"],
      ["20123456789", "PROV 1", "01", "F001", "10", "01/01/2026", "PEN", "1", "ITEM 2", "2", "NIU", "50", "100", "18"],
    ];

    const result = parseExcelData(mockRows);
    expect(result).toHaveLength(1);
    expect(result[0].total).toBe(236); // (100+18) + (100+18)
    expect(result[0].lines).toHaveLength(2);
  });
});
