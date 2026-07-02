import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  orderBy,
} from "firebase/firestore";
import { getSystemSettings } from "@/services/settingsService";
import { ReportResult } from "../types";
import { Sale, SaleItem } from "@/types";
import {
  buildAluzincSalesReport,
  type AluzincSaleInput,
} from "@/modules/metallic-roofing/domain/aluzincSalesReport";
import {
  buildAluzincCostReport,
  buildAluzincProfitSummary,
  type AluzincCostSaleInput,
} from "@/modules/metallic-roofing/domain/aluzincCostReport";

/**
 * UTILS
 */
const getPeriodDates = (period: string, startDate?: string, endDate?: string) => {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  if (period === 'HISTORICO') {
    start = new Date(2020, 0, 1); // Way back
    end = new Date(2100, 0, 1); // Way forward
  } else if (period === 'HOY') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'SEMANA') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    start = new Date(now.setDate(diff));
    start.setHours(0, 0, 0, 0);
  } else if (period === 'MES') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
  } else if (period === 'MES_ANTERIOR') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    start.setHours(0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (period === 'TRIMESTRE') {
    const currentMonth = now.getMonth();
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
    start = new Date(now.getFullYear(), quarterStartMonth, 1);
    start.setHours(0, 0, 0, 0);
    end = new Date(now.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999);
  } else if (period === 'ANIO') {
    start = new Date(now.getFullYear(), 0, 1);
    start.setHours(0, 0, 0, 0);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else if (period === 'CUSTOM' && startDate && endDate) {
    start = new Date(`${startDate}T00:00:00`);
    end = new Date(`${endDate}T23:59:59`);
  } else {
    // Default This Month
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
  }

  return { start, end };
};

/**
 * P1: VENTAS POR PERÍODO
 */
export const runVentasPeriodo = async (params: any): Promise<ReportResult> => {
  const { period, startDate, endDate } = params;
  const { start, end } = getPeriodDates(period, startDate, endDate);

  const salesSnap = await getDocs(query(
    collection(db, "sales"),
    where("timestamp", ">=", Timestamp.fromDate(start)),
    where("timestamp", "<=", Timestamp.fromDate(end)),
    where("status", "==", "COMPLETED")
  ));

  const rows: any[] = [];
  let totalSales = 0;
  let totalProfit = 0;
  const dailyMap: Record<string, { sales: number; profit: number; count: number }> = {};

  salesSnap.forEach(doc => {
    const sale = doc.data();
    const date = sale.timestamp.toDate();
    const dateKey = date.toISOString().split('T')[0];

    if (!dailyMap[dateKey]) dailyMap[dateKey] = { sales: 0, profit: 0, count: 0 };
    dailyMap[dateKey].sales += sale.totalAmount;
    dailyMap[dateKey].profit += sale.totalProfit || 0;
    dailyMap[dateKey].count += 1;

    totalSales += sale.totalAmount;
    totalProfit += sale.totalProfit || 0;
  });

  Object.entries(dailyMap).sort().forEach(([date, data]) => {
    rows.push({
      date,
      sales: data.sales,
      profit: data.profit,
      count: data.count,
      avgTicket: data.sales / data.count,
      margin: (data.profit / (data.sales || 1)) * 100
    });
  });

  return {
    rows,
    totals: { sales: totalSales, profit: totalProfit, count: salesSnap.size },
    series: [
      { name: 'Ventas', data: rows.map(r => ({ label: r.date, value: r.sales })) },
      { name: 'Utilidad', data: rows.map(r => ({ label: r.date, value: r.profit })) }
    ]
  };
};

/**
 * P1: VENTAS POR LÍNEA
 */
export const runVentasLinea = async (params: any): Promise<ReportResult> => {
  const { period, startDate, endDate } = params;
  const { start, end } = getPeriodDates(period, startDate, endDate);

  const salesSnap = await getDocs(query(
    collection(db, "sales"),
    where("timestamp", ">=", Timestamp.fromDate(start)),
    where("timestamp", "<=", Timestamp.fromDate(end)),
    where("status", "==", "COMPLETED")
  ));

  const lineStats: Record<string, { sales: number; profit: number; units: number }> = {
    drywall: { sales: 0, profit: 0, units: 0 },
    roofing: { sales: 0, profit: 0, units: 0 },
    "metallic-roofing": { sales: 0, profit: 0, units: 0 },
    trading: { sales: 0, profit: 0, units: 0 },
    services: { sales: 0, profit: 0, units: 0 },
  };

  salesSnap.forEach(doc => {
    const sale = doc.data();
    sale.items?.forEach((item: any) => {
      const line = item.businessLine || 'drywall';
      if (lineStats[line]) {
        lineStats[line].sales += item.subtotal;
        lineStats[line].profit += (item.price - (item.cost || 0)) * item.quantity;
        lineStats[line].units += item.quantity;
      }
    });
  });

  const rows = Object.entries(lineStats).map(([line, data]) => ({
    line,
    sales: data.sales,
    profit: data.profit,
    units: data.units,
    margin: (data.profit / (data.sales || 1)) * 100
  })).filter(r => r.sales > 0);

  return {
    rows,
    series: [
      { name: 'Ventas', data: rows.map(r => ({ label: r.line, value: r.sales })) }
    ]
  };
};

/**
 * P1: VALORIZACIÓN DE STOCK
 */
export const runValorizacionStock = async (): Promise<ReportResult> => {
  const collections = ['inventory_stock', 'roofing_stock', 'metallic_roofing_stock', 'trading_stock'];
  const rows: any[] = [];
  let totalCap = 0;

  for (const col of collections) {
    const snap = await getDocs(collection(db, col));
    snap.forEach(docSnap => {
      const d = docSnap.data();
      const qty = d.totalQuantity || d.quantity || 0;
      if (qty <= 0) return;

      const avgCost = d.lastCostPerPiece || d.avgCost || 0;
      const val = qty * avgCost;
      totalCap += val;

      rows.push({
        sku: d.sku || docSnap.id,
        line: col.replace('_stock', '').replace('inventory', 'drywall'),
        qty,
        avgCost,
        totalValue: val
      });
    });
  }

  return {
    rows: rows.sort((a, b) => b.totalValue - a.totalValue),
    totals: { totalValue: totalCap }
  };
};

/**
 * P1: CONSUMO DE BOBINA POR LÍNEA
 */
export const runConsumoBobina = async (params: any): Promise<ReportResult> => {
  const { period, startDate, endDate } = params;
  const { start, end } = getPeriodDates(period, startDate, endDate);

  const logsSnap = await getDocs(query(
    collection(db, "production_logs"),
    where("timestamp", ">=", Timestamp.fromDate(start)),
    where("timestamp", "<=", Timestamp.fromDate(end)),
    where("status", "==", "ACTIVE")
  ));

  const lineMap: Record<string, { kg: number; scrap: number; pieces: number }> = {};

  logsSnap.forEach(doc => {
    const log = doc.data();
    const line = log.line || 'drywall';
    if (!lineMap[line]) lineMap[line] = { kg: 0, scrap: 0, pieces: 0 };
    lineMap[line].kg += log.reportedWeight || 0;
    lineMap[line].scrap += log.scrapWidth || 0;
    lineMap[line].pieces += log.piecesProduced || 0;
  });

  const rows = Object.entries(lineMap).map(([line, data]) => ({
    line,
    kg: data.kg,
    scrap: data.scrap,
    pieces: data.pieces,
    yield: data.kg > 0 ? (1 - (data.scrap / 1200)) * 100 : 100 // Simplificado
  }));

  return {
    rows,
    series: [{ name: 'Consumo KG', data: rows.map(r => ({ label: r.line, value: r.kg })) }]
  };
};

/**
 * P1: KARDEX
 */
export const runKardex = async (params: any): Promise<ReportResult> => {
  const { period, startDate, endDate, sku } = params;
  const { start, end } = getPeriodDates(period, startDate, endDate);

  let q = query(
    collection(db, "kardex_movements"),
    where("date", ">=", Timestamp.fromDate(start)),
    where("date", "<=", Timestamp.fromDate(end)),
    orderBy("date", "asc")
  );

  if (sku) {
    q = query(q, where("sku", "==", sku.toUpperCase()));
  }

  const snap = await getDocs(q);
  const rows = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      date: data.date.toDate().toISOString()
    };
  });

  return { rows };
};

