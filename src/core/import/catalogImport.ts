import { read, utils } from 'xlsx';

export type RawImportRow = {
  sku: string;
  name: string;
  rawUnit: string;
};

export type NormalizedUnit = 'PIEZA' | 'METRO' | 'KILOGRAMO' | 'TONELADA' | 'ROLLO' | 'UNKNOWN';
export type BusinessLineTarget = 'drywall' | 'metallic-roofing' | 'roofing' | 'trading' | 'services' | 'coil' | 'skip' | 'unclassified';

export interface ParsedCatalogRow {
  sku: string;
  name: string;
  normalizedUnit: NormalizedUnit;
  line: BusinessLineTarget;
}

export function parseInvoiceExport(arrayBuffer: ArrayBuffer): RawImportRow[] {
  const wb = read(arrayBuffer, { type: 'array' });
  if (!wb.SheetNames.length) return [];
  const ws = wb.Sheets[wb.SheetNames[0]];

  const jsonData = utils.sheet_to_json<Record<string, unknown>>(ws);

  const rawRows: RawImportRow[] = [];
  const seenSkus = new Set<string>();

  for (const row of jsonData) {
    const sku = String(row['CÓDIGO PRODUCTO'] || row['CODIGO PRODUCTO'] || '').trim().toUpperCase();
    const name = String(row['NOMBRE PRODUCTO'] || '').trim().toUpperCase();
    const rawUnit = String(row['UNIDAD MEDIDA'] || '').trim().toUpperCase();

    if (!sku || seenSkus.has(sku)) continue;

    seenSkus.add(sku);
    rawRows.push({ sku, name, rawUnit });
  }

  return rawRows;
}

export function normalizeUnit(rawUnit: string): NormalizedUnit {
  const u = rawUnit.toUpperCase();
  if (u === 'UNIDAD' || u === 'PIEZA' || u === 'NIU') return 'PIEZA';
  if (u === 'METRO LINEAL' || u === 'METRO' || u === 'MTR') return 'METRO';
  if (u === 'KILOGRAMO' || u === 'KGM' || u === 'KG') return 'KILOGRAMO';
  if (u === 'TONELADA' || u === 'TNE') return 'TONELADA';
  if (u === 'ROLLO') return 'ROLLO';
  return 'UNKNOWN';
}

export function classifyLine(sku: string, name: string): BusinessLineTarget {
  const s = sku.toUpperCase();
  const n = name.toUpperCase();

  // 1. Antis / Anticipos -> skip
  if (s.startsWith('ANTI') || n.includes('ANTICIPO')) return 'skip';

  // 2. Policarbonato (COBPOLI / POLI)
  if (s.startsWith('COBPOLI') || n.includes('POLICARBONATO')) return 'trading';

  // 3. Bobinas -> coil (not written to catalog)
  if (s.startsWith('BOB')) return 'coil';

  // 4. Drywall (P...GALV, R...GALV, OMEGA, ESQ)
  if ((s.startsWith('P') && s.includes('GALV')) ||
      (s.startsWith('R') && s.includes('GALV')) ||
      s.startsWith('OMEGA') ||
      s.startsWith('ESQ')) {
    return 'drywall';
  }

  // 5. Metallic Roofing (COB, PL, ACCES)
  if (s.startsWith('COB') || s.startsWith('PL') || s.startsWith('ACCES')) {
    return 'metallic-roofing';
  }

  // 6. Roofing / UPVC (UPVC, TC5)
  if (s.startsWith('UPVC') || n.includes('TC5')) return 'roofing';

  // 7. Trading (POLI, TUBO, AUTOP)
  if (s.startsWith('POLI') || s.startsWith('TUBO') || s.startsWith('AUTOP')) {
    return 'trading';
  }

  // 8. Services (CONFORM, SERV)
  if (s.startsWith('CONFORM') || s.startsWith('SERV')) return 'services';

  // None match
  return 'unclassified';
}

export function parseAndClassify(arrayBuffer: ArrayBuffer): ParsedCatalogRow[] {
  const rawRows = parseInvoiceExport(arrayBuffer);
  return rawRows.map(r => ({
    sku: r.sku,
    name: r.name,
    normalizedUnit: normalizeUnit(r.rawUnit),
    line: classifyLine(r.sku, r.name),
  }));
}
