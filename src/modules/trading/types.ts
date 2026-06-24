import type { Timestamp } from 'firebase/firestore';

export type TradingCategory = 'POLICARBONATO' | 'TUBO' | 'AUTOPERFORANTE' | 'ACCESORIO' | 'OTRO';
export type StockMovementType = 'ENTRADA' | 'SALIDA' | 'AJUSTE';

export interface TradingProduct {
  sku: string;
  displayName: string;
  category: TradingCategory;
  color?: string;
  spec?: string;
  unit: 'PIEZA' | 'METRO' | 'ROLLO';
  active: boolean;
  avgCost: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface TradingStock {
  sku: string;
  productName: string;
  quantity: number;
  avgCost: number;
  totalValue: number;
  lastUpdate: Timestamp | null;
}

export interface TradingStockMovement {
  sku: string;
  type: StockMovementType;
  quantity: number;
  costPerUnit: number;
  reason: string;
  businessLine: 'trading';
  createdBy: string;
  createdAt: Timestamp | null;
}