/**
 * P1: RENTABILIDAD / MARGEN
 */
export const runRentabilidad = async (params: any): Promise<ReportResult> => {
  const { period, startDate, endDate } = params;
  const { start, end } = getPeriodDates(period, startDate, endDate);

  const salesSnap = await getDocs(query(
    collection(db, "sales"),
    where("timestamp", ">=", Timestamp.fromDate(start)),
    where("timestamp", "<=", Timestamp.fromDate(end)),
    where("status", "==", "COMPLETED")
  ));

  const stats: Record<string, { sales: number; profit: number; count: number }> = {};

  salesSnap.forEach(doc => {
    const sale = doc.data();
    sale.items?.forEach((item: any) => {
      const key = item.sku || 'GENERIC';
      if (!stats[key]) stats[key] = { sales: 0, profit: 0, count: 0 };
      stats[key].sales += item.subtotal;
      stats[key].profit += (item.price - (item.cost || 0)) * item.quantity;
      stats[key].count += item.quantity;
    });
  });

  const rows = Object.entries(stats).map(([sku, data]) => ({
    sku,
    sales: data.sales,
    profit: data.profit,
    units: data.count,
    margin: (data.profit / (data.sales || 1)) * 100
  })).sort((a, b) => b.profit - a.profit);

  return { rows };
};

