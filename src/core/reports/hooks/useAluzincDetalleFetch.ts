import { useState, useEffect } from "react";
import { collection, query, where, getDocs, getDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";
import { getPeriodDates } from "@/core/reports/services/reportFunctions";
import { getAllActiveFulfillmentLogs } from "@/modules/metallic-roofing/services/productionService";
import type { 
  AluzincSaleRead, 
  AluzincSaleItemRead, 
  AluzincProductRead 
} from "@/core/reports/aluzincDetalleLogic";
import type { ProductionLog } from "@/types";

interface UseAluzincDetalleFetchResult {
  sales: AluzincSaleRead[];
  quotes: Map<string, AluzincSaleRead>;
  products: Map<string, AluzincProductRead>;
  logs: ProductionLog[];
  loading: boolean;
  error: Error | null;
}

function mapFamily(val: unknown): AluzincProductRead['family'] {
  if (val === 'COBERTURA' || val === 'PLANCHA') return val;
  return 'COBERTURA';
}
function mapUnit(val: unknown): AluzincProductRead['unit'] {
  if (val === 'PIEZA' || val === 'METRO' || val === 'KILOGRAMO' || val === 'TONELADA') return val;
  return 'PIEZA';
}
function mapSaleItem(raw: unknown): AluzincSaleItemRead {
  if (!raw || typeof raw !== 'object') {
    return { sku: 'UNKNOWN', quantity: 0, unitValue: 0, profit: 0, baseCost: 0, businessLine: '' };
  }
  const r = raw as Record<string, unknown>;
  return {
    sku: typeof r.sku === 'string' ? r.sku : 'UNKNOWN',
    quantity: typeof r.quantity === 'number' ? r.quantity : 0,
    unitValue: typeof r.unitValue === 'number' ? r.unitValue : 0,
    profit: typeof r.profit === 'number' ? r.profit : 0,
    baseCost: typeof r.baseCost === 'number' ? r.baseCost : 0,
    businessLine: typeof r.businessLine === 'string' ? r.businessLine : '',
    costSource: typeof r.costSource === 'string' ? r.costSource : undefined,
  };
}

export function useAluzincDetalleFetch(
  period: string,
  startDate?: string,
  endDate?: string
): UseAluzincDetalleFetchResult {
  const [sales, setSales] = useState<AluzincSaleRead[]>([]);
  const [quotes, setQuotes] = useState<Map<string, AluzincSaleRead>>(new Map());
  const [products, setProducts] = useState<Map<string, AluzincProductRead>>(new Map());
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const { start, end } = getPeriodDates(period, startDate, endDate);
        let salesQ = query(
          collection(db, "sales"),
          where("status", "==", "COMPLETED")
        );
        
        if (period !== 'HISTORICO') {
          salesQ = query(
            salesQ,
            where("timestamp", ">=", Timestamp.fromDate(start)),
            where("timestamp", "<=", Timestamp.fromDate(end))
          );
        }

        const [salesSnap, logsData, catalogSnap] = await Promise.all([
          getDocs(salesQ),
          getAllActiveFulfillmentLogs(),
          getDocs(collection(db, "metallic_roofing_catalog"))
        ]);

        const rawSales: AluzincSaleRead[] = [];
        const quoteIds = new Set<string>();

        for (const d of salesSnap.docs) {
          const data = d.data();
          if (!data.businessLines || !Array.isArray(data.businessLines) || !data.businessLines.includes('metallic-roofing')) {
            continue;
          }

          const rawItems = Array.isArray(data.items) ? data.items : [];
          const items: AluzincSaleItemRead[] = rawItems.map(mapSaleItem);

          rawSales.push({
            status: data.status,
            customerDocument: data.customerDocument,
            documentNumber: data.documentNumber,
            customerName: data.customerName,
            relatedQuotationId: data.relatedQuotationId,
            isFulfilled: data.isFulfilled,
            items
          });

          if (data.relatedQuotationId) {
            quoteIds.add(data.relatedQuotationId);
          }
        }

        const quotesMap = new Map<string, AluzincSaleRead>();
        const quotePromises = Array.from(quoteIds).map(async (id) => {
          const docRef = doc(db, "sales", id);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            const rawItems = Array.isArray(data.items) ? data.items : [];
            const items: AluzincSaleItemRead[] = rawItems.map(mapSaleItem);
            
            quotesMap.set(id, {
              status: data.status,
              customerDocument: data.customerDocument,
              documentNumber: data.documentNumber,
              customerName: data.customerName,
              relatedQuotationId: data.relatedQuotationId,
              isFulfilled: data.isFulfilled,
              items
            });
          } else {
            console.warn(`Quote with ID ${id} linked from sale does not exist.`);
          }
        });
        await Promise.all(quotePromises);

        const productsMap = new Map<string, AluzincProductRead>();
        for (const d of catalogSnap.docs) {
          const raw = d.data();
                    productsMap.set(d.id, {
            sku: d.id,
            displayName: typeof raw.displayName === 'string' ? raw.displayName : '',
            family: mapFamily(raw.family),
            finish: typeof raw.finish === 'string' ? raw.finish : '',
            thickness: typeof raw.thickness === 'number' ? raw.thickness : 0,
            unit: mapUnit(raw.unit),
            active: typeof raw.active === 'boolean' ? raw.active : false,
            avgCost: typeof raw.avgCost === 'number' ? raw.avgCost : 0,
            widthMm: typeof raw.widthMm === 'number' ? raw.widthMm : undefined,
            densityFactor: typeof raw.densityFactor === 'number' ? raw.densityFactor : undefined,
          });
        }

        if (mounted) {
          setSales(rawSales);
          setQuotes(quotesMap);
          setProducts(productsMap);
          setLogs(logsData);
        }
      } catch (err) {
        console.error("Error fetching Aluzinc Detalle data:", err);
        const e = err instanceof Error ? err : new Error(String(err));
        if (mounted) setError(e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, [period, startDate, endDate]);

  return { sales, quotes, products, logs, loading, error };
}








