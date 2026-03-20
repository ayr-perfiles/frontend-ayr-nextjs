import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { getSystemSettings } from "./settingsService";

export type TimeFilter = "7D" | "MONTH" | "YEAR";

export const getDashboardData = async (filter: TimeFilter = "MONTH") => {
  try {
    const settings = await getSystemSettings();
    const lowStockThreshold = settings?.lowStockProduct || 100;

    const stockSnap = await getDocs(collection(db, "inventory_stock"));
    const lowStockItems: { sku: string; quantity: number }[] = [];

    stockSnap.forEach((doc) => {
      const data = doc.data();
      if (data.totalQuantity <= lowStockThreshold) {
        lowStockItems.push({ sku: data.sku, quantity: data.totalQuantity });
      }
    });

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    // Determinar la fecha de inicio según el filtro
    let startDate = new Date();
    if (filter === "7D") {
      startDate.setDate(now.getDate() - 6); // 7 días incluyéndome
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === "MONTH") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filter === "YEAR") {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    const salesQuery = query(
      collection(db, "sales"),
      where("timestamp", ">=", Timestamp.fromDate(startDate)),
    );
    const salesSnap = await getDocs(salesQuery);

    let todaySales = 0;
    let periodProfit = 0;
    let pendingQuotes = 0;
    const chartMap: Record<string, number> = {};
    const topProductsMap: Record<string, number> = {};

    // Pre-llenar el mapa de gráficos para evitar huecos vacíos
    if (filter === "7D") {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - i,
        );
        chartMap[
          d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" })
        ] = 0;
      }
    } else if (filter === "MONTH") {
      const daysInMonth = now.getDate(); // Hasta el día actual
      for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), i);
        chartMap[
          d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" })
        ] = 0;
      }
    } else if (filter === "YEAR") {
      // Para el año, agruparemos por mes
      for (let i = 0; i <= now.getMonth(); i++) {
        const d = new Date(now.getFullYear(), i, 1);
        chartMap[
          d.toLocaleDateString("es-PE", { month: "short" }).toUpperCase()
        ] = 0;
      }
    }

    salesSnap.forEach((doc) => {
      const sale = doc.data();
      if (!sale.timestamp) return;
      const saleDate = sale.timestamp.toDate();

      if (sale.status === "QUOTATION") {
        pendingQuotes++;
      } else if (sale.status === "COMPLETED") {
        // Siempre acumulamos la ganancia del periodo seleccionado
        periodProfit += sale.totalProfit || 0;

        if (saleDate >= startOfToday) {
          todaySales += sale.totalAmount || 0;
        }

        // Agrupar en el gráfico
        let key = "";
        if (filter === "YEAR") {
          key = saleDate
            .toLocaleDateString("es-PE", { month: "short" })
            .toUpperCase();
        } else {
          key = saleDate.toLocaleDateString("es-PE", {
            day: "2-digit",
            month: "short",
          });
        }

        if (chartMap[key] !== undefined) {
          chartMap[key] += sale.totalAmount || 0;
        } else if (filter !== "7D") {
          chartMap[key] = sale.totalAmount || 0;
        }

        // Sumar items para el ranking
        sale.items?.forEach((item: any) => {
          topProductsMap[item.sku] =
            (topProductsMap[item.sku] || 0) + item.quantity;
        });
      }
    });

    const evolutionChart = Object.keys(chartMap).map((date) => ({
      fecha: date,
      ventas: chartMap[date],
    }));

    const topProductsChart = Object.keys(topProductsMap)
      .map((sku) => ({ sku, cantidad: topProductsMap[sku] }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    return {
      todaySales,
      periodProfit,
      pendingQuotes,
      lowStockItems: lowStockItems.sort((a, b) => a.quantity - b.quantity),
      evolutionChart,
      topProductsChart,
    };
  } catch (error) {
    console.error("Error obteniendo datos del dashboard:", error);
    return null;
  }
};
