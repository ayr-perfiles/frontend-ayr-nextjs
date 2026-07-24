// PRINCIPIO: este builder normaliza FORMA (shape canónico de sales/quotations,
// businessLines derivado, flags, campos obligatorios), NUNCA VALORES.
// Si el caller (import) ya trae totales/profit con signo correcto (ej. multiplier
// de Nota de Crédito aplicado), el builder los RESPETA tal cual — NO los
// recalcula desde items. Solo calcula desde items cuando el caller no los trae
// (caso POS: processSale/createQuotation nunca pasan totales/profit).
// Por eso el chequeo es `!== undefined`, no truthy: 0 es un total legítimo.
import { classifyLine } from '@/core/import/catalogImport';
import { BusinessLineTarget } from '@/core/import/catalogImport';

export interface CanonicalSaleItem {
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitValue: number;
  baseCost: number;
  businessLine: string; // Ex: 'drywall', or empty if skip/coil
  profit: number;
  flags: string[];
  unitWeight: number;
  calculatedWeight: number;
  unitOfMeasure: string;
  isCoil: boolean;
  weightSnapshot?: any;
  piecesCount?: number;
  pieceLengthM?: number;
}

export interface CanonicalSaleDoc {
  status: string;
  customerName: string;
  customerDocument: string;
  documentNumber: string;
  contactName: string;
  contactPhone: string;
  customerAddress: string;
  businessLines: string[];
  skus: string[];
  items: CanonicalSaleItem[];
  totalAmount: number;
  totalCost: number;
  totalProfit: number;
  totalWeight: number;
  allFlags: string[];
  paymentStatus: string;
  sellerId: string;
  timestamp: any;
}

export interface CanonicalQuotationDoc extends CanonicalSaleDoc {
  productionStatus: 'PENDING' | 'CONFIRMED';
}

export interface InputSaleItem {
  sku?: string;
  name?: string;
  productName?: string;
  quantity?: number;
  unitPrice?: number;
  unitValue?: number;
  baseCost?: number;
  businessLine?: string;
  profit?: number;
  flags?: string[];
  unitWeight?: number;
  calculatedWeight?: number;
  weightSnapshot?: any;
  unitOfMeasure?: string;
  isCoil?: boolean;
  piecesCount?: number;
  pieceLengthM?: number;
}

export interface InputSaleDoc {
  status?: string;
  customerName?: string;
  customerDocument?: string;
  documentNumber?: string;
  contactName?: string;
  contactPhone?: string;
  customerAddress?: string;
  items?: InputSaleItem[];
  totalAmount?: number;
  totalCost?: number;
  totalProfit?: number;
  totalWeight?: number;
  paymentStatus?: string;
  sellerId?: string;
  timestamp?: any;
}

