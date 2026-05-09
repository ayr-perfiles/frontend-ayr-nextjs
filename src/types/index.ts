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
  masterWidth?: number;
  thickness?: number;
  pricePerKg: number;
  status: CoilStatus;
  plannedStrips?: PlannedStrip[];
  registeredBy: string;
  createdAt: any;
  updatedAt: any;
  metadata?: {
    provider?: string;
    // --- NUEVOS CAMPOS AGREGADOS ---
    providerDocType?: "LOCAL" | "TAX_ID";
    providerDoc?: string;
    providerRuc?: string; // Lo dejamos por retrocompatibilidad
    invoiceNumber?: string;
    invoiceDate?: any;
    currency?: "PEN" | "USD";
    exchangeRate?: number;
    originalCurrencyValue?: number;
    // -------------------------------
    originalDescription?: string;
    isHistoricalMigration?: boolean;
    isManualEntry?: boolean;
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
  unitPrice: number; // Precio FINAL (Con IGV)
  unitValue: number; // NUEVO: Valor Real (Sin IGV)
  baseCost: number; // NUEVO: Costo de producción (Sin IGV)
  unitWeight: number; // NUEVO: Peso unitario para calcular el peso total de la venta

  // --- Retrocompatibilidad (Para ventas antiguas) ---
  unitCost?: number;
  subtotal?: number;
  profit?: number;
}

export interface Sale {
  id?: string;
  customerName: string;
  documentNumber?: string;

  // --- NUEVOS CAMPOS DE DESPACHO Y CONTACTO ---
  customerAddress?: string;
  contactName?: string;
  contactPhone?: string;
  // --------------------------------------------

  items: SaleItem[];
  totalAmount: number;
  totalCost: number;
  totalProfit?: number;
  status: "QUOTATION" | "COMPLETED" | "CANCELLED" | "CONVERTED" | "VOIDED";
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