/**
 * P1: COTIZACIONES Y CONVERSIÓN
 */
export const runCotizaciones = async (params: any): Promise<ReportResult> => {
  const { period, startDate, endDate } = params;
  const { start, end } = getPeriodDates(period, startDate, endDate);

  const salesSnap = await getDocs(query(
    collection(db, "sales"),
    where("timestamp", ">=", Timestamp.fromDate(start)),
    where("timestamp", "<=", Timestamp.fromDate(end))
  ));

  let total = 0;
  let converted = 0;
  let potentialValue = 0;
  let convertedValue = 0;

  salesSnap.forEach(doc => {
    const sale = doc.data();
    if (sale.status === 'QUOTATION' || sale.status === 'COMPLETED') {
      total++;
      potentialValue += sale.totalAmount;
      if (sale.status === 'COMPLETED' && sale.convertedFromQuote) {
        converted++;
        convertedValue += sale.totalAmount;
      }
    }
  });

  return {
    rows: [
      { metric: 'Total Cotizaciones', value: total },
      { metric: 'Convertidas a Venta', value: converted },
      { metric: 'Tasa de Conversión', value: (converted / (total || 1)) * 100, format: 'percent' },
      { metric: 'Valor Potencial', value: potentialValue, format: 'currency' },
      { metric: 'Valor Realizado', value: convertedValue, format: 'currency' },
    ]
  };
};

/**
 * P1: REPORTE SUNAT (IGV)
 */
export const runSunatIGV = async (params: any): Promise<ReportResult> => {
  const { period, startDate, endDate } = params;
  const { start, end } = getPeriodDates(period, startDate, endDate);

  const salesSnap = await getDocs(query(
    collection(db, "sales"),
    where("timestamp", ">=", Timestamp.fromDate(start)),
    where("timestamp", "<=", Timestamp.fromDate(end)),
    where("status", "==", "COMPLETED")
  ));

  const rows = salesSnap.docs.map(d => {
    const sale = d.data();
    const base = sale.totalAmount / 1.18;
    const igv = sale.totalAmount - base;
    return {
      id: sale.id,
      date: sale.timestamp.toDate().toLocaleDateString('es-PE'),
      customer: sale.customerName,
      doc: sale.documentNumber,
      base,
      igv,
      total: sale.totalAmount
    };
  });

  const totals = rows.reduce((acc, r) => ({
    base: acc.base + r.base,
    igv: acc.igv + r.igv,
    total: acc.total + r.total
  }), { base: 0, igv: 0, total: 0 });

  return { rows, totals };
};

