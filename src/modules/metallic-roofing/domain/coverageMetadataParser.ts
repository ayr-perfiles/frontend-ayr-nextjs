/**
 * Parser de metadata de cobertura aluzinc.
 * Función pura: deriva widthMm, densityFactor, etc. desde SKU + nombre.
 * No tiene efectos secundarios ni I/O; testeable en Fase 1 sin emulador.
 *
 * productKind se expresa como { family, unit } (decisión A1):
 *   COBERTURA + METRO  → COBERTURA_ML
 *   ACCESORIO          → ACCESSORY
 */

import type { MetallicFamily, ProductKind } from '../types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const WIDTH_MM_DEFAULT = 1200;

/** Tokens que indican producto natural (sin prepintado). */
const NATURAL_TOKENS = new Set(['NATURAL', 'NAT', 'GALV', 'ALUZINC', 'GALVANIZADO']);

/** Abreviaturas de color usadas en SKU (más largas primero para evitar ambigüedades). */
const COLOR_ALIASES: Record<string, string> = {
  ROJO: 'ROJO',
  AZUL: 'AZUL',
  VERDE: 'VERDE',
  BLANCO: 'BLANCO',
  AMARILLO: 'AMARILLO',
  GRIS: 'GRIS',
  RJ: 'ROJO',
  AZ: 'AZUL',
  VE: 'VERDE',
  BL: 'BLANCO',
  AM: 'AMARILLO',
  GR: 'GRIS',
};

/** Prefijos de familia — ordenados de más largo a más corto para evitar ACCES vs COB/BOB match incorrecto. */
const FAMILY_PREFIXES: Array<{ prefix: string; family: MetallicFamily }> = [

  { prefix: 'COB', family: 'COBERTURA' },
  { prefix: 'PL', family: 'PLANCHA' },
];

// ─── Tipos de salida ──────────────────────────────────────────────────────────

