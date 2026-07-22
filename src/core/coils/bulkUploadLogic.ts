import { parseNumValue } from "@/core/import/catalogImport";

export const TOKEN_TO_FINISH: Record<string, string> = {
  GALV: 'GALV',
  NATURAL: 'ALU-NATURAL',
  AZUL: 'ALU-AZUL',
  BLANCO: 'ALU-BLANCO',
  ROJO: 'ALU-ROJO',
  VERDE: 'ALU-VERDE'
};

export interface CoilRow {
  serie: string;
  nroDoc: string;
  fecha: string | number;
  provider: string;
  providerDoc: string;
  currencyRaw: string;
  exchangeRateRaw: string;
  finish: string;
  widthRaw: string;
  thicknessRaw: string;
  weightRaw: string;
  unitRaw: string;
  weightKgRaw: string;
  valueRaw: string;
}

export interface CoilRowValidation {
  valid: boolean;
  errors: string[];
}

export interface InvoicePayload {
  serie: string;
  nroDoc: string;
  fecha: string;
  provider: string;
  providerDoc: string;
  currency: 'PEN' | 'USD';
  exchangeRate: number;
  coils: Array<{
    finish: string;
    width: number;
    thickness: number;
    weight: number;
    value: number;
  }>;
}

export function normalizeFecha(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined || raw === "") return null;

  let serialNum: number | null = null;
  if (typeof raw === "number") {
    serialNum = raw;
  } else {
    const s = String(raw).trim();
    if (/^\d+(\.\d+)?$/.test(s)) {
      serialNum = Number(s);
    }
  }

  if (serialNum !== null && serialNum >= 20000 && serialNum <= 60000) {
    const ms = Date.UTC(1899, 11, 30) + Math.floor(serialNum) * 86400000;
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const mStr = (d.getUTCMonth() + 1).toString().padStart(2, "0");
    const dStr = d.getUTCDate().toString().padStart(2, "0");
    return `${y}-${mStr}-${dStr}`;
  }

  const s = String(raw).trim();
  
  let year: number, month: number, day: number;

  const parts = s.split('/');
  if (parts.length === 3) {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  } else {
    const dashParts = s.split('-');
    if (dashParts.length === 3) {
      year = parseInt(dashParts[0], 10);
      month = parseInt(dashParts[1], 10);
      day = parseInt(dashParts[2], 10);
    } else {
      return null;
    }
  }

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  if (month < 1 || month > 12) return null;
  
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null; 
  }

  const mStr = month.toString().padStart(2, '0');
  const dStr = day.toString().padStart(2, '0');
  return `${year}-${mStr}-${dStr}`;
}

export function normalizeCurrency(raw: string): 'USD' | 'PEN' | null {
  const norm = String(raw || '').toUpperCase().trim();
  if (norm.includes('DOLAR') || norm.includes('DOLLAR') || norm.includes('USD')) {
    return 'USD';
  }
  if (norm.includes('SOLES') || norm.includes('PEN') || norm.includes('S/.')) {
    return 'PEN';
  }
  return null;
}

export const WEIGHT_MIN_KG = 1000;
export const WEIGHT_MAX_KG = 20000;

export const EXCHANGE_RATE_MIN = 2;
export const EXCHANGE_RATE_MAX = 7;

// TC USD válido = numérico dentro de [2,7]. Rechaza vacío, NaN, y cualquier
// fallback silencioso (ej. 3.75 fijo) que no venga de una fuente real verificada por el usuario.
export function isValidUsdExchangeRate(rate: number | string | null | undefined): boolean {
  if (rate === null || rate === undefined || rate === "") return false;
  const n = typeof rate === "number" ? rate : parseNumValue(rate);
  return !isNaN(n) && n >= EXCHANGE_RATE_MIN && n <= EXCHANGE_RATE_MAX;
}

export function parseWeightToKg(weightRaw: string, unitRaw: string): number | null {
  if (!unitRaw) return null;
  const u = unitRaw.toUpperCase().trim();
  const rawVal = parseNumValue(weightRaw);
  
  if (isNaN(rawVal) || rawVal <= 0) return null;

  if (u === 'KILOGRAMO' || u === 'KG') {
    return rawVal;
  } else if (u === 'TONELADA' || u === 'TON' || u === 'TN' || u === 'TONELADAS') {
    return rawVal * 1000;
  }
  
  // ROLLO, UNIDAD, UND, vacíos, o desconocidos
  return null;
}