/**
 * P1: STOCK BAJO
 */
export const runStockBajo = async (): Promise<ReportResult> => {
  const settings = await getSystemSettings();
  const threshold = settings?.lowStockProduct || 100;
  
  const collections = ['inventory_stock', 'roofing_stock', 'metallic_roofing_stock', 'trading_stock'];
  const rows: any[] = [];

  for (const col of collections) {
    const snap = await getDocs(collection(db, col));
    snap.forEach(docSnap => {
      const d = docSnap.data();
      const qty = d.totalQuantity || d.quantity || 0;
      if (qty <= threshold) {
        rows.push({
          sku: d.sku || docSnap.id,
          line: col.replace('_stock', '').replace('inventory', 'drywall'),
          qty,
          threshold
        });
      }
    });
  }

  return { rows: rows.sort((a, b) => a.qty - b.qty) };
};

/**
 * P1: VALORIZACIÓN POOL BOBINAS
 */
export const runValorizacionCoils = async (): Promise<ReportResult> => {
  const snap = await getDocs(collection(db, "coils"));
  const providerMap: Record<string, { kg: number; value: number }> = {};
  const finishMap: Record<string, { kg: number; value: number }> = {};

  snap.forEach(doc => {
    const coil = doc.data();
    if (coil.status === 'VOIDED' || coil.currentWeight <= 0) return;

    const kg = coil.currentWeight || 0;
    const val = kg * (coil.pricePerKg || 0);

    const provider = coil.metadata?.provider || 'DESCONOCIDO';
    if (!providerMap[provider]) providerMap[provider] = { kg: 0, value: 0 };
    providerMap[provider].kg += kg;
    providerMap[provider].value += val;

    const finish = coil.finish || 'SIN_ACABADO';
    if (!finishMap[finish]) finishMap[finish] = { kg: 0, value: 0 };
    finishMap[finish].kg += kg;
    finishMap[finish].value += val;
  });

  const rows = Object.entries(finishMap).map(([finish, data]) => ({
    finish,
    kg: data.kg,
    value: data.value,
    avgPrice: data.value / data.kg
  }));

  return { 
    rows, 
    totals: { 
      kg: Object.values(finishMap).reduce((a, b) => a + b.kg, 0),
      value: Object.values(finishMap).reduce((a, b) => a + b.value, 0)
    } 
  };
};

/**
 * P1: PRODUCCIÓN DETALLADA
 */
export const runProduccionDetalle = async (params: any): Promise<ReportResult> => {
  const { period, startDate, endDate } = params;
  const { start, end } = getPeriodDates(period, startDate, endDate);

  const logsSnap = await getDocs(query(
    collection(db, "production_logs"),
    where("timestamp", ">=", Timestamp.fromDate(start)),
    where("timestamp", "<=", Timestamp.fromDate(end)),
    where("status", "==", "ACTIVE")
  ));

  const rows = logsSnap.docs.map(d => {
    const log = d.data();
    return {
      id: d.id,
      date: log.timestamp.toDate().toLocaleDateString('es-PE'),
      line: log.line || 'drywall',
      sku: log.sku,
      pieces: log.piecesProduced,
      kg: log.reportedWeight,
      scrap: log.scrapWidth,
      operator: log.operatorId
    };
  });

  return { rows };
};

/**
 * P1: MARGEN BRUTO EJECUTIVO (P&L)
 */
