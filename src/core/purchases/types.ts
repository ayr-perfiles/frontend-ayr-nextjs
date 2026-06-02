import { Timestamp } from 'firebase/firestore';
import { UserRole } from '@/context/AuthContext';

export type PurchaseStatus = 'REGISTRADA' | 'ANULADA';
export type Currency = 'PEN' | 'USD';

export interface PurchaseItem {
  sku: string;
  productName: string;
  quantity: number;
  unitCostCurrency: number; // Costo unitario en la moneda original (sin IGV)
  unitCostPEN: number;      // Costo unitario convertido a PEN (sin IGV)
}

export interface Purchase {
  id?: string;
  supplier: {
    ruc: string;
    name: string;
  };
  businessLine: string; // 'roofing' | 'trading'
  invoice: {
    number: string;
    date: Timestamp;
    currency: Currency;
    exchangeRate: number;
    gravada: number;
    igv: number;
    total: number;
    detraccionPct?: number;
    detraccionAmount?: number;
  };
  items: PurchaseItem[];
  totalCostPEN: number;
  status: PurchaseStatus;
  createdAt: Timestamp;
  createdBy: string;
  voidReason?: string;
  voidedAt?: Timestamp;
  voidedBy?: string;
  validacionSunat?: {
    valido: boolean;
    estadoCp: string;
    estadoRuc: string;
    condDomiRuc: string;
    fecha: Timestamp;
    origen?: 'API' | 'SIRE';
  };
  origin?: 'MANUAL' | 'SIRE';
  CAR?: string;
  stockPendiente?: boolean;
  discrepancias?: {
    baseImponible?: number;
    igv?: number;
    total?: number;
    moneda?: string;
  };
}

export interface PurchaseFilters {
  businessLine?: string;
  supplierRuc?: string;
  startDate?: Date;
  endDate?: Date;
  status?: PurchaseStatus;
}