export function validateCoilRow(row: CoilRow, liveFinishKeys: string[]): CoilRowValidation {
  const errors: string[] = [];

  if (!row.finish || row.finish.trim() === '') {
    errors.push('Acabado no seleccionado');
  } else if (!liveFinishKeys.includes(row.finish)) {
    errors.push('Acabado inválido o no existe');
  }

  const w = parseNumValue(row.widthRaw);
  if (isNaN(w) || w <= 0) errors.push('Ancho inválido');

  const t = parseNumValue(row.thicknessRaw);
  if (isNaN(t) || t <= 0) errors.push('Espesor inválido');

  // RESOLUCIÓN EFECTIVA DE PESO
  let effectiveWeight: number | null = null;
  if (row.weightKgRaw && row.weightKgRaw.trim() !== '') {
    effectiveWeight = parseNumValue(row.weightKgRaw);
  } else {
    effectiveWeight = parseWeightToKg(row.weightRaw, row.unitRaw);
  }
    
  if (effectiveWeight === null || isNaN(effectiveWeight) || effectiveWeight <= 0) {
    errors.push('Peso inválido (kg no resuelto — revise unidad o ingrese kg)');
  } else if (effectiveWeight < WEIGHT_MIN_KG || effectiveWeight > WEIGHT_MAX_KG) {
    errors.push(`Peso ${effectiveWeight} fuera de rango esperado [${WEIGHT_MIN_KG}-${WEIGHT_MAX_KG} kg], verifique`);
  }

  const v = parseNumValue(row.valueRaw);
  if (isNaN(v) || v <= 0) errors.push('Valor inválido');

  const fechaNorm = normalizeFecha(row.fecha);
  if (!fechaNorm) {
    errors.push('Fecha inválida');
  }

  const cur = normalizeCurrency(row.currencyRaw);
  if (cur === null) {
    errors.push('Moneda no reconocida (use USD o PEN)');
  } else if (cur === 'USD') {
    if (!row.exchangeRateRaw || row.exchangeRateRaw.trim() === '') {
      errors.push('Tipo de cambio vacío para USD');
    } else if (!isValidUsdExchangeRate(row.exchangeRateRaw)) {
      errors.push(`Tipo de cambio fuera de rango [${EXCHANGE_RATE_MIN},${EXCHANGE_RATE_MAX}]`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function buildInvoicesPayload(rows: CoilRow[], liveFinishKeys: string[]): { invoices: InvoicePayload[]; invalidCount: number } {
  let invalidCount = 0;
  
  const invoiceMap = new Map<string, InvoicePayload>();

  for (const row of rows) {
    const validation = validateCoilRow(row, liveFinishKeys);
    if (!validation.valid) {
      invalidCount++;
      continue;
    }

    const groupKey = `${row.serie}-${row.nroDoc}`;
    
    if (!invoiceMap.has(groupKey)) {
      const cur = normalizeCurrency(row.currencyRaw);
      const invoice: InvoicePayload = {
        serie: row.serie,
        nroDoc: row.nroDoc,
        fecha: normalizeFecha(row.fecha)!, 
        provider: row.provider,
        providerDoc: row.providerDoc,
        currency: cur!,
        exchangeRate: cur === 'USD' ? parseNumValue(row.exchangeRateRaw) : 1,
        coils: []
      };
      invoiceMap.set(groupKey, invoice);
    }

    let effectiveWeight: number;
    if (row.weightKgRaw && row.weightKgRaw.trim() !== '') {
      effectiveWeight = parseNumValue(row.weightKgRaw);
    } else {
      effectiveWeight = parseWeightToKg(row.weightRaw, row.unitRaw)!;
    }

    const targetInvoice = invoiceMap.get(groupKey)!;
    targetInvoice.coils.push({
      finish: row.finish,
      width: parseNumValue(row.widthRaw),
      thickness: parseNumValue(row.thicknessRaw),
      weight: effectiveWeight,
      value: Number(parseNumValue(row.valueRaw).toFixed(2))
    });
  }

  return {
    invoices: Array.from(invoiceMap.values()),
    invalidCount
  };
}
