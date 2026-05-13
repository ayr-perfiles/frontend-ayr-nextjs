import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  getAggregateFromServer,
  sum,
  count,
} from "firebase/firestore";
import { ProductionLog } from "@/types";

export interface ExtendedLog extends ProductionLog {
  scrapWeightKg?: number;
}

export interface FetchYieldParams {
  pageSize: number;
  searchTerm: string;
  startDate: string;
  endDate: string;
  direction?: "first" | "next" | "prev";
  cursorDoc?: any;
}

export const getYieldReport = async (params: FetchYieldParams) => {
  const {
    pageSize,
    searchTerm,
    startDate,
    endDate,
    direction = "first",
    cursorDoc,
  } = params;

  try {
    const collRef = collection(db, "production_logs");
    let baseConstraints: any[] = [];

    // 1. FILTROS BASE
    if (startDate)
      baseConstraints.push(
        where("timestamp", ">=", new Date(`${startDate}T00:00:00`)),
      );
    if (endDate)
      baseConstraints.push(
        where("timestamp", "<=", new Date(`${endDate}T23:59:59`)),
      );
    if (searchTerm)
      baseConstraints.push(
        where("parentCoilId", "==", searchTerm.trim().toUpperCase()),
      );

    // 2. CÁLCULO DE KPIs CON AGREGACIONES EN EL SERVIDOR (1 sola lectura de BD)
    const kpiQuery = query(collRef, ...baseConstraints);
    const aggregateSnapshot = await getAggregateFromServer(kpiQuery, {
      totalOps: count(),
      totalUsedWidth: sum("totalUsedWidth"),
      totalScrapWidth: sum("scrapWidth"),
    });

    const aggregates = aggregateSnapshot.data();
    const usedMm = aggregates.totalUsedWidth || 0;
    const scrapMm = aggregates.totalScrapWidth || 0;
    const totalMm = usedMm + scrapMm;
    const avgEfficiency = totalMm > 0 ? (usedMm / totalMm) * 100 : 0;
    const totalScrapKg = scrapMm * 0.85;

    // 3. OBTENER SOLO LOS REGISTROS PARA LA TABLA (Paginación Real)
    baseConstraints.push(orderBy("timestamp", "desc"));
    let paginationConstraints = [...baseConstraints];

    if (direction === "next" && cursorDoc) {
      paginationConstraints.push(startAfter(cursorDoc));
      paginationConstraints.push(limit(pageSize));
    } else if (direction === "prev" && cursorDoc) {
      paginationConstraints.push(endBefore(cursorDoc));
      paginationConstraints.push(limitToLast(pageSize));
    } else {
      paginationConstraints.push(limit(pageSize));
    }

    const tableQuery = query(collRef, ...paginationConstraints);
    const snap = await getDocs(tableQuery);

    const logs = snap.docs.map((doc) => {
      const data = doc.data();
      const scrapKg = (data.scrapWidth || 0) * 0.85;
      return { id: doc.id, ...data, scrapWeightKg: scrapKg } as ExtendedLog;
    });

    return {
      logs,
      stats: {
        totalUsedMm: usedMm,
        totalScrapMm: Number(scrapMm.toFixed(2)),
        totalScrapKg: Number(totalScrapKg.toFixed(2)),
        avgEfficiency,
        totalOps: aggregates.totalOps,
      },
      firstDoc: snap.docs.length > 0 ? snap.docs[0] : null,
      lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    };
  } catch (error) {
    console.error("Error generando reporte:", error);
    throw new Error("No se pudo cargar el reporte de rendimiento.");
  }
};

// NUEVO: Función exclusiva para descargar Excel masivo (Sin paginación)
export const fetchAllYieldForExport = async (
  startDate: string,
  endDate: string,
  searchTerm: string,
) => {
  const collRef = collection(db, "production_logs");
  let baseConstraints: any[] = [];

  if (startDate)
    baseConstraints.push(
      where("timestamp", ">=", new Date(`${startDate}T00:00:00`)),
    );
  if (endDate)
    baseConstraints.push(
      where("timestamp", "<=", new Date(`${endDate}T23:59:59`)),
    );
  if (searchTerm)
    baseConstraints.push(
      where("parentCoilId", "==", searchTerm.trim().toUpperCase()),
    );

  baseConstraints.push(orderBy("timestamp", "desc"));

  const snap = await getDocs(query(collRef, ...baseConstraints));

  return snap.docs.map((doc) => {
    const data = doc.data();
    const scrapKg = (data.scrapWidth || 0) * 0.85;
    return { id: doc.id, ...data, scrapWeightKg: scrapKg } as ExtendedLog;
  });
};

// --- AGREGA ESTO AL FINAL DE TU src/services/reportsService.ts ---

