import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { getSystemSettings } from "./settingsService";
import { BusinessLine, SaleItem } from "@/types";

export type TimeFilter = "TODAY" | "7D" | "MONTH" | "LAST_MONTH" | "YEAR";

export interface LinePerformance {
  line: BusinessLine;
  sales: number;
  profit: number;
  units: number;
}


export interface DashboardData {
  kpis: {
    totalSales: number;
    salesChange: number; // vs previous period (%)
    totalProfit: number;
    profitMargin: number;
    salesCount: number;
    avgTicket: number;
    inventoryValue: number;
  };
  lines: LinePerformance[];
  coils: {
    totalKg: number;
    availableCount: number;
    poolValue: number;
    byFinish: Record<string, number>;
    alerts: string[];
  };
  production: {
    byLine: Record<string, { pieces: number; kg: number; scrap: number }>;
  };
  alerts: {
    type: "LOW_STOCK" | "MISSING_FINISH" | "EXPIRING_QUOTE" | "LOW_MARGIN";
    message: string;
    target: string;
    link: string;
  }[];
  topProducts: { sku: string; quantity: number; sales: number }[];
  topCustomers: { name: string; sales: number }[];
  evolutionChart: { label: string; sales: number; profit: number }[];
}

export const getDashboardData = async (filter: TimeFilter = "MONTH"): Promise<DashboardData | null> => {
  try {
    const settings = await getSystemSettings();
    const lowStockThreshold = settings?.lowStockProduct || 100;
    const minMargin = settings?.minMarginPercent || 15;

    const now = new Date();
    let startDate = new Date();
    let prevStartDate = new Date();
    let prevEndDate = new Date();

    if (filter === "TODAY") {
      startDate.setHours(0, 0, 0, 0);
      prevStartDate.setDate(now.getDate() - 1);
      prevStartDate.setHours(0, 0, 0, 0);
      prevEndDate.setDate(now.getDate() - 1);
      prevEndDate.setHours(23, 59, 59, 999);
    } else if (filter === "7D") {
      startDate.setDate(now.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      prevStartDate.setDate(startDate.getDate() - 7);
      prevEndDate.setDate(startDate.getDate() - 1);
    } else if (filter === "MONTH") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (filter === "LAST_MONTH") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      now.setTime(lastDay.getTime()); // Para el gráfico
      startDate.setHours(0, 0, 0, 0);
      // Previous of last month
      prevStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      prevEndDate = new Date(now.getFullYear(), now.getMonth() - 1, 0);
    } else if (filter === "YEAR") {
      startDate = new Date(now.getFullYear(), 0, 1);
      prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
      prevEndDate = new Date(now.getFullYear() - 1, 11, 31);
    }

    // 1. FETCH SALES (Current and Previous for change calc)
    const salesSnap = await getDocs(query(
      collection(db, "sales"),
      where("timestamp", ">=", Timestamp.fromDate(prevStartDate))
    ));

    let totalSales = 0;
    let totalProfit = 0;
    let prevTotalSales = 0;
    let salesCount = 0;
    let pendingQuotes = 0;

    const lineMap: Record<string, LinePerformance> = {
      drywall: { line: "drywall", sales: 0, profit: 0, units: 0 },
      roofing: { line: "roofing", sales: 0, profit: 0, units: 0 },
      "metallic-roofing": { line: "metallic-roofing", sales: 0, profit: 0, units: 0 },
      trading: { line: "trading", sales: 0, profit: 0, units: 0 },
      services: { line: "services", sales: 0, profit: 0, units: 0 },
    };

    const topProductsMap: Record<string, { sku: string; quantity: number; sales: number }> = {};
    const topCustomersMap: Record<string, number> = {};
    const chartMap: Record<string, { sales: number; profit: number }> = {};

    const dashboardAlerts: DashboardData["alerts"] = [];

    salesSnap.forEach(doc => {
      const sale = doc.data();
      if (!sale.timestamp) return;
      const saleDate = sale.timestamp.toDate();

      if (sale.status === "QUOTATION") {
        if (saleDate >= startDate) pendingQuotes++;
        // Alerta: Cotización por vencer
        if (sale.validUntil && sale.validUntil.toDate() < new Date(now.getTime() + 48 * 3600 * 1000)) {
           dashboardAlerts.push({
             type: "EXPIRING_QUOTE",
             message: `Cotización ${sale.id} vence pronto`,
             target: sale.customerName,
             link: `/admin/sales`
           });
        }
        return;
      }

      if (sale.status !== "COMPLETED") return;

      if (saleDate >= startDate) {
        totalSales += sale.totalAmount;
        totalProfit += sale.totalProfit || 0;
        salesCount++;

        // Margin alert
        const margin = (sale.totalProfit / sale.totalAmount) * 100;
        if (margin < minMargin) {
          dashboardAlerts.push({
            type: "LOW_MARGIN",
            message: `Venta ${sale.id} con bajo margen (${margin.toFixed(1)}%)`,
            target: sale.customerName,
            link: `/admin/sales`
          });
        }

        // Top customer
        topCustomersMap[sale.customerName] = (topCustomersMap[sale.customerName] || 0) + sale.totalAmount;

        // Line and product breakdown
        (sale.items as SaleItem[])?.forEach((item) => {
          const line = item.businessLine || "drywall";
          if (lineMap[line]) {
            const itemSales = item.subtotal || ((item.unitValue || 0) * (item.quantity || 0));
            const itemProfit = item.profit || (((item.unitValue || 0) - (item.baseCost || 0)) * (item.quantity || 0));
            
            lineMap[line].sales += itemSales;
            lineMap[line].profit += itemProfit;
            lineMap[line].units += item.quantity || 0;
          }

          if (!topProductsMap[item.sku]) {
            topProductsMap[item.sku] = { sku: item.sku, quantity: 0, sales: 0 };
          }
          topProductsMap[item.sku].quantity += item.quantity || 0;
          topProductsMap[item.sku].sales += item.subtotal || ((item.unitValue || 0) * (item.quantity || 0));
        });

        // Evolution key
        let key = "";
        if (filter === "YEAR") {
          key = saleDate.toLocaleDateString("es-PE", { month: "short" }).toUpperCase();
        } else {
          key = saleDate.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
        }
        if (!chartMap[key]) chartMap[key] = { sales: 0, profit: 0 };
        chartMap[key].sales += sale.totalAmount;
        chartMap[key].profit += sale.totalProfit || 0;
      } else if (saleDate >= prevStartDate && saleDate <= prevEndDate) {
        prevTotalSales += sale.totalAmount;
      }
    });

    // 2. FETCH INVENTORY VALUE (All lines)
    const stockCollections = [
      "inventory_stock", 
      "roofing_stock", 
      "metallic_roofing_stock", 
      "trading_stock"
    ];
    
    let totalInventoryValue = 0;
    for (const col of stockCollections) {
      const snap = await getDocs(collection(db, col));
      snap.forEach(doc => {
        const d = doc.data();
        const value = d.totalValue || (d.totalQuantity * (d.lastCostPerPiece || d.avgCost || 0));
        totalInventoryValue += value;
        
        const qty = d.totalQuantity || d.quantity || 0;
        if (qty <= lowStockThreshold) {
          dashboardAlerts.push({
            type: "LOW_STOCK",
            message: `Stock crítico: ${d.sku}`,
            target: `${qty} unidades`,
            link: `/admin/reports`
          });
        }
      });
    }

    // 3. FETCH COILS
    const coilsSnap = await getDocs(collection(db, "coils"));
    let coilKg = 0;
    let availableCoils = 0;
    let poolValue = 0;
    const finishMap: Record<string, number> = {};
    const coilAlerts: string[] = [];

    coilsSnap.forEach(doc => {
      const coil = doc.data();
      if (coil.status === "VOIDED") return;
      
      if (coil.status === "AVAILABLE" || coil.status === "IN_PROGRESS") {
        coilKg += coil.currentWeight || 0;
        availableCoils++;
        poolValue += (coil.currentWeight || 0) * (coil.pricePerKg || 0);
        
        if (coil.finish) {
          finishMap[coil.finish] = (finishMap[coil.finish] || 0) + (coil.currentWeight || 0);
        } else {
          dashboardAlerts.push({
            type: "MISSING_FINISH",
            message: `Bobina sin acabado: ${doc.id}`,
            target: "Requiere edición",
            link: `/admin/coils`
          });
        }
        
        if (coil.currentWeight < 100) {
          coilAlerts.push(`Peso bajo en serie ${doc.id}`);
        }
      }
    });

    // 4. FETCH PRODUCTION
    const prodLogsSnap = await getDocs(query(
      collection(db, "production_logs"),
      where("timestamp", ">=", Timestamp.fromDate(startDate)),
      where("status", "==", "ACTIVE")
    ));
    
    const prodLineMap: Record<string, { pieces: number; kg: number; scrap: number }> = {};
    prodLogsSnap.forEach(doc => {
      const log = doc.data();
      const line = log.line || "drywall";
      if (!prodLineMap[line]) prodLineMap[line] = { pieces: 0, kg: 0, scrap: 0 };
      prodLineMap[line].pieces += log.piecesProduced || 0;
      prodLineMap[line].kg += log.reportedWeight || 0;
      prodLineMap[line].scrap += log.scrapWidth || 0;
    });

    // Formatting outputs
    const salesChange = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : 0;
    
    return {
      kpis: {
        totalSales,
        salesChange,
        totalProfit,
        profitMargin: totalSales > 0 ? (totalProfit / totalSales) * 100 : 0,
        salesCount,
        avgTicket: salesCount > 0 ? totalSales / salesCount : 0,
        inventoryValue: totalInventoryValue + poolValue,
      },
      lines: Object.values(lineMap),
      coils: {
        totalKg: coilKg,
        availableCount: availableCoils,
        poolValue,
        byFinish: finishMap,
        alerts: coilAlerts,
      },
      production: {
        byLine: prodLineMap,
      },
      alerts: dashboardAlerts.slice(0, 10),
      topProducts: Object.values(topProductsMap).sort((a, b) => b.sales - a.sales).slice(0, 5),
      topCustomers: Object.keys(topCustomersMap).map(name => ({ name, sales: topCustomersMap[name] })).sort((a, b) => b.sales - a.sales).slice(0, 5),
      evolutionChart: Object.keys(chartMap).map(label => ({
        label,
        sales: chartMap[label].sales,
        profit: chartMap[label].profit,
      })),
    };
  } catch (error) {
    console.error("Error obteniendo datos del dashboard:", error);
    return null;
  }
};

