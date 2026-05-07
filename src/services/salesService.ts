import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  getDocs,
  documentId,
  getCountFromServer,
} from "firebase/firestore";
import { algoliaClient, ALGOLIA_INDICES } from "@/lib/algoliaClient";

interface CartItem {
  sku: string;
  quantity: number;
  unitPrice: number;
  baseCost: number;
  unitWeight: number;
}

const SETTINGS_DOC_ID = "general_settings";

/**
 * ==========================================
 * 1. PROCESAR VENTA DIRECTA
 * ==========================================
 */
export const processSale = async (
  customerName: string,
  documentNumber: string,
  cart: CartItem[],
  sellerId: string,
  customerAddress: string = "",
  contactName: string = "",
  contactPhone: string = "",
) => {
  let generatedSaleId = "";

  try {
    await runTransaction(db, async (transaction) => {
      const settingsRef = doc(db, "settings", SETTINGS_DOC_ID);
      const settingsDoc = await transaction.get(settingsRef);

      let nextSaleNumber = 1;
      if (settingsDoc.exists() && settingsDoc.data().nextSaleNumber) {
        nextSaleNumber = settingsDoc.data().nextSaleNumber;
      }

      const saleId = `V-${String(nextSaleNumber).padStart(6, "0")}`;
      const saleRef = doc(db, "sales", saleId);
      generatedSaleId = saleId;

      let totalAmount = 0;
      let totalCost = 0;
      let totalWeight = 0;
      const stockUpdates = [];

      for (const item of cart) {
        const stockRef = doc(db, "inventory_stock", item.sku);
        const stockDoc = await transaction.get(stockRef);

        if (!stockDoc.exists()) {
          throw new Error(
            `El producto ${item.sku} no existe en el inventario.`,
          );
        }

        const currentStock = stockDoc.data().totalQuantity;
        if (currentStock < item.quantity) {
          throw new Error(
            `Stock insuficiente para ${item.sku}. Solo quedan ${currentStock} unidades.`,
          );
        }

        stockUpdates.push({
          ref: stockRef,
          newQuantity: currentStock - item.quantity,
        });

        totalAmount += item.quantity * item.unitPrice;
        totalCost += item.quantity * item.baseCost;
        totalWeight += item.quantity * (item.unitWeight || 0);
      }

      const totalProfit = totalAmount - totalCost;

      transaction.set(
        settingsRef,
        { nextSaleNumber: nextSaleNumber + 1 },
        { merge: true },
      );

      for (const update of stockUpdates) {
        transaction.update(update.ref, {
          totalQuantity: update.newQuantity,
          lastUpdate: serverTimestamp(),
        });
      }

      transaction.set(saleRef, {
        customerName,
        documentNumber,
        customerAddress,
        contactName,
        contactPhone,
        items: cart,
        totalAmount,
        totalCost,
        totalProfit,
        totalWeight,
        sellerId,
        status: "COMPLETED",
        timestamp: serverTimestamp(),
      });
    });

    return { success: true, id: generatedSaleId };
  } catch (error: any) {
    console.error("Error en processSale:", error);
    throw new Error(error.message || "Error al procesar la venta.");
  }
};

/**
 * ==========================================
 * 2. CREAR COTIZACIÓN
 * ==========================================
 */
