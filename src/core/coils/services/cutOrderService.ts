import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  getDocs,
  query,
  where,
  Timestamp,
  FieldValue,
} from "firebase/firestore";
import { Coil, CutOrder, StripStock } from "@/types";

/**
 * ENVÍO DE BOBINAS A CORTE TERCERIZADO
 */
export const sendToCut = async (params: {
  tercero: { nombre: string; ruc?: string };
  coils: { coilId: string; cutPlan: { widthMm: number; count: number }[] }[];
  userEmail: string;
}) => {
  const { tercero, coils, userEmail } = params;

  try {
    const result = await runTransaction(db, async (transaction) => {
      let sentWeightTotal = 0;
      const processedCoils = [];
      const coilSnaps = [];

      // 1. TODAS LAS LECTURAS PRIMERO
      for (const item of coils) {
        const coilRef = doc(db, "coils", item.coilId);
        const coilSnap = await transaction.get(coilRef);
        if (!coilSnap.exists()) throw new Error(`La bobina ${item.coilId} no existe.`);
        coilSnaps.push({ snap: coilSnap, ref: coilRef, cutPlan: item.cutPlan });
      }

      // 2. TODAS LAS ESCRITURAS DESPUÉS
      for (const { snap, ref, cutPlan } of coilSnaps) {
        const coil = snap.data() as Coil;

        if (coil.status !== "AVAILABLE") {
          throw new Error(`La bobina ${snap.id} no está disponible (estado: ${coil.status}).`);
        }

        if (coil.isClosed) {
          throw new Error("La bobina está cerrada. El supervisor debe abrirla antes de producir.");
        }

        if (coil.currentWeight <= 0) {
          throw new Error(`La bobina ${snap.id} no tiene peso disponible.`);
        }

        sentWeightTotal += coil.currentWeight;
        
        processedCoils.push({
          coilId: snap.id,
          sentWeight: coil.currentWeight,
          cutPlan: cutPlan
        });

        transaction.update(ref, {
          status: "EN_TERCERO",
          updatedAt: serverTimestamp()
        });
      }

      const cutOrderRef = doc(collection(db, "cut_orders"));
      const cutOrderData: CutOrder = {
        tercero,
        status: 'ENVIADO',
        coils: processedCoils,
        sentWeightTotal,
        sentAt: serverTimestamp(),
        sentBy: userEmail
      };

      transaction.set(cutOrderRef, cutOrderData);

      const auditRef = doc(collection(db, "audit_logs"));
      transaction.set(auditRef, {
        action: "SEND_TO_CUT",
        entityId: cutOrderRef.id,
        userEmail: userEmail,
        details: `Envío de ${coils.length} bobinas a corte con ${tercero.nombre}. Peso total: ${sentWeightTotal}kg.`,
        timestamp: serverTimestamp(),
      });

      return { cutOrderId: cutOrderRef.id };
    });

    return result;
  } catch (error: any) {
    console.error("Error en sendToCut:", error);
    throw new Error(error.message || "Error al enviar a corte.");
  }
};

/**
 * RECEPCIÓN DE FLEJES Y FACTURA
 */
