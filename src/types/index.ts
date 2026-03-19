/**
 * Estados posibles de una bobina de acero
 */
export type CoilStatus = "AVAILABLE" | "IN_PROGRESS" | "PROCESSED" | "VOIDED";
/**
 * Representa la "memoria" de los flejes cortados en el Slitter
 */
export interface PlannedStrip {
  sku: string;
  initialCount: number;
  pendingCount: number;
  costPerStrip: number;
  width: number; // <-- AÑADE ESTO: Para saber cuánto mide el fleje
}
/**
 * Representa una Bobina de acero (Materia Prima)
 */
export interface Coil {
  id: string; // ID de serie (ej: PD03-08)
  initialWeight: number; // Peso de ingreso en kg
  currentWeight: number; // Peso restante en kg
  masterWidth: number; // Ancho total en mm (ej: 1192)
  thickness: number; // Espesor en mm (ej: 0.45)
  pricePerKg: number; // Precio de compra por kg
  status: CoilStatus;
  plannedStrips?: PlannedStrip[]; // Plan de corte activo (Fase 1)
  createdAt: any;
  updatedAt: any;
  metadata?: {
    provider?: string;
    observations?: string;
  };
}

/**
 * Resumen de stock para Ventas y Dashboard
 */
export interface StockSummary {
  sku: string;
  totalQuantity: number; // Piezas listas para vender
  totalWeight: number; // Peso total en almacén de producto terminado
  lastCostPerPiece?: number; // El costo de fabricación del último lote (para margen)
  lastUpdate: any;
}

/**
 * Detalle de un producto dentro de un ticket de venta o cotización
 */
export interface SaleItem {
  sku: string;
  quantity: number;
  unitPrice: number; // Precio de venta al cliente
  unitCost: number; // Costo de fabricación capturado en el momento
  subtotal: number;
  profit: number; // Ganancia real (unitPrice - unitCost) * quantity
}

/**
 * Representa una Venta o una Cotización
 */
export interface Sale {
  id?: string;
  customerName: string;
  documentNumber?: string; // RUC o DNI
  items: SaleItem[];
  totalAmount: number; // Ingreso bruto
  totalCost: number; // Costo total de fabricación del pedido
  totalProfit: number; // Ganancia neta total del pedido
  status: "QUOTATION" | "COMPLETED" | "CANCELLED";
  validUntil?: any; // Para cotizaciones (ej: vence en 7 días)
  sellerId: string;
  timestamp: any;
}
// Actualiza la interfaz existente
export interface ProductionLog {
  id?: string;
  parentCoilId: string;
  sku: string;
  piecesProduced: number;
  totalUsedWidth: number;
  scrapWidth: number;
  stripCost: number;
  costPerPiece: number;
  operatorId: string;
  timestamp: any;
  // --- NUEVOS CAMPOS PARA ANULACIÓN ---
  status?: "ACTIVE" | "VOIDED";
  voidedBy?: string;
  voidedAt?: any;
}

// Añade esta nueva interfaz al final
export interface AuditLog {
  id?: string;
  action: "VOID_PRODUCTION" | "VOID_SALE" | "SYSTEM_RESET";
  entityId: string;
  userEmail: string;
  details: string;
  timestamp: any;
}