export const runMargenBruto = async (params: any): Promise<ReportResult> => {
  const { period, startDate, endDate } = params;
  const { start, end } = getPeriodDates(period, startDate, endDate);

  const salesSnap = await getDocs(query(
    collection(db, "sales"),
    where("timestamp", ">=", Timestamp.fromDate(start)),
    where("timestamp", "<=", Timestamp.fromDate(end)),
    where("status", "==", "COMPLETED")
  ));

  const lineStats: Record<string, { sales: number; cost: number; profit: number }> = {
    drywall: { sales: 0, cost: 0, profit: 0 },
    roofing: { sales: 0, cost: 0, profit: 0 },
    "metallic-roofing": { sales: 0, cost: 0, profit: 0 },
    trading: { sales: 0, cost: 0, profit: 0 },
    services: { sales: 0, cost: 0, profit: 0 },
  };

  salesSnap.forEach(doc => {
    const sale = doc.data();
    sale.items?.forEach((item: any) => {
      const line = item.businessLine || 'drywall';
      if (lineStats[line]) {
        const itemSales = item.subtotal;
        const itemCost = (item.cost || 0) * item.quantity;
        lineStats[line].sales += itemSales;
        lineStats[line].cost += itemCost;
        lineStats[line].profit += (itemSales - itemCost);
      }
    });
  });

  const rows = Object.entries(lineStats).map(([line, data]) => ({
    line,
    sales: data.sales,
    cost: data.cost,
    profit: data.profit,
    margin: (data.profit / (data.sales || 1)) * 100
  })).filter(r => r.sales > 0);

  return { rows };
};

/**
 * P-M3: ALUZINC — VENTAS POR ESPESOR/COLOR
 * Usa weightSnapshot congelado al momento de venta. No recalcula.
 * Ventas USD sin exchangeRate se excluyen íntegramente.
 */
export const runAluzincVentas = async (params: {
  period: string;
  startDate?: string;
  endDate?: string;
  colorFilter?: string;
  espesorFilter?: string;
}): Promise<ReportResult> => {
  const { period, startDate, endDate, colorFilter, espesorFilter } = params;
  const { start, end } = getPeriodDates(period, startDate, endDate);

  const salesSnap = await getDocs(
    query(
      collection(db, "sales"),
      where("timestamp", ">=", Timestamp.fromDate(start)),
      where("timestamp", "<=", Timestamp.fromDate(end)),
      where("status", "==", "COMPLETED"),
    ),
  );

  type SaleDoc = Sale & { metadata?: { currency?: string; exchangeRate?: number } };

  const saleInputs: AluzincSaleInput[] = [];
  for (const docSnap of salesSnap.docs) {
    const sale = docSnap.data() as SaleDoc;
    const metallicItems = (sale.items ?? []).filter(
      (item: SaleItem) =>
        item.businessLine === "metallic-roofing" && item.weightSnapshot != null,
    );
    if (metallicItems.length === 0) continue;

    saleInputs.push({
      saleId: docSnap.id,
      currency: sale.metadata?.currency === "USD" ? "USD" : "PEN",
      exchangeRate: sale.metadata?.exchangeRate ?? null,
      items: metallicItems.map((item: SaleItem) => ({
        sku: item.sku,
        quantity: item.quantity,
        unitValue: item.unitValue,
        weightSnapshot: item.weightSnapshot ?? null,
      })),
    });
  }

  const result = buildAluzincSalesReport(saleInputs);
  let rows = result.rows;

  if (colorFilter) {
    if (Array.isArray(colorFilter)) {
      if (colorFilter.length > 0) {
        rows = rows.filter((r) => colorFilter.includes(r.colorFinish));
      }
    } else if (typeof colorFilter === "string" && colorFilter.trim() !== "") {
      const term = colorFilter.toLowerCase();
      rows = rows.filter((r) => r.colorFinish.toLowerCase().includes(term));
    }
  }

  if (espesorFilter) {
    if (Array.isArray(espesorFilter)) {
      if (espesorFilter.length > 0) {
        const numericList = espesorFilter.map((val) => parseFloat(val)).filter((n) => !isNaN(n));
        if (numericList.length > 0) {
          rows = rows.filter((r) => numericList.includes(r.thicknessMm));
        }
      }
    } else if (typeof espesorFilter === "string" && espesorFilter.trim() !== "") {
      const num = parseFloat(espesorFilter);
      if (!isNaN(num)) {
        rows = rows.filter((r) => r.thicknessMm === num);
      }
    }
  }

  const totals: Record<string, number> = rows.reduce(
    (acc, row) => ({
      pesoKg: acc.pesoKg + row.pesoKg,
      toneladas: acc.toneladas + row.toneladas,
      metrosTotales: acc.metrosTotales + row.metrosTotales,
      montoSoles: acc.montoSoles + row.montoSoles,
    }),
    { pesoKg: 0, toneladas: 0, metrosTotales: 0, montoSoles: 0 },
  );

  if (result.excludedSaleIds.length > 0) {
    totals.ventasExcluidas = result.excludedSaleIds.length;
  }

  return {
    rows,
    totals,
    series: [
      {
        name: "Peso (Kg)",
        data: rows.map((r) => ({ label: r.label, value: r.pesoKg })),
      },
    ],
  };
};

