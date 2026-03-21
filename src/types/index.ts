/**
 * Estados posibles de una bobina de acero
 */
export type CoilStatus = "AVAILABLE" | "IN_PROGRESS" | "PROCESSED" | "VOIDED";

export interface PlannedStrip {
  sku: string;
  initialCount: number;
  pendingCount: number;
  costPerStrip: number;
  width: number;
}

export interface Coil {
  id: string;
  initialWeight: number;
  currentWeight: number;
  masterWidth: number;
  thickness: number;
  pricePerKg: number;
  status: CoilStatus;
  plannedStrips?: PlannedStrip[];
  registeredBy?: string; // Trazabilidad de ingreso
  createdAt: any;
  updatedAt: any;
  metadata?: {
    provider?: string;
    observations?: string;
  };
}

export interface StockSummary {
  sku: string;
  totalQuantity: number;
  totalWeight: number;
  lastCostPerPiece?: number;
  lastUpdate: any;
}

export interface SaleItem {
  sku: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  subtotal: number;
  profit: number;
}

export interface Sale {
  id?: string;
  customerName: string;
  documentNumber?: string;
  items: SaleItem[];
  totalAmount: number;
  totalCost: number;
  totalProfit: number;
  status: "QUOTATION" | "COMPLETED" | "CANCELLED" | "CONVERTED";
  validUntil?: any;
  sellerId: string;
  timestamp: any;
}

export interface ProductionLog {
  id?: string;
  parentCoilId: string;
  sku: string;
  piecesProduced: number;
  totalUsedWidth: number;
  scrapWidth: number;
  stripCost: number;
  costPerPiece: number;
  reportedWeight?: number; // Para precisión al anular
  operatorId: string;
  timestamp: any;
  status?: "ACTIVE" | "VOIDED";
  voidedBy?: string;
  voidedAt?: any;
}

export interface AuditLog {
  id?: string;
  action:
    | "VOID_PRODUCTION"
    | "VOID_SALE"
    | "SYSTEM_RESET"
    | "VOID_COIL"
    | "EDIT_COIL";
  entityId: string;
  userEmail: string;
  details: string;
  timestamp: any;
}
