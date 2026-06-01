/**
 * Normaliza y calcula el peso en KG basado en la Unidad de Medida (UM).
 *
 * @param unitOfMeasure Texto de la columna "UNIDAD MEDIDA"
 * @param cantidad Cantidad numérica de la fila
 * @param unitWeight Peso unitario (kg) obtenido del catálogo para el SKU
 * @returns Un objeto con el peso calculado y un flag opcional si la UM no es reconocida
 */
export function calcPesoKg(
  unitOfMeasure: string,
  cantidad: number,
  unitWeight: number
): { weight: number; flag?: string } {
  const um = (unitOfMeasure || '').toUpperCase().trim();

  // Caso 1: UNIDAD - Se multiplica cantidad por peso del catálogo
  if (um === 'UNIDAD' || um === 'UND' || um === 'UNIDADES') {
    return { weight: cantidad * unitWeight };
  }

  // Caso 2: METRO LINEAL - Se multiplica cantidad (metros) por peso por metro (unitWeight)
  if (um === 'METRO LINEAL' || um === 'ML' || um === 'METROS') {
    return { weight: cantidad * unitWeight };
  }

  // Caso 3: KILOGRAMO - La cantidad ya representa el peso total
  if (um === 'KILOGRAMO' || um === 'KG' || um === 'KILOGRAMOS') {
    return { weight: cantidad };
  }

  // Caso 4: TONELADA - Se multiplica cantidad por 1000 para obtener KG
  if (um === 'TONELADA' || um === 'TN' || um === 'TONELADAS') {
    return { weight: cantidad * 1000 };
  }

  // Caso por defecto: No reconocida
  if (!um) {
    return { weight: cantidad * unitWeight };
  }

  return { 
    weight: cantidad * unitWeight, 
    flag: `UM no reconocida: ${unitOfMeasure}`
  };
}

/**
 * Normaliza el tipo de comprobante de la SUNAT.
 */
export type NormalizedDocType = 'FACTURA' | 'BOLETA' | 'NOTA CRÉDITO' | 'NOTA DÉBITO' | 'OTROS';

export function normalizeDocType(tipo: any): NormalizedDocType {
  const raw = String(tipo || '').toUpperCase().trim();
  // Remove accents
  const t = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  if (t.includes('FACTURA')) return 'FACTURA';
  if (t.includes('BOLETA')) return 'BOLETA';
  if (t === 'NC' || t.includes('CREDITO')) return 'NOTA CRÉDITO';
  if (t === 'ND' || t.includes('DEBITO')) return 'NOTA DÉBITO';
  
  return 'OTROS';
}

/**
 * Determina el comportamiento de stock para Notas de Crédito.
 */
export type NcStockAction = 'RETURNS_STOCK' | 'MONEY_ONLY' | 'UNDECIDED';

export function classifyNCStockAction(rawValue: string): NcStockAction {
  // Strip diacritics antes de comparar: "Sí" → "SI", igual que normalizeDocType
  const val = (rawValue || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
  if (val === 'SI') return 'RETURNS_STOCK';
  if (val === 'NO') return 'MONEY_ONLY';
  return 'UNDECIDED';
}