export function buildSaleDoc(input: InputSaleDoc, injectedTimestamp: any): CanonicalSaleDoc {
  const items: CanonicalSaleItem[] = [];
  const businessLinesSet = new Set<string>();
  const skusSet = new Set<string>();
  const allFlagsSet = new Set<string>();

  for (const f of (input as any).allFlags || []) {
    allFlagsSet.add(f);
  }

  let totalAmount = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let totalWeight = 0;

  for (const rawItem of (input.items || [])) {
    const sku = rawItem.sku || 'GENERIC';
    const productName = rawItem.productName || rawItem.name || '';
    let bl = rawItem.businessLine || '';
    const itemFlags: string[] = rawItem.flags ? [...rawItem.flags] : [];

    if (!bl) {
      const target = classifyLine(sku, productName);
      if (target === 'skip' || target === 'coil' || target === 'unclassified') {
        bl = '';
        itemFlags.push('linea no resuelta');
      } else {
        bl = target;
      }
    } else {
      if (bl === 'skip' || bl === 'coil' || bl === 'unclassified' || bl === 'UNKNOWN') {
         if (!itemFlags.includes('linea no resuelta')) itemFlags.push('linea no resuelta');
         bl = '';
      }
    }

    if (bl) {
      businessLinesSet.add(bl);
    }
    
    skusSet.add(sku);

    const quantity = rawItem.quantity || 0;
    const unitPrice = rawItem.unitPrice || 0;
    const unitValue = rawItem.unitValue || 0;
    const baseCost = rawItem.baseCost || 0;
    const isCoil = rawItem.isCoil || false;
    
    if (baseCost === 0 && bl !== 'services' && !isCoil) {
      if (!itemFlags.includes('sin costo')) itemFlags.push('sin costo');
    }

    let profit: number;
    if (rawItem.profit !== undefined) {
      // Caller ya trae el profit firmado (ej. NC con multiplier aplicado) — se respeta, no se recalcula.
      profit = rawItem.profit;
    } else if (baseCost > 0) {
      const priceOrValue = unitValue > 0 ? unitValue : unitPrice;
      profit = (priceOrValue - baseCost) * quantity;
    } else {
      profit = 0;
    }

    const unitWeight = rawItem.unitWeight || 0;
    const calculatedWeight = rawItem.calculatedWeight ?? (unitWeight * quantity);

    if (bl === 'metallic-roofing' && !rawItem.weightSnapshot && calculatedWeight === 0 && unitWeight === 0) {
       if (!itemFlags.includes('sin peso')) itemFlags.push('sin peso');
    }

    itemFlags.forEach(f => allFlagsSet.add(f));

    totalAmount += (unitPrice * quantity);
    totalCost += (baseCost * quantity);
    totalProfit += profit;
    totalWeight += calculatedWeight;

    const builtItem: CanonicalSaleItem = {
      sku,
      productName,
      quantity,
      unitPrice,
      unitValue,
      baseCost,
      businessLine: bl,
      profit,
      flags: itemFlags,
      unitWeight,
      calculatedWeight,
      unitOfMeasure: rawItem.unitOfMeasure || 'UND',
      isCoil,
    };
    
    if (rawItem.weightSnapshot) builtItem.weightSnapshot = rawItem.weightSnapshot;
    if (rawItem.piecesCount !== undefined) builtItem.piecesCount = rawItem.piecesCount;
    if (rawItem.pieceLengthM !== undefined) builtItem.pieceLengthM = rawItem.pieceLengthM;

    items.push(builtItem);
  }

  let finalCustomerDocument = input.customerDocument || '';
  let finalDocumentNumber = input.documentNumber || '';
  if (finalDocumentNumber && !finalCustomerDocument && /^RUC-?\d{8,}$|^\d{8,}$/.test(finalDocumentNumber)) {
    finalCustomerDocument = finalDocumentNumber.replace('RUC-', '');
    finalDocumentNumber = '';
    // Heurístico muta datos (documentNumber -> customerDocument): nunca en silencio.
    allFlagsSet.add('documento reubicado');
  }

  // Totales: si el caller ya los trae (import, con signo de multiplier NC aplicado),
  // se RESPETAN tal cual — el comprobante es la verdad. Solo se calculan desde items
  // cuando el caller no los trae (caso POS). `!== undefined` porque 0 es legítimo.
  const finalTotalAmount = input.totalAmount !== undefined ? input.totalAmount : totalAmount;
  const finalTotalCost = input.totalCost !== undefined ? input.totalCost : totalCost;
  const finalTotalProfit = input.totalProfit !== undefined ? input.totalProfit : totalProfit;
  const finalTotalWeight = input.totalWeight !== undefined ? input.totalWeight : totalWeight;

  return {
    status: input.status || 'COMPLETED',
    customerName: input.customerName || '',
    customerDocument: finalCustomerDocument,
    documentNumber: finalDocumentNumber,
    contactName: input.contactName || '',
    contactPhone: input.contactPhone || '',
    customerAddress: input.customerAddress || '',
    businessLines: Array.from(businessLinesSet),
    skus: Array.from(skusSet),
    items: items,
    totalAmount: finalTotalAmount,
    totalCost: finalTotalCost,
    totalProfit: finalTotalProfit,
    totalWeight: finalTotalWeight,
    allFlags: Array.from(allFlagsSet),
    paymentStatus: input.paymentStatus || 'PAID',
    sellerId: input.sellerId || '',
    timestamp: injectedTimestamp,
  };
}

export function buildQuotationDoc(input: InputSaleDoc, injectedTimestamp: any): CanonicalQuotationDoc {
  const base = buildSaleDoc(input, injectedTimestamp);
  return {
    status: 'QUOTATION',
    productionStatus: 'PENDING',
    customerName: base.customerName,
    customerDocument: base.customerDocument,
    documentNumber: base.documentNumber,
    contactName: base.contactName,
    contactPhone: base.contactPhone,
    customerAddress: base.customerAddress,
    businessLines: base.businessLines,
    skus: base.skus,
    items: base.items,
    totalAmount: base.totalAmount,
    totalCost: base.totalCost,
    totalProfit: base.totalProfit,
    totalWeight: base.totalWeight,
    allFlags: base.allFlags,
    paymentStatus: base.paymentStatus,
    sellerId: base.sellerId,
    timestamp: base.timestamp,
  };
}