export const createQuotation = async (
  customerName: string,
  documentNumber: string,
  cart: CartItem[],
  sellerId: string,
  customerAddress: string = "",
  contactName: string = "",
  contactPhone: string = "",
) => {
  let generatedQuoteId = "";

  try {
    await runTransaction(db, async (transaction) => {
      const settingsRef = doc(db, "settings", SETTINGS_DOC_ID);
      const settingsDoc = await transaction.get(settingsRef);

      let nextQuoteNumber = 1;
      if (settingsDoc.exists() && settingsDoc.data().nextQuotationNumber) {
        nextQuoteNumber = settingsDoc.data().nextQuotationNumber;
      }

      const quoteId = `C-${String(nextQuoteNumber).padStart(6, "0")}`;
      const quoteRef = doc(db, "sales", quoteId);
      generatedQuoteId = quoteId;

      let totalAmount = 0;
      let totalCost = 0;
      let totalWeight = 0;

      cart.forEach((item) => {
        totalAmount += item.quantity * item.unitPrice;
        totalCost += item.quantity * item.baseCost;
        totalWeight += item.quantity * (item.unitWeight || 0);
      });

      const totalProfit = totalAmount - totalCost;

      transaction.set(
        settingsRef,
        { nextQuotationNumber: nextQuoteNumber + 1 },
        { merge: true },
      );

      transaction.set(quoteRef, {
        customerName,
        documentNumber,
        customerAddress,
        contactName,
        contactPhone,
        items: cart,
        totalAmount,
        totalCost,
        totalProfit,
        totalWeight,
        sellerId,
        status: "QUOTATION",
        timestamp: serverTimestamp(),
      });
    });

    return { success: true, id: generatedQuoteId };
  } catch (error: any) {
    console.error("Error en createQuotation:", error);
    throw new Error("Error al generar la cotización.");
  }
};

/**
 * ==========================================
 * 3. APROBAR COTIZACIÓN
 * ==========================================
 */