/**
 * REPORTE 1: VENTAS Y RENTABILIDAD POR PRODUCTO (TOP SELLERS)
 * Agrupa todas las ventas completadas en un rango de fechas y calcula
 * unidades vendidas, ingresos reales (sin IGV), costos y ganancia neta por SKU.
 */
export const getProductSalesReport = async (
  startDate: string,
  endDate: string,
) => {
  try {
    let constraints: any[] = [where("status", "==", "COMPLETED")];

    if (startDate) {
      constraints.push(
        where("timestamp", ">=", new Date(`${startDate}T00:00:00`)),
      );
    }
    if (endDate) {
      constraints.push(
        where("timestamp", "<=", new Date(`${endDate}T23:59:59`)),
      );
    }

    const salesSnap = await getDocs(
      query(collection(db, "sales"), ...constraints),
    );
    const productStats: Record<string, any> = {};

    salesSnap.docs.forEach((docSnap) => {
      const sale = docSnap.data();

      sale.items?.forEach((item: any) => {
        if (!item.sku || item.sku === "GENERIC") return;

        if (!productStats[item.sku]) {
          productStats[item.sku] = {
            sku: item.sku,
            name: item.productName || item.sku,
            quantitySold: 0,
            revenueWithoutIGV: 0,
            totalCost: 0,
            netProfit: 0,
          };
        }

        const qty = item.quantity || 0;
        // El unitValue es el precio real sin IGV. Si no existe, lo calculamos.
        const unitValue = item.unitValue || item.unitPrice / 1.18;
        const baseCost = item.baseCost || 0;

        productStats[item.sku].quantitySold += qty;
        productStats[item.sku].revenueWithoutIGV += qty * unitValue;
        productStats[item.sku].totalCost += qty * baseCost;
        productStats[item.sku].netProfit += qty * unitValue - qty * baseCost;
      });
    });

    // Convertimos el diccionario a un Array y lo ordenamos por Ganancia Neta (los más rentables arriba)
    return Object.values(productStats).sort(
      (a, b) => b.netProfit - a.netProfit,
    );
  } catch (error) {
    console.error("Error generando reporte de ventas por producto:", error);
    throw new Error("No se pudo generar el reporte de ventas.");
  }
};

/**
 * REPORTE 2: VALORIZACIÓN FINANCIERA DEL STOCK ACTUAL
 * Cruza el inventario físico con los costos promedio para saber
 * cuánto capital inmovilizado hay en el almacén por producto.
 */
export const getInventoryValuationReport = async () => {
  try {
    const [catalogSnap, stockSnap] = await Promise.all([
      getDocs(collection(db, "products")),
      getDocs(collection(db, "inventory_stock")),
    ]);

    const catalogMap: Record<string, any> = {};
    catalogSnap.docs.forEach((doc) => {
      catalogMap[doc.id] = doc.data();
    });

    const valuationData: any[] = [];
    let totalCompanyCapital = 0;

    stockSnap.docs.forEach((docSnap) => {
      const stock = docSnap.data();
      const sku = docSnap.id;
      if (stock.totalQuantity <= 0) return; // Solo productos que sí tengan stock

      const product = catalogMap[sku] || { name: "Producto Desconocido" };
      const avgCost = stock.lastCostPerPiece || 0;
      const totalValue = stock.totalQuantity * avgCost;

      totalCompanyCapital += totalValue;

      valuationData.push({
        sku,
        name: product.name,
        quantity: stock.totalQuantity,
        avgCost: avgCost,
        totalValue: totalValue,
      });
    });

    // Ordenamos por los que tienen más dinero inmovilizado
    valuationData.sort((a, b) => b.totalValue - a.totalValue);

    return {
      items: valuationData,
      totalCapital: totalCompanyCapital,
    };
  } catch (error) {
    console.error("Error generando reporte de valorización:", error);
    throw new Error("No se pudo generar el reporte de inventario.");
  }
};

/**
 * REPORTE 3: TOP CLIENTES (LEY DE PARETO)
 * Agrupa las ventas por cliente para identificar a los mejores compradores.
 */