/**
 * P2: VENTAS POR PRODUCTO / SKU (DETALLADO)
 */
export const runVentasPorProducto = async (params: {
  period: string;
  startDate?: string;
  endDate?: string;
  line?: string;
  search?: string;
  includeVoided?: boolean;
}): Promise<ReportResult> => {
  const { period, startDate, endDate, line, search, includeVoided } = params;
  const { start, end } = getPeriodDates(period, startDate, endDate);

  const salesSnap = await getDocs(query(
    collection(db, "sales"),
    where("timestamp", ">=", Timestamp.fromDate(start)),
    where("timestamp", "<=", Timestamp.fromDate(end))
  ));

  const stats: Record<string, {
    sku: string;
    productName: string;
    line: string;
    quantity: number;
    amount: number;
    profit: number;
    salesCount: number;
    customers: Set<string>;
  }> = {};

  salesSnap.forEach(doc => {
    const sale = doc.data() as Sale;
    
    // Status Filter
    const isVoided = ['VOIDED', 'CANCELLED'].includes(sale.status);
    if (!includeVoided && isVoided) return;
    if (sale.status === 'QUOTATION') return;

    sale.items?.forEach((item: SaleItem) => {
      const itemLine = item.businessLine || 'drywall';
      
      // Line Filter
      if (line && line !== 'all' && itemLine !== line) return;

      // Search Filter
      const sku = item.sku || 'GENERIC';
      const productName = item.productName || 'Producto sin nombre';
      if (search && 
          !sku.toLowerCase().includes(search.toLowerCase()) && 
          !productName.toLowerCase().includes(search.toLowerCase())) {
        return;
      }

      if (!stats[sku]) {
        stats[sku] = {
          sku,
          productName,
          line: itemLine,
          quantity: 0,
          amount: 0,
          profit: 0,
          salesCount: 0,
          customers: new Set()
        };
      }

      const qty = item.quantity || 0;
      // Formula: monto = quantity * (unitValue ?? unitPrice)
      // cost = quantity * (baseCost ?? unitCost ?? 0)
      const itemAmount = qty * (item.unitValue ?? item.unitPrice ?? (item.subtotal ? item.subtotal / qty : 0));
      const itemCost = qty * (item.baseCost ?? item.unitCost ?? 0);
      
      let itemProfit = itemAmount - itemCost;
      // Retrocompatibilidad: si ya traía profit calculado y no hay unitValue/Price
      if (item.profit !== undefined && !item.unitValue && !item.unitPrice) {
        itemProfit = item.profit;
      }

      stats[sku].quantity += qty;
      stats[sku].amount += itemAmount;
      stats[sku].profit += itemProfit;
      stats[sku].salesCount += 1;
      stats[sku].customers.add(sale.customerName || sale.documentNumber || 'Anónimo');
    });
  });

  const rows = Object.values(stats).map(s => ({
    sku: s.sku,
    productName: s.productName,
    line: s.line,
    quantity: s.quantity,
    amount: s.amount,
    profit: s.profit,
    margin: (s.profit / (s.amount || 1)) * 100,
    numSales: s.salesCount,
    numCustomers: s.customers.size
  })).sort((a, b) => b.amount - a.amount);

  return {
    rows,
    totals: {
      amount: rows.reduce((acc, r) => acc + r.amount, 0),
      profit: rows.reduce((acc, r) => acc + r.profit, 0),
      quantity: rows.reduce((acc, r) => acc + r.quantity, 0)
    },
    series: [
      {
        name: 'Ventas (Monto)',
        data: rows.slice(0, 10).map(r => ({ label: r.sku, value: r.amount }))
      }
    ]
  };
};