export interface ParsedCoverageMetadata {
  /** Familia derivada del prefijo del SKU. */
  family: MetallicFamily | null;
  /** productKind derivado de family (A1). */
  productKind: ProductKind | null;
  /** Espesor en mm derivado del SKU (0.30, 0.35…). */
  thicknessMm: number | null;
  /** Color del producto ('ROJO', 'AZUL'…) o '' para natural/galv. null si no determinado. */
  colorFinish: string | null;
  /** Ancho desarrollado en mm. Siempre 1200 (default); override posterior manual. */
  widthMm: number;
  /** Largo en metros (solo PLANCHA, null si COBERTURA o indeterminado). */
  lengthM: number | null;
  /** Confianza en el parseo. 'high' = todos los campos críticos resueltos. */
  parseConfidence: 'high' | 'low' | 'unparseable';
  notes?: string;
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** 0.30 → "030" → 30 → 0.30. Soporta legacy de 2 dígitos: "28" → 28 → 0.28. */
function parseThicknessToken(token: string): number | null {
  const n = parseInt(token, 10);
  if (isNaN(n) || n <= 0) return null;
  // Si el token tiene 2 o 3 dígitos y representa centésimas de mm (030 = 0.30)
  return n / 100;
}

/** Detecta color de una lista de tokens (ya en mayúsculas). Devuelve '' para natural, null si no encontrado. */
function detectColor(tokens: string[]): string | null {
  for (const t of tokens) {
    if (NATURAL_TOKENS.has(t)) return '';
    const alias = COLOR_ALIASES[t];
    if (alias !== undefined) return alias;
  }
  return null;
}

/** Tokeniza el cuerpo restante del SKU después del prefijo+espesor. */
function tokenizeSKUTail(tail: string): string[] {
  // Separar tokens: longitudes conocidas, split por números y letras alternados
  // Ej: "RJ6MT" → ["RJ", "6MT"] → ["RJ", "6", "MT"]
  return tail
    .split(/(\d+)/)
    .flatMap((s) => (s ? [s] : []))
    .map((s) => s.toUpperCase().trim())
    .filter(Boolean);
}

/** Tokeniza el nombre del producto para búsqueda de color/natural. */
function tokenizeName(name: string): string[] {
  return name
    .toUpperCase()
    .split(/[\s\-_,./x×:]+/)
    .filter(Boolean);
}

/** Detecta largo en metros desde tokens tipo "6MT", "36MT". */
function detectLength(tokens: string[]): number | null {
  for (let i = 0; i < tokens.length - 1; i++) {
    const num = parseFloat(tokens[i]);
    const next = tokens[i + 1]?.toUpperCase();
    if (!isNaN(num) && num > 0 && next === 'MT') return num;
  }
  // También soporta "6MT" como token único
  for (const t of tokens) {
    const m = /^(\d+(?:\.\d+)?)MT$/i.exec(t);
    if (m) return parseFloat(m[1]);
  }
  return null;
}

/** Mapea family al productKind equivalente (A1: usa family+unit). */
function toProductKind(family: MetallicFamily): ProductKind {
  switch (family) {
    case 'COBERTURA': return 'COBERTURA_ML';
    case 'PLANCHA': return 'PLANCHA_UND';
  }
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Parsea metadata de cobertura desde el código SKU y el nombre del producto.
 * Ambos parámetros son opcionales para facilitar testing parcial, pero idealmente
 * se proveen los dos para máxima confianza.
 */
export function parseCoverageMetadata(sku: string, name = ''): ParsedCoverageMetadata {
  const skuUpper = sku.toUpperCase().trim();

  // 1. Detectar BOBINA (Rechazo explícito)
  if (skuUpper.startsWith('BOB')) {
    return {
      family: null,
      productKind: null,
      thicknessMm: null,
      colorFinish: null,
      widthMm: WIDTH_MM_DEFAULT,
      lengthM: null,
      parseConfidence: 'unparseable',
      notes: 'Código BOB... no corresponde al catálogo de productos terminados; las bobinas se registran en Inventario de Bobinas',
    };
  }
  if (skuUpper.startsWith('ACCES')) {
    return {
      family: null,
      productKind: null,
      thicknessMm: null,
      colorFinish: null,
      widthMm: WIDTH_MM_DEFAULT,
      lengthM: null,
      parseConfidence: 'unparseable',
      notes: 'ACCES... pertenece a Trading, no al catálogo de coberturas',
    };
  }

  // 2. Detectar prefijo/familia
  const prefixMatch = FAMILY_PREFIXES.find((p) => skuUpper.startsWith(p.prefix));

  if (!prefixMatch) {
    return {
      family: null,
      productKind: null,
      thicknessMm: null,
      colorFinish: null,
      widthMm: WIDTH_MM_DEFAULT,
      lengthM: null,
      parseConfidence: 'unparseable',
      notes: `Prefijo no reconocido en SKU: ${sku}`,
    };
  }

  const { family } = prefixMatch;


  // 2. Extraer espesor (2-3 dígitos obligatorio después del prefijo)
  const body = skuUpper.slice(prefixMatch.prefix.length);
  const thicknessMatch = /^(\d{2,3})/.exec(body);

  if (!thicknessMatch) {
    return {
      family,
      productKind: toProductKind(family),
      thicknessMm: null,
      colorFinish: null,
      widthMm: WIDTH_MM_DEFAULT,
      lengthM: null,
      parseConfidence: 'unparseable',
      notes: `No se pudo extraer espesor del SKU: ${sku}`,
    };
  }

  const thicknessMm = parseThicknessToken(thicknessMatch[1]);
  const tail = body.slice(thicknessMatch[0].length);

  // 3. Extraer color y largo del tail del SKU
  const skuTailTokens = tokenizeSKUTail(tail);
  let colorFromSKU = detectColor(skuTailTokens);
  const lengthFromSKU = detectLength(skuTailTokens);

  // 4. Si el SKU no dio color, buscar en el nombre
  let colorFromName: string | null = null;
  if (colorFromSKU === null && name) {
    colorFromName = detectColor(tokenizeName(name));
  }

  const colorFinish = colorFromSKU ?? colorFromName;
  const lengthM = family === 'PLANCHA' ? (lengthFromSKU ?? detectLength(tokenizeName(name))) : null;

  // 5. Confidence (densityFactor ya no es responsabilidad del parser — se resuelve por acabado)
  const allCriticalResolved = thicknessMm !== null && colorFinish !== null;
  const parseConfidence = allCriticalResolved ? 'high' : 'low';

  const notes =
    parseConfidence === 'low'
      ? [
          thicknessMm === null && 'espesor no determinado',
          colorFinish === null && 'color no determinado',
        ]
          .filter(Boolean)
          .join('; ')
      : undefined;

  return {
    family,
    productKind: toProductKind(family),
    thicknessMm,
    colorFinish,
    widthMm: WIDTH_MM_DEFAULT,
    lengthM,
    parseConfidence,
    notes: notes || undefined,
  };
}