export const getTopCustomersReport = async (
  startDate: string,
  endDate: string,
) => {
  try {
    let constraints: any[] = [where("status", "==", "COMPLETED")];

    if (startDate) {
      constraints.push(
        where("timestamp", ">=", new Date(`${startDate}T00:00:00`)),
      );
    }
    if (endDate) {
      constraints.push(
        where("timestamp", "<=", new Date(`${endDate}T23:59:59`)),
      );
    }

    const salesSnap = await getDocs(
      query(collection(db, "sales"), ...constraints),
    );
    const customerStats: Record<string, any> = {};

    salesSnap.docs.forEach((docSnap) => {
      const sale = docSnap.data();
      const docNum = sale.documentNumber || "SIN_DOC";
      const name = sale.customerName || "Cliente Desconocido";

      if (!customerStats[docNum]) {
        customerStats[docNum] = {
          documentNumber: docNum,
          name: name,
          totalOrders: 0,
          revenueWithoutIGV: 0,
          netProfit: 0,
        };
      }

      customerStats[docNum].totalOrders += 1;

      let saleRevenue = 0;
      let saleCost = 0;

      sale.items?.forEach((item: any) => {
        const qty = item.quantity || 0;
        const unitValue = item.unitValue || item.unitPrice / 1.18;
        const baseCost = item.baseCost || 0;

        saleRevenue += qty * unitValue;
        saleCost += qty * baseCost;
      });

      customerStats[docNum].revenueWithoutIGV += saleRevenue;
      customerStats[docNum].netProfit += saleRevenue - saleCost;
    });

    // Ordenamos por los que dejan más ganancia neta (los VIP reales)
    return Object.values(customerStats).sort(
      (a, b) => b.netProfit - a.netProfit,
    );
  } catch (error) {
    console.error("Error generando reporte de top clientes:", error);
    throw new Error("No se pudo generar el reporte de clientes.");
  }
};

/**
 * REPORTE 4: INVENTARIO ESTANCADO (SLOW-MOVING STOCK)
 * Encuentra productos con stock positivo que no han tenido ni una sola venta en los últimos X días.
 */
export const getSlowMovingStockReport = async (daysThreshold: number = 60) => {
  try {
    // 1. Calculamos la fecha límite hacia atrás
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

    // 2. Buscamos las ventas desde esa fecha hasta hoy
    const salesQuery = query(
      collection(db, "sales"),
      where("status", "==", "COMPLETED"),
      where("timestamp", ">=", cutoffDate),
    );
    const salesSnap = await getDocs(salesQuery);

    // 3. Extraemos los SKUs que SÍ se han movido en este periodo
    const recentlySoldSkus = new Set<string>();
    salesSnap.docs.forEach((docSnap) => {
      const sale = docSnap.data();
      sale.items?.forEach((item: any) => {
        if (item.sku && item.sku !== "GENERIC") {
          recentlySoldSkus.add(item.sku);
        }
      });
    });

    // 4. Traemos el stock actual y el catálogo
    const [catalogSnap, stockSnap] = await Promise.all([
      getDocs(collection(db, "products")),
      getDocs(collection(db, "inventory_stock")),
    ]);

    const catalogMap: Record<string, any> = {};
    catalogSnap.docs.forEach((docSnap) => {
      catalogMap[docSnap.id] = docSnap.data();
    });

    const stagnantItems: any[] = [];
    let totalStagnantCapital = 0;

    stockSnap.docs.forEach((docSnap) => {
      const stock = docSnap.data();
      const sku = docSnap.id;

      // FILTRO MÁGICO: Tiene stock físico pero NO está en la lista de vendidos recientemente
      if (stock.totalQuantity > 0 && !recentlySoldSkus.has(sku)) {
        const product = catalogMap[sku] || { name: "Producto Desconocido" };
        const avgCost = stock.lastCostPerPiece || 0;
        const totalValue = stock.totalQuantity * avgCost;

        totalStagnantCapital += totalValue;

        stagnantItems.push({
          sku,
          name: product.name,
          quantity: stock.totalQuantity,
          avgCost: avgCost,
          totalValue: totalValue,
          daysStagnant: daysThreshold,
        });
      }
    });

    // Ordenamos para que los que tienen MÁS DINERO inmovilizado salgan arriba
    stagnantItems.sort((a, b) => b.totalValue - a.totalValue);

    return {
      items: stagnantItems,
      totalCapital: totalStagnantCapital,
    };
  } catch (error) {
    console.error("Error generando reporte de inventario estancado:", error);
    throw new Error("No se pudo generar el reporte de estancamiento.");
  }
};

/**
 * REPORTE 5: KARDEX HISTÓRICO (FORMATO SUNAT)
 * Extrae todos los movimientos de entrada y salida cronológicamente.
 */
export const getKardexMovementsReport = async (
  startDate: string,
  endDate: string,
  skuFilter: string = "",
) => {
  try {
    let constraints: any[] = [];

    // Filtros de fecha (Obligatorios para reportes contables)
    if (startDate)
      constraints.push(where("date", ">=", new Date(`${startDate}T00:00:00`)));
    if (endDate)
      constraints.push(where("date", "<=", new Date(`${endDate}T23:59:59`)));

    // Filtro opcional por producto específico
    if (skuFilter)
      constraints.push(where("sku", "==", skuFilter.toUpperCase()));

    // SUNAT exige estricto orden cronológico
    constraints.push(orderBy("date", "asc"));

    const kardexSnap = await getDocs(
      query(collection(db, "kardex_movements"), ...constraints),
    );

    return kardexSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
      };
    });
  } catch (error) {
    console.error("Error obteniendo Kardex:", error);
    throw new Error("No se pudo generar el reporte de Kardex.");
  }
};