// ─── P-M7: ALUZINC — COSTO ───────────────────────────────────────────────────

/** Agrupa el COSTO (baseCost × qty) de cobertura aluzinc vendida por espesor+color. */
export const runAluzincCosto = async (params: {
  period: string;
  startDate?: string;
  endDate?: string;
  colorFilter?: string;
  espesorFilter?: string;
}): Promise<ReportResult> => {
  const { period, startDate, endDate, colorFilter, espesorFilter } = params;
  const { start, end } = getPeriodDates(period, startDate, endDate);

  const salesSnap = await getDocs(
    query(
      collection(db, "sales"),
      where("timestamp", ">=", Timestamp.fromDate(start)),
      where("timestamp", "<=", Timestamp.fromDate(end)),
      where("status", "==", "COMPLETED"),
    ),
  );

  type SaleDoc = Sale & { metadata?: { currency?: string; exchangeRate?: number } };

  const costInputs: AluzincCostSaleInput[] = [];
  for (const docSnap of salesSnap.docs) {
    const sale = docSnap.data() as SaleDoc;
    const metallicItems = (sale.items ?? []).filter(
      (item: SaleItem) =>
        item.businessLine === "metallic-roofing" && item.weightSnapshot != null,
    );
    if (metallicItems.length === 0) continue;

    costInputs.push({
      saleId: docSnap.id,
      currency: sale.metadata?.currency === "USD" ? "USD" : "PEN",
      exchangeRate: sale.metadata?.exchangeRate ?? null,
      items: metallicItems.map((item: SaleItem) => ({
        sku: item.sku,
        quantity: item.quantity,
        baseCost: item.baseCost ?? 0,
        weightSnapshot: item.weightSnapshot ?? null,
      })),
    });
  }

  const result = buildAluzincCostReport(costInputs);
  let rows = result.rows;

  if (colorFilter) {
    if (Array.isArray(colorFilter)) {
      if (colorFilter.length > 0) {
        rows = rows.filter((r) => colorFilter.includes(r.colorFinish));
      }
    } else if (typeof colorFilter === "string" && colorFilter.trim() !== "") {
      const term = colorFilter.toLowerCase();
      rows = rows.filter((r) => r.colorFinish.toLowerCase().includes(term));
    }
  }

  if (espesorFilter) {
    if (Array.isArray(espesorFilter)) {
      if (espesorFilter.length > 0) {
        const numericList = espesorFilter.map((val) => parseFloat(val)).filter((n) => !isNaN(n));
        if (numericList.length > 0) {
          rows = rows.filter((r) => numericList.includes(r.thicknessMm));
        }
      }
    } else if (typeof espesorFilter === "string" && espesorFilter.trim() !== "") {
      const num = parseFloat(espesorFilter);
      if (!isNaN(num)) {
        rows = rows.filter((r) => r.thicknessMm === num);
      }
    }
  }

  const totals: Record<string, number> = {
    pesoKg: rows.reduce((acc, r) => acc + r.pesoKg, 0),
    toneladas: rows.reduce((acc, r) => acc + r.toneladas, 0),
    metrosTotales: rows.reduce((acc, r) => acc + r.metrosTotales, 0),
    costoTotal: rows.reduce((acc, r) => acc + r.costoTotal, 0),
  };

  if (result.excludedSaleIds.length > 0) {
    totals.ventasExcluidas = result.excludedSaleIds.length;
  }

  return {
    rows,
    totals,
    series: [
      {
        name: "Costo Total (S/)",
        data: rows.map((r) => ({ label: r.label, value: r.costoTotal })),
      },
    ],
  };
};