export const approveQuotation = async (quotationId: string) => {
  const quoteRef = doc(db, "sales", quotationId);

  try {
    await runTransaction(db, async (transaction) => {
      const quoteDoc = await transaction.get(quoteRef);
      if (!quoteDoc.exists()) throw new Error("La cotización no existe.");

      const quoteData = quoteDoc.data();
      if (quoteData.status === "COMPLETED" || quoteData.status === "CONVERTED")
        throw new Error("Esta cotización ya fue aprobada previamente.");

      const settingsRef = doc(db, "settings", SETTINGS_DOC_ID);
      const settingsDoc = await transaction.get(settingsRef);

      let nextSaleNumber = 1;
      if (settingsDoc.exists() && settingsDoc.data().nextSaleNumber) {
        nextSaleNumber = settingsDoc.data().nextSaleNumber;
      }

      const newSaleId = `V-${String(nextSaleNumber).padStart(6, "0")}`;
      const newSaleRef = doc(db, "sales", newSaleId);

      const stockUpdates = [];

      for (const item of quoteData.items) {
        const stockRef = doc(db, "inventory_stock", item.sku);
        const stockDoc = await transaction.get(stockRef);

        if (!stockDoc.exists())
          throw new Error(`El producto ${item.sku} no existe en inventario.`);

        const currentStock = stockDoc.data().totalQuantity;
        if (currentStock < item.quantity) {
          throw new Error(
            `No puedes aprobar. Stock insuficiente para ${item.sku}.`,
          );
        }

        stockUpdates.push({
          ref: stockRef,
          newQuantity: currentStock - item.quantity,
        });
      }

      transaction.set(
        settingsRef,
        { nextSaleNumber: nextSaleNumber + 1 },
        { merge: true },
      );

      for (const update of stockUpdates) {
        transaction.update(update.ref, {
          totalQuantity: update.newQuantity,
          lastUpdate: serverTimestamp(),
        });
      }

      transaction.set(newSaleRef, {
        ...quoteData,
        status: "COMPLETED",
        approvedAt: serverTimestamp(),
        originQuoteId: quotationId,
      });

      transaction.update(quoteRef, {
        status: "CONVERTED",
        convertedToId: newSaleId,
        updatedAt: serverTimestamp(),
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error en approveQuotation:", error);
    throw new Error(error.message || "Error al aprobar la cotización.");
  }
};

/**
 * ==========================================
 * 4. FETCH SALES (CON MOTOR ALGOLIA + FIRESTORE)
 * ==========================================
 */
export interface FetchSalesParams {
  pageSize: number;
  statusFilter: string;
  searchTerm: string; // <-- Búsqueda libre
  startDate: string;
  endDate: string;
  customerDoc?: string | null; // <-- Búsqueda exacta por Documento
  direction?: "first" | "next" | "prev";
  cursorDoc?: any;
  page?: number;
}

export const fetchSales = async (params: FetchSalesParams) => {
  const {
    pageSize,
    statusFilter,
    searchTerm,
    startDate,
    endDate,
    customerDoc,
    direction = "first",
    cursorDoc,
    page = 0,
  } = params;

  // ==========================================
  // MOTOR 1: ALGOLIA (Búsqueda Libre + Hidratación)
  // ==========================================
  if (searchTerm && searchTerm.trim().length > 0 && !customerDoc) {
    let filters = statusFilter !== "ALL" ? `status:${statusFilter}` : "";

    const {
      hits,
      nbPages,
      page: currentPage,
      nbHits,
    } = await algoliaClient.searchSingleIndex({
      indexName: ALGOLIA_INDICES.SALES || "sales_index", // <-- Ajusta el nombre de tu índice de ventas
      searchParams: { query: searchTerm, filters, hitsPerPage: pageSize, page },
    });

    const hitIds = hits.map((h: any) => h.objectID);
    let sales: any[] = [];

    // Hidratación desde Firestore usando los IDs de Algolia
    if (hitIds.length > 0) {
      const qDocs = query(
        collection(db, "sales"),
        where(documentId(), "in", hitIds),
      );
      const snap = await getDocs(qDocs);
      const firestoreDocs = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Reordenar para respetar la relevancia de Algolia
      sales = hitIds
        .map((id) => firestoreDocs.find((d) => d.id === id))
        .filter(Boolean);
    }

    return {
      sales,
      isAlgolia: true,
      algoliaData: { totalPages: nbPages, currentPage, nbHits },
      firstDoc: null,
      lastDoc: null,
      totalCount: nbHits,
    };
  }

  // ==========================================
  // MOTOR 2: FIRESTORE (Navegación normal y Filtros)
  // ==========================================
  const collRef = collection(db, "sales");
  let baseConstraints: any[] = [];
  const hasDateFilter = !!startDate && !!endDate;

  // 1. Filtro de Estado
  if (statusFilter === "ALL") {
    // 🔥 PREVENCIÓN DE CRASH FIREBASE: Evitar "in" con filtros de fechas (rangos)
    if (!hasDateFilter && !customerDoc) {
      baseConstraints.push(
        where("status", "in", ["COMPLETED", "QUOTATION", "CONVERTED"]),
      );
    }
  } else {
    baseConstraints.push(where("status", "==", statusFilter));
  }

  // 2. Filtro Exacto de Cliente (Viene del dropdown de sugerencias)
  if (customerDoc) {
    baseConstraints.push(where("documentNumber", "==", customerDoc));
  }

  // 3. Filtro de Fechas y Orden
  if (hasDateFilter) {
    baseConstraints.push(
      where("timestamp", ">=", new Date(`${startDate}T00:00:00`)),
    );
    baseConstraints.push(
      where("timestamp", "<=", new Date(`${endDate}T23:59:59`)),
    );
    baseConstraints.push(orderBy("timestamp", "desc"));
  } else {
    baseConstraints.push(orderBy("timestamp", "desc"));
  }

  // 4. Contar el Total Real en Base de Datos (getCountFromServer)
  const baseQuery = query(collRef, ...baseConstraints);
  const countSnapshot = await getCountFromServer(baseQuery);
  const totalCount = countSnapshot.data().count;

  // 5. Aplicar la Paginación con Cursores
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

  // 6. Ejecutar la Consulta Final Paginada
  const finalQuery = query(collRef, ...paginationConstraints);
  const snapshot = await getDocs(finalQuery);

  let sales = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as any[];

  // 7. Filtro local de exclusión si es necesario (cuando Firebase restringe)
  if (statusFilter === "ALL" && (hasDateFilter || customerDoc)) {
    sales = sales.filter((s) =>
      ["COMPLETED", "QUOTATION", "CONVERTED"].includes(s.status),
    );
  }

  return {
    sales,
    isAlgolia: false,
    firstDoc: snapshot.docs.length > 0 ? snapshot.docs[0] : null,
    lastDoc:
      snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
    totalCount,
  };
};
