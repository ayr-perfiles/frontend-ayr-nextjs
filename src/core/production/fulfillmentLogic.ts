import type { SaleItem, ProductionLog } from "@/types";

export interface FulfillmentRow {
  sku: string;
  quantityRequested: number;
  quantityProduced: number;
  pending: number;
  pct: number;
  itemRef?: SaleItem; // To keep reference to original item props if needed, e.g. product names
}

// Nota: la matemática de agrupación por SKU (produced/pending/pct) está compartida con queueLogic.ts, mantener en sync!
export function quoteFulfillmentRows(items: SaleItem[], logs: ProductionLog[]): FulfillmentRow[] {
  const metallicItems = items.filter(item => item.businessLine === "metallic-roofing");
  const validLogs = logs.filter(log => log.status !== "VOIDED");

  const skuGroups: Record<string, FulfillmentRow> = {};

  metallicItems.forEach(item => {
    if (!skuGroups[item.sku]) {
      skuGroups[item.sku] = {
        sku: item.sku,
        quantityRequested: 0,
        quantityProduced: 0,
        pending: 0,
        pct: 0,
        itemRef: item // Store reference to the first item for UI purposes (like pieceLength if needed, though strictly it's grouped)
      };
    }
    skuGroups[item.sku].quantityRequested += (item.quantity || 0);
  });

  return Object.values(skuGroups).map(group => {
    const quantityProduced = validLogs
      .filter(l => l.sku === group.sku)
      .reduce((acc, l) => acc + (l.piecesProduced || 0), 0);
      
    const pct = group.quantityRequested > 0 ? (quantityProduced / group.quantityRequested) * 100 : 0;
    const pending = Math.max(0, group.quantityRequested - quantityProduced);
    
    return {
      ...group,
      quantityProduced,
      pct,
      pending
    };
  });
}

export function hasActiveProduction(logs: { status?: string }[]): boolean {
  return logs.some((log) => log.status === "ACTIVE");
}

export function bucketLogsBySourceId(logs: ProductionLog[]): Map<string, ProductionLog[]> {
  const buckets = new Map<string, ProductionLog[]>();
  for (const log of logs) {
    const sourceId = log.source?.id;
    if (!sourceId) continue;
    const bucket = buckets.get(sourceId) ?? [];
    bucket.push(log);
    buckets.set(sourceId, bucket);
  }
  return buckets;
}
