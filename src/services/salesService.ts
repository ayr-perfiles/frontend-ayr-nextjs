import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

// Definimos la estructura exacta que envía nuestro carrito
interface CartItem {
  sku: string;
  quantity: number;
  unitPrice: number;
  baseCost: number; // <-- EL DATO CLAVE NUEVO
}

/**
 * PROCESAR VENTA DIRECTA (Descuenta Stock)
 */
export const processSale = async (
  customerName: string,
  documentNumber: string,
  cart: CartItem[],
  sellerId: string,
) => {
  const saleRef = doc(collection(db, "sales"));

  try {
    await runTransaction(db, async (transaction) => {
      let totalAmount = 0;
      let totalCost = 0;

      const stockUpdates = [];

      // 1. LECTURA Y VALIDACIÓN DE STOCK
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

        // Preparamos la actualización de stock
        stockUpdates.push({
          ref: stockRef,
          newQuantity: currentStock - item.quantity,
        });

        // Sumamos los montos financieros
        totalAmount += item.quantity * item.unitPrice;
        totalCost += item.quantity * item.baseCost;
      }

      const totalProfit = totalAmount - totalCost;

      // 2. ESCRITURA: Descontamos el stock
      for (const update of stockUpdates) {
        transaction.update(update.ref, {
          totalQuantity: update.newQuantity,
          lastUpdate: serverTimestamp(),
        });
      }

      // 3. ESCRITURA: Guardamos el registro de la venta
      transaction.set(saleRef, {
        customerName,
        documentNumber, // <-- Guardamos el RUC/DNI
        items: cart,
        totalAmount,
        totalCost,
        totalProfit, // <-- Ganancia neta calculada
        sellerId,
        status: "COMPLETED",
        timestamp: serverTimestamp(),
      });
    });

    return { success: true, id: saleRef.id };
  } catch (error: any) {
    console.error("Error en processSale:", error);
    throw new Error(error.message || "Error al procesar la venta.");
  }
};

/**
 * CREAR COTIZACIÓN (No descuenta Stock)
 */
export const createQuotation = async (
  customerName: string,
  documentNumber: string,
  cart: CartItem[],
  sellerId: string,
) => {
  const saleRef = doc(collection(db, "sales"));

  try {
    let totalAmount = 0;
    let totalCost = 0;

    cart.forEach((item) => {
      totalAmount += item.quantity * item.unitPrice;
      totalCost += item.quantity * item.baseCost;
    });

    const totalProfit = totalAmount - totalCost;

    // Usamos setDoc directo porque no tocamos el stock (no requiere transacción)
    await setDoc(saleRef, {
      customerName,
      documentNumber,
      items: cart,
      totalAmount,
      totalCost,
      totalProfit,
      sellerId,
      status: "QUOTATION",
      timestamp: serverTimestamp(),
    });

    return { success: true, id: saleRef.id };
  } catch (error: any) {
    console.error("Error en createQuotation:", error);
    throw new Error("Error al generar la cotización.");
  }
};

/**
 * APROBAR COTIZACIÓN (Convierte a Venta y descuenta Stock)
 */
export const approveQuotation = async (quotationId: string) => {
  const saleRef = doc(db, "sales", quotationId);

  try {
    await runTransaction(db, async (transaction) => {
      const saleDoc = await transaction.get(saleRef);
      if (!saleDoc.exists()) throw new Error("La cotización no existe.");

      const saleData = saleDoc.data();
      if (saleData.status === "COMPLETED")
        throw new Error("Esta cotización ya fue aprobada previamente.");

      const stockUpdates = [];

      // 1. Verificar stock disponible antes de aprobar
      for (const item of saleData.items) {
        const stockRef = doc(db, "inventory_stock", item.sku);
        const stockDoc = await transaction.get(stockRef);

        if (!stockDoc.exists())
          throw new Error(`El producto ${item.sku} no existe en inventario.`);

        const currentStock = stockDoc.data().totalQuantity;
        if (currentStock < item.quantity) {
          throw new Error(
            `No puedes aprobar la cotización. Stock insuficiente para ${item.sku}. Quedan ${currentStock} unidades.`,
          );
        }

        stockUpdates.push({
          ref: stockRef,
          newQuantity: currentStock - item.quantity,
        });
      }

      // 2. Descontar el stock
      for (const update of stockUpdates) {
        transaction.update(update.ref, {
          totalQuantity: update.newQuantity,
          lastUpdate: serverTimestamp(),
        });
      }

      // 3. Cambiar el estado a Venta Completada
      transaction.update(saleRef, {
        status: "COMPLETED",
        approvedAt: serverTimestamp(),
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error en approveQuotation:", error);
    throw new Error(error.message || "Error al aprobar la cotización.");
  }
};