// ─── P-M7: ALUZINC — RESUMEN (Venta + Costo + Merma + Ganancia) ──────────────

type ScrapDocLike = { data: () => { status?: string; scrapCostPEN?: number } };
export function calculateTotalMermaSoles(scrapDocs: ScrapDocLike[]): number {
  return scrapDocs.reduce((acc, d) => {
    const data = d.data();
    if (data.status === "VOIDED") return acc;
    return acc + (data.scrapCostPEN ?? 0);
  }, 0);
}

/** Combina ventas, costo y merma del periodo en un resumen por color. */
export const runAluzincResumen = async (params: {
  period: string;
  startDate?: string;
  endDate?: string;
}): Promise<ReportResult> => {
  const { period, startDate, endDate } = params;
  const { start, end } = getPeriodDates(period, startDate, endDate);

  // Una sola fetch de ventas para construir tanto inputs de ventas como de costo
  const salesSnap = await getDocs(
    query(
      collection(db, "sales"),
      where("timestamp", ">=", Timestamp.fromDate(start)),
      where("timestamp", "<=", Timestamp.fromDate(end)),
      where("status", "==", "COMPLETED"),
    ),
  );

  type SaleDoc = Sale & { metadata?: { currency?: string; exchangeRate?: number } };

  const saleInputs: AluzincSaleInput[] = [];
  const costInputs: AluzincCostSaleInput[] = [];

  for (const docSnap of salesSnap.docs) {
    const sale = docSnap.data() as SaleDoc;
    const metallicItems = (sale.items ?? []).filter(
      (item: SaleItem) =>
        item.businessLine === "metallic-roofing" && item.weightSnapshot != null,
    );
    if (metallicItems.length === 0) continue;

    const currency = sale.metadata?.currency === "USD" ? "USD" : "PEN";
    const exchangeRate = sale.metadata?.exchangeRate ?? null;

    saleInputs.push({
      saleId: docSnap.id,
      currency,
      exchangeRate,
      items: metallicItems.map((item: SaleItem) => ({
        sku: item.sku,
        quantity: item.quantity,
        unitValue: item.unitValue,
        weightSnapshot: item.weightSnapshot ?? null,
      })),
    });

    costInputs.push({
      saleId: docSnap.id,
      currency,
      exchangeRate,
      items: metallicItems.map((item: SaleItem) => ({
        sku: item.sku,
        quantity: item.quantity,
        baseCost: item.baseCost ?? 0,
        weightSnapshot: item.weightSnapshot ?? null,
      })),
    });
  }

  // Merma del periodo (scrap_logs)
  const scrapSnap = await getDocs(
    query(
      collection(db, "scrap_logs"),
      where("timestamp", ">=", Timestamp.fromDate(start)),
      where("timestamp", "<=", Timestamp.fromDate(end)),
    ),
  );
  const totalMermaSoles = calculateTotalMermaSoles(scrapSnap.docs);

  const ventasResult = buildAluzincSalesReport(saleInputs);
  const costoResult = buildAluzincCostReport(costInputs);
  const summary = buildAluzincProfitSummary(ventasResult, costoResult, totalMermaSoles);

  return {
    rows: summary.rows,
    totals: {
      ventaSoles: summary.totals.ventaSoles,
      costoSoles: summary.totals.costoSoles,
      mermaSoles: summary.totals.mermaSoles,
      gananciaSoles: summary.totals.gananciaSoles,
    },
    series: [
      {
        name: "Venta vs Costo",
        data: summary.rows.map((r) => ({
          label: r.colorFinish || "NATURAL",
          value: r.ventaSoles,
        })),
      },
    ],
  };
};
