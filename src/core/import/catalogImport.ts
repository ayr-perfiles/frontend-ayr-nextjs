import { read, utils } from 'xlsx';

export type RawImportRow = {
  sku: string;
  name: string;
  rawUnit: string;
  material: string;
  color: string;
  thicknessRaw: string | number;
  widthRaw: string | number;
  factorRaw: string | number;
  weightRaw: string | number;
  rawCategory: string;
};

export type NormalizedUnit = 'PIEZA' | 'METRO' | 'KILOGRAMO' | 'TONELADA' | 'ROLLO' | 'UNKNOWN';
export type BusinessLineTarget = 'drywall' | 'metallic-roofing' | 'roofing' | 'trading' | 'services' | 'coil' | 'skip' | 'unclassified';

export interface ParsedCatalogRow {
  sku: string;
  name: string;
  normalizedUnit: NormalizedUnit;
  line: BusinessLineTarget;
  material: string;
  colorOrFinish: string;
  thickness: number;
  width: number;
  densityFactor: number;
  weight: number;
  tradingCategory: string;
  assumedCategory: boolean;
  active: boolean;
  avgCost: number;
  length?: number;
}

export function parseCatalogExport(arrayBuffer: ArrayBuffer): RawImportRow[] {
  const wb = read(arrayBuffer, { type: 'array', raw: true });
  if (!wb.SheetNames.length) return [];
  const ws = wb.Sheets[wb.SheetNames[0]];

  const jsonData = utils.sheet_to_json<Record<string, unknown>>(ws, { raw: true, defval: '' });

  const rawRows: RawImportRow[] = [];
  const seenSkus = new Set<string>();

  for (const row of jsonData) {
    const sku = String(row['CODIGO'] || row['CÓDIGO PRODUCTO'] || row['CODIGO PRODUCTO'] || '').trim().toUpperCase();
    const name = String(row['DESCRIPCION'] || row['NOMBRE PRODUCTO'] || '').trim().toUpperCase();
    const rawUnit = String(row['UNIDADMEDIDA'] || row['UNIDAD MEDIDA'] || '').trim().toUpperCase();
    const rawCategory = String(row['CATEGORIA'] || '').trim().toUpperCase();
    const material = String(row['MATERIAL'] || '').trim().toUpperCase();
    const color = String(row['COLOR'] || '').trim().toUpperCase();
    const thicknessRaw = (row['ESPESOR'] ?? 0) as string | number;
    const widthRaw = (row['ANCHO'] ?? 0) as string | number;
    const factorRaw = (row['FACTOR'] ?? 0) as string | number;
    const weightRaw = (row['PESO UNIT/METROS'] ?? 0) as string | number;

    if (!sku || seenSkus.has(sku)) continue;

    // Solo aceptamos códigos que empiecen con COB o PL, Y que sean ALUZINC
    if (!(sku.startsWith('COB') || sku.startsWith('PL')) || material !== 'ALUZINC') {
      continue;
    }

    seenSkus.add(sku);
    rawRows.push({ sku, name, rawUnit, material, color, thicknessRaw, widthRaw, factorRaw, weightRaw, rawCategory });
  }

  return rawRows;
}

export function normalizeUnit(rawUnit: string): NormalizedUnit {
  const u = rawUnit.toUpperCase();
  if (u === 'UNIDAD' || u === 'PIEZA' || u === 'NIU' || u === 'UNIDAD_BIENES') return 'PIEZA';
  if (u === 'METRO LINEAL' || u === 'METRO' || u === 'MTR') return 'METRO';
  if (u === 'KILOGRAMO' || u === 'KGM' || u === 'KG') return 'KILOGRAMO';
  if (u === 'TONELADA' || u === 'TNE' || u === 'TONELADAS') return 'TONELADA';
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

export function parseNumValue(raw: string | number): number {
  if (typeof raw === 'number') return raw;
  if (!raw) return 0;
  
  let s = String(raw).trim();
  
  if (s.includes(',') && s.includes('.')) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      // coma es decimal
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // punto es decimal
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(/,/g, '.');
  }
  
  const parsed = parseFloat(s);
  return isNaN(parsed) ? 0 : parsed;
}

export function parseLengthFromSku(sku: string): number | undefined {
  if (!sku.startsWith('PL')) return undefined;
  
  const match = sku.match(/(\d+)(M|MT)?$/i);
  if (!match) return undefined;
  
  const digitsStr = match[1];
  
  if (digitsStr.length === 3) {
    return parseFloat(`${digitsStr.slice(0, digitsStr.length - 2)}.${digitsStr.slice(-2)}`);
  } else if (digitsStr.length === 2) {
    return parseFloat(`${digitsStr.slice(0, 1)}.${digitsStr.slice(1)}`);
  } else if (digitsStr.length === 1) {
    return parseFloat(digitsStr);
  }
  
  return undefined;
}

export function parseAndClassify(arrayBuffer: ArrayBuffer): ParsedCatalogRow[] {
  const rawRows = parseCatalogExport(arrayBuffer);
  return rawRows.map(r => {
    let thickness = parseNumValue(r.thicknessRaw);
    let width = parseNumValue(r.widthRaw);
    let weight = parseNumValue(r.weightRaw);
    let densityFactor = parseNumValue(r.factorRaw);
    let length = parseLengthFromSku(r.sku);

    if (densityFactor > 1) {
      densityFactor = densityFactor / 1000;
    }

    let tradingCategory = 'OTRO';
    let assumedCategory = true;
    if (r.name.includes('POLICARBONATO')) { tradingCategory = 'POLICARBONATO'; }
    else if (r.name.includes('TUBO')) { tradingCategory = 'TUBO'; }
    else if (r.name.includes('AUTOPERFORANTE')) { tradingCategory = 'AUTOPERFORANTE'; }
    else if (r.name.includes('ACCESORIO')) { tradingCategory = 'ACCESORIO'; }
    else { assumedCategory = false; } // it's actually OTRO

    if (r.name.includes('OTRO')) { assumedCategory = false; }

    return {
      sku: r.sku,
      name: r.name,
      normalizedUnit: normalizeUnit(r.rawUnit),
      line: classifyLine(r.sku, r.name),
      material: r.material,
      colorOrFinish: r.color,
      thickness,
      width,
      densityFactor,
      weight,
      tradingCategory,
      assumedCategory,
      active: true,
      avgCost: 0,
      length
    };
  });
}
