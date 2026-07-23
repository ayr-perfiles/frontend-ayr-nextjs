import type { Timestamp } from 'firebase/firestore';

/** Familia de producto de la línea aluzinc. UPVC es mono-familia; aluzinc no. */
export type MetallicFamily = 'COBERTURA' | 'PLANCHA';

/** Espejo de roofing/types.ts — mantener idéntico para reutilizar componentes de kardex. */
export type StockMovementType = 'ENTRADA' | 'SALIDA' | 'AJUSTE';

/**
 * productKind se deriva de family+unit (A1):
 *   COBERTURA+METRO  → COBERTURA_ML
 *   PLANCHA+PIEZA    → PLANCHA_UND

 */
export type ProductKind = 'COBERTURA_ML' | 'PLANCHA_UND';

export interface MetallicProduct {
  sku: string;
  displayName: string;
  family: MetallicFamily;
  /** Acabado/aleación: GALV, ALUZINC, NATURAL, PREPINTADO */
  finish: string;
  /** Acabados adicionales (Multi-RAL) */
  finishes?: string[];
  /** Espesor en mm (0.30, 0.35, 0.40, 0.45, 0.28...) */
  thickness: number;
  /** Ancho útil en m (opcional según familia) */
  width?: number;
  /** Largo en m — requerido para PLANCHA, no aplica a BOBINA */
  length?: number;
  unit: 'PIEZA' | 'METRO' | 'KILOGRAMO' | 'TONELADA';
  active: boolean;
  avgCost: number;
  /** Ancho desarrollado (bobina) en mm. Default 1200. Override manual posterior. */
  widthMm?: number;
  /** Factor de densidad para peso/ML: 0.008 todo aluzinc (natural o prepintado) · 0.00785 galvanizado/drywall. */
  densityFactor?: number;
  /** Origen del widthMm/densityFactor: 'parser' (migración) | 'manual' (editado por usuario). */
  metaSource?: 'parser' | 'manual';
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface MetallicStock {
  sku: string;
  productName: string;
  quantity: number;
  avgCost: number;
  totalValue: number;
  lastUpdate: Timestamp | null;
}

export interface MetallicStockMovement {
  sku: string;
  type: StockMovementType;
  quantity: number;
  costPerUnit: number;
  reason: string;
  businessLine: 'metallic-roofing';
  createdBy: string;
  createdAt: Timestamp | null;
}
