/**
 * Estados posibles de una bobina de acero
 */
export type CoilStatus = "AVAILABLE" | "IN_PROGRESS" | "PROCESSED" | "VOIDED" | "EN_TERCERO";

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
  finish?: string; // ID del acabado (materia prima)
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

export interface CutOrder {
  id?: string;
  tercero: {
    nombre: string;
    ruc?: string;
  };
  status: 'ENVIADO' | 'RECIBIDO' | 'ANULADA';
  coils: {
    coilId: string;
    sentWeight: number;
    cutPlan: { widthMm: number; count: number }[];
  }[];
  sentWeightTotal: number;
  sentAt: any;
  sentBy: string;
  voidedAt?: any;
  voidedBy?: string;
  voidReason?: string;
  invoice?: {
    number: string;
    date: any;
    currency: 'USD' | 'PEN';
    exchangeRate: number;
    gravada: number;
    igv: number;
    detraccionPct?: number;
    detraccionAmount?: number;
    detraction?: { amount: number; code: string } | null;
    total: number;
    voided?: boolean;
    supplier?: { ruc: string; razonSocial: string } | null;
    source?: 'XML' | 'MANUAL';
  };
  serviceCostPEN?: number;
  receivedWeightTotal?: number;
  externalScrapWeight?: number;
  receivedAt?: any;
  receivedBy?: string;
  receivedStrips?: {
    coilId: string;
    widthMm: number;
    count: number;
    weight: number;
  }[];
}

export interface StripStock {
  id?: string; // key = widthMm (as string) or targetSku
  widthMm: number;
  targetSku?: string;
  totalStrips: number;
  totalWeight: number;
  avgCostPerKg: number;
  lastUpdate: any;
}

export interface StripMovement {
  id?: string;
  type: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  widthMm: number;
  quantity: number;
  weight: number;
  costPerKg: number;
  referenceId: string; // cutOrderId or productionLogId
  description: string;
  timestamp: any;
  user: string;
}

export interface ProductConfig {
  sku: string;
  name: string;
  stripWidth: number; // Ancho de banda (mm)
  standardWeight: number; // Peso logístico/estándar (kg)
  lengthMeters?: number; // Largo del producto (ej: 3.00, 2.44)
  isActive: boolean; // Para poder desactivar productos viejos sin borrarlos
}

export interface StockSummary {
  sku: string;
  totalQuantity: number;
  totalWeight: number;
  lastCostPerPiece?: number;
  lastUpdate: any;
}

export type BusinessLine = 'drywall' | 'roofing' | 'metallic-roofing' | 'trading' | 'services';

export interface SaleItem {
  sku: string;
  /** Línea de negocio del producto; omitido en ventas antiguas (default: drywall) */
  businessLine?: BusinessLine;
  /** Nombre del producto para display */
  productName?: string;
  quantity: number;
  unitPrice: number; // Precio FINAL (Con IGV)
  unitValue: number; // Valor Real (Sin IGV)
  baseCost: number;  // Costo de producción (Sin IGV)
  unitWeight: number;
  isCoil?: boolean;

  // --- Retrocompatibilidad (Para ventas antiguas) ---
  unitCost?: number;
  subtotal?: number;
  profit?: number;
}

export interface Sale {
  id?: string;
  customerName: string;
  documentNumber?: string;

  customerAddress?: string;
  contactName?: string;
  contactPhone?: string;

  items: SaleItem[];
  skus?: string[];
  /** Líneas de negocio presentes en esta venta (ej: ['drywall', 'roofing']) */
  businessLines?: BusinessLine[];
  totalAmount: number;
  totalCost: number;
  totalProfit?: number;
  status: "QUOTATION" | "COMPLETED" | "CANCELLED" | "CONVERTED" | "VOIDED";
  validUntil?: any;
  sellerId: string;
  sunat?: {
    tipoDoc: string;
    serie: string;
    correlativo: string;
    documentId: string;
    estado: "ACEPTADO" | "RECHAZADO" | "PENDIENTE" | "BAJA_PENDIENTE" | "BAJA_ACEPTADA";
    xmlPath?: string;
    cdrPath?: string;
    pdfPath?: string;
    hash?: string;
    mensajeSunat?: string;
    ticketBaja?: string;
    motivoBaja?: string;
    cdrBajaPath?: string;
    emittedAt?: any;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timestamp: any;
}

export interface ProductionLog {
  id?: string;
  parentCoilId?: string; // Optional for outsourced
  stripWidth?: number;   // New for outsourced
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
    | "EDIT_COIL"
    | "SEND_TO_CUT"
    | "RECEIVE_STRIPS"
    | "VOID_CUT_ORDER"
    | "EDIT_CUT_ORDER"
    | "CANCEL_CUTTING_PLAN";
  entityId: string;
  userEmail: string;
  details: string;
  timestamp: any;
}
