import type { Timestamp } from 'firebase/firestore';

/** Familia de producto de la línea aluzinc. UPVC es mono-familia; aluzinc no. */
export type MetallicFamily = 'COBERTURA' | 'PLANCHA' | 'BOBINA' | 'ACCESORIO';

/** Espejo de roofing/types.ts — mantener idéntico para reutilizar componentes de kardex. */
export type StockMovementType = 'ENTRADA' | 'SALIDA' | 'AJUSTE';

export interface MetallicProduct {
  sku: string;
  displayName: string;
  family: MetallicFamily;
  /** Acabado/aleación: GALV, ALUZINC, NATURAL, PREPINTADO */
  finish: string;
  /** ROJO, AZUL, VERDE... vacío cuando es NATURAL */
  color?: string;
  /** Espesor en mm (0.30, 0.35, 0.40, 0.45, 0.28...) */
  thickness: number;
  /** Ancho útil en m (opcional según familia) */
  width?: number;
  /** Largo en m — requerido para PLANCHA, no aplica a BOBINA */
  length?: number;
  unit: 'PIEZA' | 'METRO' | 'KILOGRAMO' | 'TONELADA';
  active: boolean;
  avgCost: number;
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
