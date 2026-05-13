import { algoliaClient, ALGOLIA_INDICES } from "@/lib/algoliaClient";
import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  doc,
  documentId,
  endBefore,
  getCountFromServer,
  getDocs,
  increment,
  limit,
  limitToLast,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  where,
} from "firebase/firestore";

// 🚀 NUEVO: Agregamos isCoil para soportar Venta de Materia Prima
export interface CartItem {
  sku: string;
  quantity: number;
  unitPrice: number;
  baseCost: number;
  unitWeight: number;
  isCoil?: boolean;
}

const SETTINGS_DOC_ID = "general_settings";

/**
 * PROCESAR VENTA DIRECTA (SOPORTA PERFILES Y BOBINAS)
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
      // ==========================================
      // FASE 1: TODAS LAS LECTURAS (READS) PRIMERO
      // ==========================================
      const settingsRef = doc(db, "settings", SETTINGS_DOC_ID);
      const settingsDoc = await transaction.get(settingsRef);

      const stockSnapshots: Record<string, any> = {};
      const coilSnapshots: Record<string, any> = {};

      for (const item of cart) {
        if (item.isCoil) {
          const coilRef = doc(db, "coils", item.sku);
          coilSnapshots[item.sku] = await transaction.get(coilRef);
        } else if (item.sku !== "GENERIC") {
          const stockRef = doc(db, "inventory_stock", item.sku);
          stockSnapshots[item.sku] = await transaction.get(stockRef);
        }
      }

      // ==========================================
      // FASE 2: VALIDACIONES Y ESCRITURAS (WRITES)
      // ==========================================
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

      transaction.set(
        settingsRef,
        { nextSaleNumber: nextSaleNumber + 1 },
        { merge: true },
      );

      for (const item of cart) {
        totalAmount += item.quantity * item.unitPrice;
        totalCost += item.quantity * item.baseCost;
        totalWeight += item.quantity * (item.unitWeight || 0);

        if (item.isCoil) {
          // Lógica para venta de BOBINAS (Materia Prima)
          const coilDoc = coilSnapshots[item.sku];
          if (!coilDoc || !coilDoc.exists())
            throw new Error(`La bobina ${item.sku} no existe.`);
          if (coilDoc.data().status !== "AVAILABLE")
            throw new Error(
              `La bobina ${item.sku} no está disponible para venta.`,
            );

          const coilRef = doc(db, "coils", item.sku);
          transaction.update(coilRef, {
            status: "SOLD",
            soldAt: serverTimestamp(),
            soldBy: sellerId,
            saleReference: saleId,
          });

          const kardexRef = doc(collection(db, "kardex_movements"));
          transaction.set(kardexRef, {
            sku: item.sku,
            date: serverTimestamp(),
            type: "OUT",
            quantity: 1, // Se vende 1 unidad entera de bobina
            balance: 0, // Ya no está en almacén
            reference: saleId,
            description: `Venta de Materia Prima a ${customerName}`,
            user: sellerId,
          });
        } else if (item.sku !== "GENERIC") {
          // Lógica tradicional para PERFILES
          const stockDoc = stockSnapshots[item.sku];
          if (!stockDoc || !stockDoc.exists()) {
            throw new Error(
              `El producto ${item.sku} no existe en el inventario.`,
            );
          }

          const currentStock = stockDoc.data().totalQuantity;
          if (currentStock < item.quantity) {
            throw new Error(
              `Stock insuficiente para ${item.sku}. Quedan ${currentStock} unidades.`,
            );
          }

          const newStock = currentStock - item.quantity;
          const stockRef = doc(db, "inventory_stock", item.sku);

          transaction.update(stockRef, {
            totalQuantity: newStock,
            lastUpdate: serverTimestamp(),
          });

          const kardexRef = doc(collection(db, "kardex_movements"));
          transaction.set(kardexRef, {
            sku: item.sku,
            date: serverTimestamp(),
            type: "OUT",
            quantity: item.quantity,
            balance: newStock,
            reference: saleId,
            description: `Venta a ${customerName}`,
            user: sellerId,
          });
        }
      }

      const totalProfit = totalAmount - totalCost;
      const skusArray = Array.from(new Set(cart.map((item) => item.sku)));

      transaction.set(saleRef, {
        customerName,
        documentNumber,
        customerAddress,
        contactName,
        contactPhone,
        items: cart,
        skus: skusArray,
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
    throw new Error(error.message || "Error al procesar la venta.");
  }
};

/**
 * CREAR COTIZACIÓN
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
      const skusArray = Array.from(new Set(cart.map((item) => item.sku)));

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
        skus: skusArray,
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
    throw new Error("Error al generar la cotización.");
  }
};

/**
 * APROBAR COTIZACIÓN (SOPORTA PERFILES Y BOBINAS)
 */
