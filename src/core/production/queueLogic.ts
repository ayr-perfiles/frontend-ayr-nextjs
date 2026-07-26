import type { Sale, SaleItem } from "@/types";

export type QueueRowStatus = "PENDIENTE" | "PARCIAL" | "CUMPLIDA" | "SOBRE_PRODUCIDA";

export interface QueueLine {
  sku: string;
  productNames: string[];
  quantityRequested: number;
  quantityProduced: number;
  pct: number;
}

export interface QueueRow {
  quoteId: string;
  documentNumber: string;
  customerName: string;
  timestamp: any;
  confirmedBy?: string;
  lines: QueueLine[];
  status: QueueRowStatus;
}

/**
 * EPSILON: 0.01
 * Justificación: El sistema maneja ML (metros lineales) y kg. 
 * Para ML, 0.01 representa 1cm, que es la tolerancia mínima en cortes de máquinas conformadoras.
 * Diferencias menores a 1cm se consideran ruido de precisión flotante.
 */
const EPSILON = 0.01;

export function buildQueueRow(quote: Sale, fulfillmentLogs: any[]): QueueRow {
  const items = quote.items?.filter(item => item.businessLine === "metallic-roofing") || [];
  
  if (items.length === 0) {
    return {
      quoteId: quote.id || "",
      documentNumber: quote.documentNumber || "",
      customerName: quote.customerName || "",
      timestamp: quote.timestamp,
      confirmedBy: (quote as any).confirmedBy,
      lines: [],
      status: "CUMPLIDA",
    };
  }

  const validLogs = fulfillmentLogs.filter(log => log.status !== "VOIDED");

  const skuGroups: Record<string, { sku: string; productNames: Set<string>; quantityRequested: number }> = {};

  items.forEach(item => {
    if (!skuGroups[item.sku]) {
      skuGroups[item.sku] = {
        sku: item.sku,
        productNames: new Set<string>(),
        quantityRequested: 0
      };
    }
    skuGroups[item.sku].productNames.add(item.productName || item.sku);
    skuGroups[item.sku].quantityRequested += (item.quantity || 0);
  });

  const lines: QueueLine[] = Object.values(skuGroups).map(group => {
    const quantityProduced = validLogs
      .filter(l => l.sku === group.sku)
      .reduce((acc, l) => acc + (l.piecesProduced || 0), 0);
      
    const pct = group.quantityRequested > 0 ? (quantityProduced / group.quantityRequested) * 100 : 0;
    
    return {
      sku: group.sku,
      productNames: Array.from(group.productNames),
      quantityRequested: group.quantityRequested,
      quantityProduced,
      pct
    };
  });

  let status: QueueRowStatus = "PENDIENTE";
  const totalRequested = lines.reduce((acc, l) => acc + l.quantityRequested, 0);
  const totalProduced = lines.reduce((acc, l) => acc + l.quantityProduced, 0);
  
  const isOverProduced = lines.some(l => l.quantityProduced > l.quantityRequested + EPSILON);
  const isCompleted = lines.every(l => l.quantityProduced >= l.quantityRequested - EPSILON);
  
  if (isOverProduced) {
    status = "SOBRE_PRODUCIDA";
  } else if (isCompleted) {
    status = "CUMPLIDA";
  } else if (totalProduced > EPSILON) {
    status = "PARCIAL";
  }

  return {
    quoteId: quote.id || "",
    documentNumber: quote.documentNumber || "",
    customerName: quote.customerName || "",
    timestamp: quote.timestamp,
    confirmedBy: (quote as any).confirmedBy,
    lines,
    status
  };
}

export function formatQuoteDisplayId(quoteId: string): string {
  return (quoteId || "").replace(/^COT-/, "");
}

export const getTimestampMillis = (ts: any): number => {
  if (!ts) return Infinity;
  
  // SDK Cliente: .toMillis() 
  if (typeof ts.toMillis === "function") return ts.toMillis();
  // SDK Cliente: .seconds
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  // SDK Admin / backup serializado
  if (typeof ts._seconds === "number") return ts._seconds * 1000;
  // JS Date
  if (ts instanceof Date) return ts.getTime();
  // Milliseconds puros
  if (typeof ts === "number") return ts;
  
  console.warn("Timestamp no reconocido en sortQueueFifo:", ts);
  return Infinity;
};

export function sortQueueFifo(rows: QueueRow[]): QueueRow[] {
  return [...rows].sort((a, b) => {
    const tA = getTimestampMillis(a.timestamp);
    const tB = getTimestampMillis(b.timestamp);
    return tA - tB;
  });
}
