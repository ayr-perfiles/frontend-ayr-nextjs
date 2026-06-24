// Roofing module types
// Domain-specific types for the roofing (PVC coberturas) business line.

/** Materiales disponibles; refleja el enum en schemas/catalog.ts */
export type RoofingMaterial = 'UPVC' | 'ACERO_GALV' | 'POLICARBONATO';
export type RoofingUnit = 'PIEZA';
export type StockMovementType = 'ENTRADA' | 'SALIDA' | 'AJUSTE';

/** Producto del catálogo PVC. El SKU es el ID del documento en `roofing_catalog`. */
export interface RoofingProduct {
  sku: string;
  displayName: string;
  family: string;
  material: RoofingMaterial;
  color?: string;
  /** Especificación técnica (ej: '3.6m x 1.10m') */
  spec?: string;
  /** Obligatorio para descripción y cálculos */
  thickness: number;
  width: number;
  length: number;
  weight?: number;
  unit: RoofingUnit;
  active: boolean;
  /** Costo promedio ponderado en PEN */
  avgCost: number;
  suggestedPrice?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatedAt: any;
}

/** Stock actual de un SKU (colección: `roofing_stock`). */
export interface RoofingStock {
  sku: string;
  productName: string;
  /** Unidades en PIEZA */
  quantity: number;
  /** Costo promedio ponderado en PEN */
  avgCost: number;
  totalValue: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lastUpdate: any;
}

/** Movimiento de stock (colección: `roofing_stock_movements`). */
export interface RoofingStockMovement {
  id?: string;
  sku: string;
  type: StockMovementType;
  quantity: number;
  /** Costo unitario en PEN */
  costPerUnit: number;
  reason: string;
  businessLine: 'roofing';
  createdBy: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any;
}

/** Filtros para la vista de inventario roofing. */
export interface RoofingFilters {
  status?: 'ALL' | 'ACTIVE' | 'INACTIVE';
  searchTerm?: string;
  material?: RoofingMaterial;
  color?: string;
  family?: string;
}