export const receiveStrips = async (params: {
  cutOrderId: string;
  invoice: {
    number: string;
    date: string;
    currency: 'USD' | 'PEN';
    exchangeRate: number;
    gravada: number;
    igv: number;
    detraccionPct?: number;
    detraccionAmount?: number;
    detraction?: { amount: number; code: string } | null;
    total: number;
    supplier?: { ruc: string; razonSocial: string } | null;
    source?: 'XML' | 'MANUAL';
  };
  receivedStrips: {
    coilId: string;
    widthMm: number;
    count: number;
    weight: number;
  }[];
  receivedWeightTotal: number;
  userEmail: string;
}) => {
  const { cutOrderId, invoice, receivedStrips, receivedWeightTotal, userEmail } = params;

  try {
    await runTransaction(db, async (transaction) => {
      const cutOrderRef = doc(db, "cut_orders", cutOrderId);
      const cutOrderSnap = await transaction.get(cutOrderRef);

      if (!cutOrderSnap.exists()) throw new Error("La orden de corte no existe.");
      const cutOrder = cutOrderSnap.data() as CutOrder;

      if (cutOrder.status === 'RECIBIDO') {
        throw new Error("Esta orden de corte ya ha sido recibida.");
      }

      // 1. LECTURAS: Bobinas y Stock de Flejes
      const coilSnaps: Record<string, any> = {};
      for (const coilInfo of cutOrder.coils) {
        const coilRef = doc(db, "coils", coilInfo.coilId);
        const coilSnap = await transaction.get(coilRef);
        coilSnaps[coilInfo.coilId] = { snap: coilSnap, ref: coilRef };
      }

      const uniqueWidths = Array.from(new Set(receivedStrips.map(s => s.widthMm)));
      const stripStockSnaps: Record<string, any> = {};
      for (const width of uniqueWidths) {
        const stripStockRef = doc(db, "strips_stock", width.toString());
        const stripStockSnap = await transaction.get(stripStockRef);
        stripStockSnaps[width] = { snap: stripStockSnap, ref: stripStockRef };
      }

      // 2. ESCRITURAS
      const serviceCostPEN = invoice.gravada * invoice.exchangeRate;
      const sentWeightTotal = cutOrder.sentWeightTotal;

      const stripsByCoil: Record<string, typeof receivedStrips> = {};
      receivedStrips.forEach(s => {
        if (!stripsByCoil[s.coilId]) stripsByCoil[s.coilId] = [];
        stripsByCoil[s.coilId].push(s);
      });

      for (const coilInfo of cutOrder.coils) {
        const { snap: coilSnap, ref: coilRef } = coilSnaps[coilInfo.coilId];
        const coil = coilSnap.data() as Coil;

        // `pricePerKg` YA está en PEN: `computePricePerKg` (coilPricing.ts) aplica el TC al
        // registrar la bobina. Volver a multiplicar por `metadata.exchangeRate` inflaba el
        // costo ~TC veces y contaminaba `costPerKgUtil` -> `strips_stock.avgCostPerKg`.
        // Invariante "Mundo A" (v6.42). La única conversión legítima acá es la del costo de
        // SERVICIO (`serviceCostPEN`, arriba), que sí viene crudo de la factura del tercero.
        const materialCostPEN = coilInfo.sentWeight * coil.pricePerKg;

        const proportionalServiceCost = serviceCostPEN * (coilInfo.sentWeight / sentWeightTotal);
        const totalCoilCostPEN = materialCostPEN + proportionalServiceCost;

        const coilReceivedStrips = stripsByCoil[coilInfo.coilId] || [];
        const coilReceivedWeight = coilReceivedStrips.reduce((sum, s) => sum + s.weight, 0);

        if (coilReceivedWeight === 0 && coilReceivedStrips.length > 0) {
          throw new Error(`El peso recibido para la bobina ${coilInfo.coilId} no puede ser 0.`);
        }

        const costPerKgUtil = coilReceivedWeight > 0 ? totalCoilCostPEN / coilReceivedWeight : 0;

        for (const strip of coilReceivedStrips) {
          const { snap: stripStockSnap, ref: stripStockRef } = stripStockSnaps[strip.widthMm];
          
          let currentStock = {
            widthMm: strip.widthMm,
            totalStrips: 0,
            totalWeight: 0,
            avgCostPerKg: 0,
            lastUpdate: serverTimestamp()
          };

          if (stripStockSnap.exists()) {
            currentStock = stripStockSnap.data() as any;
          }

          const newTotalWeight = currentStock.totalWeight + strip.weight;
          const newTotalStrips = currentStock.totalStrips + strip.count;
          
          const newAvgCostPerKg = newTotalWeight > 0 
            ? ((currentStock.totalWeight * currentStock.avgCostPerKg) + (strip.weight * costPerKgUtil)) / newTotalWeight
            : 0;

          transaction.set(stripStockRef, {
            ...currentStock,
            totalWeight: newTotalWeight,
            totalStrips: newTotalStrips,
            avgCostPerKg: newAvgCostPerKg,
            lastUpdate: serverTimestamp()
          });

          const moveRef = doc(collection(db, "strips_movements"));
          transaction.set(moveRef, {
            type: 'ENTRADA',
            widthMm: strip.widthMm,
            quantity: strip.count,
            weight: strip.weight,
            costPerKg: costPerKgUtil,
            referenceId: cutOrderId,
            description: `Recepción de corte bobina ${coilInfo.coilId}`,
            timestamp: serverTimestamp(),
            user: userEmail
          });
        }

        transaction.update(coilRef, {
          status: "PROCESSED",
          currentWeight: 0,
          updatedAt: serverTimestamp()
        });
      }

      transaction.update(cutOrderRef, {
        status: 'RECIBIDO',
        invoice: {
          ...invoice,
          date: Timestamp.fromDate(new Date(invoice.date))
        },
        serviceCostPEN,
        receivedWeightTotal,
        externalScrapWeight: sentWeightTotal - receivedWeightTotal,
        receivedAt: serverTimestamp(),
        receivedBy: userEmail,
        receivedStrips
      });

      const auditRef = doc(collection(db, "audit_logs"));
      transaction.set(auditRef, {
        action: "RECEIVE_STRIPS",
        entityId: cutOrderId,
        userEmail: userEmail,
        details: `Recepción de flejes orden ${cutOrderId}. Merma externa: ${(sentWeightTotal - receivedWeightTotal).toFixed(2)}kg.`,
        timestamp: serverTimestamp(),
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error en receiveStrips:", error);
    throw new Error(error.message || "Error al recibir flejes.");
  }
};

/**
 * REAJUSTE DE FACTURA: Actualiza el costo del servicio y recalcula flejes aún en stock.
 */
export const updateCutOrderInvoice = async (params: {
  cutOrderId: string;
  invoice: {
    number: string;
    date: string;
    currency: 'USD' | 'PEN';
    exchangeRate: number;
    gravada: number;
    igv: number;
    detraccionPct?: number;
    detraccionAmount?: number;
    detraction?: { amount: number; code: string } | null;
    total: number;
    supplier?: { ruc: string; razonSocial: string } | null;
    source?: 'XML' | 'MANUAL';
  };
  userEmail: string;
}) => {
  const { cutOrderId, invoice, userEmail } = params;

  try {
    await runTransaction(db, async (transaction) => {
      const cutOrderRef = doc(db, "cut_orders", cutOrderId);
      const cutOrderSnap = await transaction.get(cutOrderRef);

      if (!cutOrderSnap.exists()) throw new Error("La orden de corte no existe.");
      const cutOrder = cutOrderSnap.data() as CutOrder;

      if (cutOrder.status !== 'RECIBIDO') {
        throw new Error("Solo se pueden ajustar facturas de órdenes ya recibidas.");
      }

      // 1. LECTURAS: Stock de flejes involucrados
      const involvedWidths = Array.from(new Set(cutOrder.receivedStrips?.map(s => s.widthMm) || []));
      const stripStockSnaps: Record<string, any> = {};
      for (const width of involvedWidths) {
        const stripStockRef = doc(db, "strips_stock", width.toString());
        const stripStockSnap = await transaction.get(stripStockRef);
        stripStockSnaps[width] = { snap: stripStockSnap, ref: stripStockRef };
      }

      // 2. ESCRITURAS
      const oldServiceCostPEN = cutOrder.serviceCostPEN || 0;
      const newServiceCostPEN = invoice.gravada * invoice.exchangeRate;
      const deltaServiceCostPEN = newServiceCostPEN - oldServiceCostPEN;

      if (deltaServiceCostPEN === 0 && invoice.number === cutOrder.invoice?.number) {
        return { success: true };
      }

      const sentWeightTotal = cutOrder.sentWeightTotal;

      for (const coilInfo of cutOrder.coils) {
        const coilReceivedStrips = cutOrder.receivedStrips?.filter(s => s.coilId === coilInfo.coilId) || [];
        const coilReceivedWeight = coilReceivedStrips.reduce((sum, s) => sum + s.weight, 0);

        if (coilReceivedWeight === 0) continue;

        const deltaProportionalServiceCost = deltaServiceCostPEN * (coilInfo.sentWeight / sentWeightTotal);
        const deltaCostPerKgUtil = deltaProportionalServiceCost / coilReceivedWeight;

        for (const strip of coilReceivedStrips) {
          const { snap: stripStockSnap, ref: stripStockRef } = stripStockSnaps[strip.widthMm];
          
          if (!stripStockSnap.exists()) continue; 
          
          const currentStock = stripStockSnap.data() as StripStock;
          const remainingWeightFromThisOrder = Math.min(strip.weight, currentStock.totalWeight);
          
          if (remainingWeightFromThisOrder > 0) {
            const deltaTotalValue = remainingWeightFromThisOrder * deltaCostPerKgUtil;
            const newAvgCostPerKg = ((currentStock.totalWeight * currentStock.avgCostPerKg) + deltaTotalValue) / currentStock.totalWeight;

            transaction.update(stripStockRef, {
              avgCostPerKg: newAvgCostPerKg,
              lastUpdate: serverTimestamp()
            });

            const moveRef = doc(collection(db, "strips_movements"));
            transaction.set(moveRef, {
              type: 'AJUSTE',
              widthMm: strip.widthMm,
              quantity: 0,
              weight: 0,
              costPerKg: newAvgCostPerKg,
              referenceId: cutOrderId,
              description: `Ajuste factura orden ${cutOrderId}. Delta: S/ ${deltaTotalValue.toFixed(2)}`,
              timestamp: serverTimestamp(),
              user: userEmail
            });
          }
        }
      }

      transaction.update(cutOrderRef, {
        invoice: {
          ...invoice,
          date: Timestamp.fromDate(new Date(invoice.date))
        },
        serviceCostPEN: newServiceCostPEN,
        updatedAt: serverTimestamp()
      });

      const auditRef = doc(collection(db, "audit_logs"));
      transaction.set(auditRef, {
        action: "RECEIVE_STRIPS", 
        entityId: cutOrderId,
        userEmail: userEmail,
        details: `Actualización de factura orden ${cutOrderId}. Nuevo costo PEN: ${newServiceCostPEN.toFixed(2)}`,
        timestamp: serverTimestamp(),
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error en updateCutOrderInvoice:", error);
    throw new Error(error.message || "Error al actualizar factura.");
  }
};

/**
 * ANULACIÓN DE ORDEN DE CORTE
 */
export const voidCutOrder = async (cutOrderId: string, reason: string, userEmail: string) => {
  try {
    await runTransaction(db, async (transaction) => {
      const cutOrderRef = doc(db, "cut_orders", cutOrderId);
      const cutOrderSnap = await transaction.get(cutOrderRef);

      if (!cutOrderSnap.exists()) throw new Error("La orden de corte no existe.");
      const cutOrder = cutOrderSnap.data() as CutOrder;

      if (cutOrder.status === 'ANULADA') {
        throw new Error("Esta orden ya ha sido anulada.");
      }

      // 1. LECTURAS
      const coilRefs = cutOrder.coils.map(c => doc(db, "coils", c.coilId));
      const coilSnaps = await Promise.all(coilRefs.map(ref => transaction.get(ref)));

      let stripStockData: Record<number, { snap: any, ref: any, count: number, weight: number }> = {};

      if (cutOrder.status === 'RECIBIDO') {
        const uniqueWidths = Array.from(new Set(cutOrder.receivedStrips?.map(s => s.widthMm) || []));
        const stripStockRefs = uniqueWidths.map(w => doc(db, "strips_stock", w.toString()));
        const stripStockSnaps = await Promise.all(stripStockRefs.map(ref => transaction.get(ref)));

        uniqueWidths.forEach((width, i) => {
          const orderStrips = cutOrder.receivedStrips?.filter(s => s.widthMm === width) || [];
          stripStockData[width] = {
            snap: stripStockSnaps[i],
            ref: stripStockRefs[i],
            count: orderStrips.reduce((sum, s) => sum + s.count, 0),
            weight: orderStrips.reduce((sum, s) => sum + s.weight, 0)
          };
        });

        // Validar integridad
        for (const width of uniqueWidths) {
          const data = stripStockData[width];
          if (!data.snap.exists()) throw new Error(`Integridad rota: No existe stock para fleje de ${width}mm.`);
          const stock = data.snap.data() as StripStock;
          if (stock.totalStrips < data.count) {
            throw new Error(`STRIPS_ALREADY_CONSUMED: No se puede anular, parte de los flejes de ${width}mm ya se produjo.`);
          }
        }
      }

      // 2. ESCRITURAS
      if (cutOrder.status === 'RECIBIDO') {
        Object.keys(stripStockData).forEach(w => {
          const width = Number(w);
          const data = stripStockData[width];
          const stock = data.snap.data() as StripStock;

          transaction.update(data.ref, {
            totalWeight: Math.max(0, stock.totalWeight - data.weight),
            totalStrips: Math.max(0, stock.totalStrips - data.count),
            lastUpdate: serverTimestamp()
          });

          const moveRef = doc(collection(db, "strips_movements"));
          transaction.set(moveRef, {
            type: 'SALIDA',
            widthMm: width,
            quantity: data.count,
            weight: data.weight,
            costPerKg: stock.avgCostPerKg,
            referenceId: cutOrderId,
            description: `ANULACIÓN ORDEN ${cutOrderId}`,
            timestamp: serverTimestamp(),
            user: userEmail
          });
        });
      }

      // Bobinas
      coilSnaps.forEach((snap, i) => {
        const ref = coilRefs[i];
        const coilInfo = cutOrder.coils.find(c => c.coilId === snap.id);
        transaction.update(ref, {
          status: "AVAILABLE",
          currentWeight: coilInfo?.sentWeight || snap.data()?.initialWeight || 0,
          updatedAt: serverTimestamp()
        });
      });

      // Orden
      const updateData: Record<string, string | boolean | FieldValue> = {
        status: 'ANULADA',
        voidedAt: serverTimestamp(),
        voidedBy: userEmail,
        voidReason: reason,
        updatedAt: serverTimestamp(),
        "invoice.voided": cutOrder.invoice ? true : false
      };

      transaction.update(cutOrderRef, updateData);

      // Auditoría
      const auditRef = doc(collection(db, "audit_logs"));
      transaction.set(auditRef, {
        action: "VOID_CUT_ORDER",
        entityId: cutOrderId,
        userEmail: userEmail,
        details: `Anulación orden ${cutOrderId}. Motivo: ${reason}.`,
        timestamp: serverTimestamp(),
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error en voidCutOrder:", error);
    throw new Error(error.message || "Error al anular orden.");
  }
};

/**
 * EDICIÓN DE ORDEN (SOLO EN ESTADO ENVIADO)
 */
export const updateSentOrder = async (cutOrderId: string, changes: {
  tercero: { nombre: string; ruc?: string };
  coils: { coilId: string; cutPlan: { widthMm: number; count: number }[] }[];
  userEmail: string;
}) => {
  const { tercero, coils, userEmail } = changes;

  try {
    await runTransaction(db, async (transaction) => {
      const cutOrderRef = doc(db, "cut_orders", cutOrderId);
      const cutOrderSnap = await transaction.get(cutOrderRef);

      if (!cutOrderSnap.exists()) throw new Error("La orden no existe.");
      const currentOrder = cutOrderSnap.data() as CutOrder;

      if (currentOrder.status !== 'ENVIADO') {
        throw new Error("ORDER_NOT_EDITABLE: Solo se pueden editar órdenes en estado ENVIADO.");
      }

      // 1. LECTURAS: Bobinas actuales y nuevas
      const currentCoilIds = currentOrder.coils.map(c => c.coilId);
      const newCoilIds = coils.map(c => c.coilId);
      const allUniqueIds = Array.from(new Set([...currentCoilIds, ...newCoilIds]));
      
      const coilData: Record<string, { snap: any, ref: any }> = {};
      for (const id of allUniqueIds) {
        const ref = doc(db, "coils", id);
        const snap = await transaction.get(ref);
        coilData[id] = { snap, ref };
      }

      // 2. ESCRITURAS
      let sentWeightTotal = 0;
      const processedCoils = [];

      const coilsToRemove = currentCoilIds.filter(id => !newCoilIds.includes(id));
      const coilsToAdd = newCoilIds.filter(id => !currentCoilIds.includes(id));
      const coilsToKeep = newCoilIds.filter(id => currentCoilIds.includes(id));

      for (const id of coilsToRemove) {
        transaction.update(coilData[id].ref, {
          status: "AVAILABLE",
          updatedAt: serverTimestamp()
        });
      }

      for (const id of coilsToAdd) {
        const snap = coilData[id].snap;
        if (snap.data().status !== "AVAILABLE") throw new Error(`La bobina ${id} no está disponible.`);
        
        sentWeightTotal += snap.data().currentWeight;
        processedCoils.push({
          coilId: id,
          sentWeight: snap.data().currentWeight,
          cutPlan: coils.find(c => c.coilId === id)?.cutPlan || []
        });

        transaction.update(coilData[id].ref, {
          status: "EN_TERCERO",
          updatedAt: serverTimestamp()
        });
      }

      for (const id of coilsToKeep) {
        const oldInfo = currentOrder.coils.find(c => c.coilId === id)!;
        sentWeightTotal += oldInfo.sentWeight;
        processedCoils.push({
          coilId: id,
          sentWeight: oldInfo.sentWeight,
          cutPlan: coils.find(c => c.coilId === id)!.cutPlan
        });
      }

      transaction.update(cutOrderRef, {
        tercero,
        coils: processedCoils,
        sentWeightTotal,
        updatedAt: serverTimestamp()
      });

      const auditRef = doc(collection(db, "audit_logs"));
      transaction.set(auditRef, {
        action: "EDIT_CUT_ORDER",
        entityId: cutOrderId,
        userEmail: userEmail,
        details: `Edición orden ${cutOrderId}. Coils: +${coilsToAdd.length}, -${coilsToRemove.length}.`,
        timestamp: serverTimestamp(),
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error en updateSentOrder:", error);
    throw new Error(error.message || "Error al actualizar orden.");
  }
};