export const approveQuotation = async (quotationId: string) => {
  const quoteRef = doc(db, "sales", quotationId);
  try {
    await runTransaction(db, async (transaction) => {
      // ==========================================
      // FASE 1: LECTURAS
      // ==========================================
      const quoteDoc = await transaction.get(quoteRef);
      if (!quoteDoc.exists()) throw new Error("La cotización no existe.");

      const quoteData = quoteDoc.data();
      if (quoteData.status === "COMPLETED" || quoteData.status === "CONVERTED")
        throw new Error("Esta cotización ya fue aprobada.");

      const settingsRef = doc(db, "settings", SETTINGS_DOC_ID);
      const settingsDoc = await transaction.get(settingsRef);

      const stockSnapshots: Record<string, any> = {};
      const coilSnapshots: Record<string, any> = {};

      for (const item of quoteData.items) {
        if (item.isCoil) {
          const coilRef = doc(db, "coils", item.sku);
          coilSnapshots[item.sku] = await transaction.get(coilRef);
        } else if (item.sku !== "GENERIC") {
          const stockRef = doc(db, "inventory_stock", item.sku);
          stockSnapshots[item.sku] = await transaction.get(stockRef);
        }
      }

      // ==========================================
      // FASE 2: ESCRITURAS
      // ==========================================
      let nextSaleNumber = 1;
      if (settingsDoc.exists() && settingsDoc.data().nextSaleNumber) {
        nextSaleNumber = settingsDoc.data().nextSaleNumber;
      }

      const newSaleId = `V-${String(nextSaleNumber).padStart(6, "0")}`;
      const newSaleRef = doc(db, "sales", newSaleId);

      transaction.set(
        settingsRef,
        { nextSaleNumber: nextSaleNumber + 1 },
        { merge: true },
      );

      for (const item of quoteData.items) {
        if (item.isCoil) {
          const coilDoc = coilSnapshots[item.sku];
          if (!coilDoc || !coilDoc.exists())
            throw new Error(`La bobina ${item.sku} no existe.`);
          if (coilDoc.data().status !== "AVAILABLE")
            throw new Error(`La bobina ${item.sku} no está disponible.`);

          const coilRef = doc(db, "coils", item.sku);
          transaction.update(coilRef, {
            status: "SOLD",
            soldAt: serverTimestamp(),
            soldBy: quoteData.sellerId || "Sistema",
            saleReference: newSaleId,
          });

          const kardexRef = doc(collection(db, "kardex_movements"));
          transaction.set(kardexRef, {
            sku: item.sku,
            date: serverTimestamp(),
            type: "OUT",
            quantity: 1,
            balance: 0,
            reference: newSaleId,
            description: `Conversión Cot. ${quotationId} (Materia Prima)`,
            user: quoteData.sellerId || "Sistema",
          });
        } else if (item.sku !== "GENERIC") {
          const stockDoc = stockSnapshots[item.sku];
          if (!stockDoc || !stockDoc.exists())
            throw new Error(`El producto ${item.sku} no existe.`);

          const currentStock = stockDoc.data().totalQuantity;
          if (currentStock < item.quantity)
            throw new Error(`Stock insuficiente para ${item.sku}.`);

          const newStock = currentStock - item.quantity;
          const stockRef = doc(db, "inventory_stock", item.sku);

          transaction.update(stockRef, {
            totalQuantity: newStock,
            lastUpdate: serverTimestamp(),
          });

          const kardexRef = doc(collection(db, "kardex_movements"));
          transaction.set(kardexRef, {
            sku: item.sku,
            date: serverTimestamp(),
            type: "OUT",
            quantity: item.quantity,
            balance: newStock,
            reference: newSaleId,
            description: `Conversión de Cot. ${quotationId}`,
            user: quoteData.sellerId || "Sistema",
          });
        }
      }

      const skusArray = Array.from(
        new Set(quoteData.items.map((i: any) => i.sku)),
      );

      transaction.set(newSaleRef, {
        ...quoteData,
        skus: skusArray,
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
    throw new Error(error.message || "Error al aprobar.");
  }
};

/**
 * FETCH SALES
 */
export interface FetchSalesParams {
  pageSize: number;
  statusFilter: string;
  searchTerm: string;
  startDate: string;
  endDate: string;
  customerDoc?: string | null;
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

  if (searchTerm && searchTerm.trim().length > 0 && !customerDoc) {
    let filters = statusFilter !== "ALL" ? `status:${statusFilter}` : "";

    const {
      hits,
      nbPages,
      page: currentPage,
      nbHits,
    } = await algoliaClient.searchSingleIndex({
      indexName: ALGOLIA_INDICES.SALES || "sales_index",
      searchParams: { query: searchTerm, filters, hitsPerPage: pageSize, page },
    });

    const hitIds = hits.map((h: any) => h.objectID);
    let sales: any[] = [];

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

  const collRef = collection(db, "sales");
  let baseConstraints: any[] = [];
  const hasDateFilter = !!startDate && !!endDate;

  if (statusFilter === "ALL") {
    if (!hasDateFilter && !customerDoc) {
      baseConstraints.push(
        where("status", "in", ["COMPLETED", "QUOTATION", "CONVERTED"]),
      );
    }
  } else {
    baseConstraints.push(where("status", "==", statusFilter));
  }

  if (customerDoc)
    baseConstraints.push(where("documentNumber", "==", customerDoc));

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

  const baseQuery = query(collRef, ...baseConstraints);
  const countSnapshot = await getCountFromServer(baseQuery);
  const totalCount = countSnapshot.data().count;

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

  const finalQuery = query(collRef, ...paginationConstraints);
  const snapshot = await getDocs(finalQuery);

  let sales = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as any[];

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

/**
 * ANULAR UNA VENTA (SOPORTA DEVOLUCIÓN DE PERFILES Y BOBINAS)
 */
export interface AnnulSaleParams {
  saleId: string;
  userEmail: string;
}

export const annulSale = async ({ saleId, userEmail }: AnnulSaleParams) => {
  const saleRef = doc(db, "sales", saleId);
  const auditRef = doc(collection(db, "audit_logs"));

  try {
    await runTransaction(db, async (transaction) => {
      // FASE 1: LECTURAS
      const saleDoc = await transaction.get(saleRef);
      if (!saleDoc.exists()) throw new Error("La venta no existe.");

      const saleData = saleDoc.data();
      if (saleData.status === "VOIDED")
        throw new Error("Esta venta ya ha sido anulada.");

      const stockSnapshots: Record<string, any> = {};
      const coilSnapshots: Record<string, any> = {};

      for (const item of saleData.items) {
        if (item.isCoil) {
          const coilRef = doc(db, "coils", item.sku);
          coilSnapshots[item.sku] = await transaction.get(coilRef);
        } else if (item.sku && item.sku !== "GENERIC") {
          const stockRef = doc(db, "inventory_stock", item.sku);
          stockSnapshots[item.sku] = await transaction.get(stockRef);
        }
      }

      let quoteSnap = null;
      let quoteRef = null;
      if (saleData.originQuoteId) {
        quoteRef = doc(db, "sales", saleData.originQuoteId);
        quoteSnap = await transaction.get(quoteRef);
      }

      // FASE 2: ESCRITURAS
      for (const item of saleData.items) {
        if (item.isCoil) {
          const coilRef = doc(db, "coils", item.sku);
          transaction.update(coilRef, {
            status: "AVAILABLE",
            soldAt: null,
            soldBy: null,
            saleReference: null,
            updatedAt: serverTimestamp(),
          });

          const kardexRef = doc(collection(db, "kardex_movements"));
          transaction.set(kardexRef, {
            sku: item.sku,
            date: serverTimestamp(),
            type: "IN",
            quantity: 1,
            balance: 1, // La bobina vuelve a estar disponible
            reference: saleId,
            description: `Anulación Venta MP: ${saleData.customerName}`,
            user: userEmail,
          });
        } else if (item.sku && item.sku !== "GENERIC") {
          const stockRef = doc(db, "inventory_stock", item.sku);
          const stockSnap = stockSnapshots[item.sku];

          const currentQty =
            stockSnap && stockSnap.exists()
              ? stockSnap.data().totalQuantity
              : 0;
          const newQty = currentQty + item.quantity;

          transaction.update(stockRef, {
            totalQuantity: increment(item.quantity),
            lastUpdate: serverTimestamp(),
          });

          const kardexRef = doc(collection(db, "kardex_movements"));
          transaction.set(kardexRef, {
            sku: item.sku,
            date: serverTimestamp(),
            type: "IN",
            quantity: item.quantity,
            balance: newQty,
            reference: saleId,
            description: `Anulación de Venta: ${saleData.customerName}`,
            user: userEmail,
          });
        }
      }

      if (quoteRef && quoteSnap && quoteSnap.exists()) {
        transaction.update(quoteRef, {
          status: "QUOTATION",
          updatedAt: serverTimestamp(),
          annulledSaleRef: saleId,
        });
      }

      transaction.update(saleRef, {
        status: "VOIDED",
        voidedAt: serverTimestamp(),
        voidedBy: userEmail,
      });

      transaction.set(auditRef, {
        action: "VOID_SALE",
        entityId: saleId,
        userEmail: userEmail,
        details: `Se anuló la venta ${saleId}. El stock/bobinas fueron devueltos.`,
        timestamp: serverTimestamp(),
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error en anulación:", error);
    throw new Error(error.message || "No se pudo anular la venta.");
  }
};

/**
 * EDITAR UNA COTIZACIÓN (QUOTATION)
 */
export const updateQuotation = async (
  quotationId: string,
  customerName: string,
  documentNumber: string,
  cart: CartItem[],
  customerAddress: string = "",
  contactName: string = "",
  contactPhone: string = "",
) => {
  const quoteRef = doc(db, "sales", quotationId);

  try {
    await runTransaction(db, async (transaction) => {
      const quoteDoc = await transaction.get(quoteRef);
      if (!quoteDoc.exists()) throw new Error("La cotización no existe.");

      const quoteData = quoteDoc.data();
      if (quoteData.status !== "QUOTATION") {
        throw new Error(
          "Solo puedes editar documentos que estén en estado COTIZACIÓN.",
        );
      }

      let totalAmount = 0;
      let totalCost = 0;
      let totalWeight = 0;

      cart.forEach((item) => {
        totalAmount += item.quantity * item.unitPrice;
        totalCost += item.quantity * item.baseCost;
        totalWeight += item.quantity * (item.unitWeight || 0);
      });

      const totalProfit = totalAmount - totalCost;
      const skusArray = Array.from(new Set(cart.map((item) => item.sku)));

      transaction.update(quoteRef, {
        customerName,
        documentNumber,
        customerAddress,
        contactName,
        contactPhone,
        items: cart,
        skus: skusArray,
        totalAmount,
        totalCost,
        totalProfit,
        totalWeight,
        updatedAt: serverTimestamp(),
      });
    });

    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || "Error al actualizar la cotización.");
  }
};

/**
 * CANCELAR UNA COTIZACIÓN (Rechazada por el cliente)
 */
export const cancelQuotation = async (
  quotationId: string,
  userEmail: string,
) => {
  const quoteRef = doc(db, "sales", quotationId);
  const auditRef = doc(collection(db, "audit_logs"));

  try {
    await runTransaction(db, async (transaction) => {
      const quoteDoc = await transaction.get(quoteRef);
      if (!quoteDoc.exists()) throw new Error("La cotización no existe.");
      if (quoteDoc.data().status !== "QUOTATION")
        throw new Error("Solo puedes cancelar Cotizaciones.");

      transaction.update(quoteRef, {
        status: "CANCELLED",
        cancelledAt: serverTimestamp(),
        cancelledBy: userEmail,
      });

      transaction.set(auditRef, {
        action: "CANCEL_QUOTATION",
        entityId: quotationId,
        userEmail: userEmail,
        details: `El cliente rechazó/canceló la cotización ${quotationId}.`,
        timestamp: serverTimestamp(),
      });
    });
    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || "Error al cancelar la cotización.");
  }
};
