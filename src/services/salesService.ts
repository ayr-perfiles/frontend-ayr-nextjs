import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

interface CartItem {
  sku: string;
  quantity: number;
  unitPrice: number;
  baseCost: number;
  unitWeight: number;
}

const SETTINGS_DOC_ID = "general_settings";

/**
 * PROCESAR VENTA DIRECTA
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
 * APROBAR COTIZACIÓN (Genera Venta, descuenta Stock y archiva Cotización)
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

      // 1. OBTENER CORRELATIVO DE VENTA
      const settingsRef = doc(db, "settings", SETTINGS_DOC_ID);
      const settingsDoc = await transaction.get(settingsRef);

      let nextSaleNumber = 1;
      if (settingsDoc.exists() && settingsDoc.data().nextSaleNumber) {
        nextSaleNumber = settingsDoc.data().nextSaleNumber;
      }

      const newSaleId = `V-${String(nextSaleNumber).padStart(6, "0")}`;
      const newSaleRef = doc(db, "sales", newSaleId);

      const stockUpdates = [];

      // 2. VERIFICAR STOCK
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

      // 3. DESCONTAR STOCK Y ACTUALIZAR CORRELATIVO
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

      // 4. CREAR LA NUEVA VENTA BASADA EN LA COTIZACIÓN
      transaction.set(newSaleRef, {
        ...quoteData,
        status: "COMPLETED",
        approvedAt: serverTimestamp(),
        originQuoteId: quotationId, // Rastro de auditoría para saber de dónde vino
      });

      // 5. ARCHIVAR LA COTIZACIÓN ORIGINAL (Para que no sume doble)
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
