import { db } from "@/lib/firebase/clientApp";
import {
  doc,
  runTransaction,
  serverTimestamp,
  collection,
} from "firebase/firestore";
import { Coil, ProductionLog } from "@/types";

// FASE 1: GUARDAR PLAN DE CORTE (SLITTER)
export const saveCuttingPlan = async (
  coilId: string,
  items: { sku: string; quantity: number }[],
) => {
  const coilRef = doc(db, "coils", coilId);

  try {
    await runTransaction(db, async (transaction) => {
      const coilDoc = await transaction.get(coilRef);
      if (!coilDoc.exists()) throw new Error("La bobina no existe.");

      const coil = coilDoc.data() as Coil;

      if (!coil.initialWeight || !coil.masterWidth || !coil.pricePerKg) {
        throw new Error("Datos de bobina incompletos (Peso, Ancho o Precio).");
      }

      const productsData: Record<string, any> = {};
      for (const item of items) {
        const prodRef = doc(db, "products", item.sku);
        const prodDoc = await transaction.get(prodRef);

        if (!prodDoc.exists())
          throw new Error(`El producto ${item.sku} no existe en el catálogo.`);
        productsData[item.sku] = prodDoc.data();
      }

      // Costo base del acero por milímetro de ancho
      const costPerMm =
        (coil.initialWeight / coil.masterWidth) * coil.pricePerKg;

      const plannedStrips = items.map((item) => {
        const product = productsData[item.sku];
        const width = product.stripWidth;

        if (!width)
          throw new Error(`El producto ${item.sku} no tiene 'stripWidth'.`);
        const qty = Number(item.quantity) || 0;
        if (qty <= 0)
          throw new Error(`La cantidad para ${item.sku} debe ser mayor a 0.`);

        return {
          sku: item.sku,
          initialCount: qty,
          pendingCount: qty,
          width: width,
          costPerStrip: Number((width * costPerMm).toFixed(2)),
        };
      });

      transaction.update(coilRef, {
        plannedStrips: plannedStrips,
        status: "IN_PROGRESS",
        updatedAt: serverTimestamp(),
      });
    });
    return { success: true };
  } catch (error: any) {
    console.error("Error en saveCuttingPlan:", error);
    throw new Error(error.message || "Error al guardar plan de corte");
  }
};

// FASE 2: PROCESAR UN FLEJE (CONFORMADORA) CON VALIDACIÓN FÍSICA Y COSTO REAL
export const processSingleStrip = async (
  coilId: string,
  sku: string,
  pieces: number,
  operatorId: string,
) => {
  const coilRef = doc(db, "coils", coilId);
  const stockRef = doc(db, "inventory_stock", sku);
  const logRef = doc(collection(db, "production_logs"));
  const prodRef = doc(db, "products", sku);

  try {
    await runTransaction(db, async (transaction) => {
      const coilDoc = await transaction.get(coilRef);
      const stockDoc = await transaction.get(stockRef);
      const prodDoc = await transaction.get(prodRef);

      if (!coilDoc.exists()) throw new Error("Bobina no existe");
      if (!prodDoc.exists())
        throw new Error(`El producto ${sku} no está en el catálogo.`);

      const coil = coilDoc.data() as Coil;
      const product = prodDoc.data();

      const stripIndex = coil.plannedStrips?.findIndex(
        (s) => s.sku === sku && s.pendingCount > 0,
      );
      if (stripIndex === undefined || stripIndex === -1)
        throw new Error("No hay flejes disponibles");

      const activeStrip = coil.plannedStrips![stripIndex];

      // --- 1. CAPA DE SEGURIDAD: VALIDACIÓN FÍSICA ---
      // Calculamos cuánto pesa exactamente este fleje
      const weightPerMm = coil.initialWeight / coil.masterWidth;
      const theoreticalStripWeight = activeStrip.width * weightPerMm;

      // Calculamos el peso de la producción reportada
      const standardWeight = product.standardWeight || 0;
      if (standardWeight === 0)
        throw new Error(
          `El SKU ${sku} no tiene Peso Estándar configurado en el catálogo.`,
        );

      const reportedProductionWeight = pieces * standardWeight;

      // Validación: El peso producido no puede superar el peso del fleje (damos 5% de tolerancia por calibración de máquina)
      if (reportedProductionWeight > theoreticalStripWeight * 1.05) {
        throw new Error(
          `¡Límite Físico Excedido! Es imposible sacar ${pieces} piezas. ` +
            `El fleje pesa ${theoreticalStripWeight.toFixed(2)}kg y reportaste ${reportedProductionWeight.toFixed(2)}kg.`,
        );
      }

      // --- 2. CÁLCULO DE COSTO REAL Y MERMA ---
      // Costo Dinámico: Si el operador sacó menos piezas, cada pieza le costó más a la fábrica.
      const realCostPerPiece = Number(
        (activeStrip.costPerStrip / pieces).toFixed(4),
      );

      const totalPlannedWidth = coil.plannedStrips!.reduce(
        (sum, s) => sum + s.width * s.initialCount,
        0,
      );
      const scrapPerStrip =
        (coil.masterWidth - totalPlannedWidth) /
        coil.plannedStrips!.reduce((sum, s) => sum + s.initialCount, 0);

      const newCurrentWeight = Math.max(
        0,
        coil.currentWeight - theoreticalStripWeight,
      );

      // --- 3. ACTUALIZACIÓN DE ESTADOS ---
      const updatedStrips = [...coil.plannedStrips!];
      updatedStrips[stripIndex].pendingCount -= 1;
      const totalPending = updatedStrips.reduce(
        (sum, s) => sum + s.pendingCount,
        0,
      );

      // Descontar de la bobina
      transaction.update(coilRef, {
        plannedStrips: updatedStrips,
        status: totalPending === 0 ? "PROCESSED" : "IN_PROGRESS",
        currentWeight:
          totalPending === 0 ? 0 : Number(newCurrentWeight.toFixed(2)),
        updatedAt: serverTimestamp(),
      });

      // Sumar al Stock
      const currentQty = stockDoc.exists() ? stockDoc.data().totalQuantity : 0;
      const currentWeightStock = stockDoc.exists()
        ? stockDoc.data().totalWeight
        : 0;

      transaction.set(
        stockRef,
        {
          sku,
          totalQuantity: currentQty + pieces,
          totalWeight: currentWeightStock + reportedProductionWeight,
          lastCostPerPiece: realCostPerPiece, // <--- ACTUALIZA EL COSTO PARA EL DASHBOARD Y VENTAS
          lastUpdate: serverTimestamp(),
        },
        { merge: true },
      );

      // Guardar Log
      transaction.set(logRef, {
        parentCoilId: coilId,
        sku,
        piecesProduced: pieces,
        totalUsedWidth: activeStrip.width,
        scrapWidth: Number(scrapPerStrip.toFixed(2)),
        stripCost: activeStrip.costPerStrip,
        costPerPiece: realCostPerPiece,
        operatorId,
        status: "ACTIVE",
        timestamp: serverTimestamp(),
      });
    });
    return { success: true };
  } catch (e: any) {
    console.error("Error en Fase 2:", e);
    throw new Error(e.message || "Error al procesar el fleje.");
  }
};

// FASE 3: REVERTIR REGISTRO (POR ERROR DEL OPERADOR)
export const revertProductionLog = async (logId: string, userEmail: string) => {
  const logRef = doc(db, "production_logs", logId);
  const auditRef = doc(collection(db, "audit_logs"));

  try {
    await runTransaction(db, async (transaction) => {
      const logDoc = await transaction.get(logRef);
      if (!logDoc.exists()) throw new Error("El registro no existe.");
      const logData = logDoc.data() as ProductionLog;

      if (logData.status === "VOIDED")
        throw new Error("Este registro ya fue anulado.");

      const coilRef = doc(db, "coils", logData.parentCoilId);
      const stockRef = doc(db, "inventory_stock", logData.sku);
      const prodRef = doc(db, "products", logData.sku);

      const coilDoc = await transaction.get(coilRef);
      const stockDoc = await transaction.get(stockRef);
      const prodDoc = await transaction.get(prodRef);

      let standardWeight = prodDoc.exists()
        ? prodDoc.data().standardWeight || 0
        : 0;
      const weightToSubtract = logData.piecesProduced * standardWeight;

      // 1. REVERTIR INVENTARIO
      if (stockDoc.exists()) {
        const stockData = stockDoc.data();
        transaction.update(stockRef, {
          totalQuantity: Math.max(
            0,
            stockData.totalQuantity - logData.piecesProduced,
          ),
          totalWeight: Math.max(0, stockData.totalWeight - weightToSubtract),
          lastUpdate: serverTimestamp(),
        });
      }

      // 2. REVERTIR BOBINA (Devolver el fleje)
      if (coilDoc.exists()) {
        const coilData = coilDoc.data() as Coil;
        const updatedStrips = coilData.plannedStrips?.map((strip) => {
          if (strip.sku === logData.sku) {
            return { ...strip, pendingCount: strip.pendingCount + 1 };
          }
          return strip;
        });

        // Devolvemos el peso exacto del fleje a la bobina
        const weightPerMm = coilData.initialWeight / coilData.masterWidth;
        const restoredStripWeight = logData.totalUsedWidth * weightPerMm;
        const newCurrentWeight = Math.min(
          coilData.initialWeight,
          coilData.currentWeight + restoredStripWeight,
        );

        transaction.update(coilRef, {
          plannedStrips: updatedStrips,
          status: "IN_PROGRESS", // Si estaba procesada, vuelve a estar en progreso
          currentWeight: Number(newCurrentWeight.toFixed(2)),
          updatedAt: serverTimestamp(),
        });
      }

      // 3. AUDITORÍA
      transaction.update(logRef, {
        status: "VOIDED",
        voidedBy: userEmail,
        voidedAt: serverTimestamp(),
      });

      transaction.set(auditRef, {
        action: "VOID_PRODUCTION",
        entityId: logId,
        userEmail: userEmail,
        details: `Anulación de ${logData.piecesProduced} pzas de ${logData.sku}. Bobina: ${logData.parentCoilId}`,
        timestamp: serverTimestamp(),
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error revirtiendo registro:", error);
    throw new Error(error.message || "Error al anular el registro.");
  }
};

// ANULAR BOBINA MADRE
export const voidCoil = async (coilId: string, userEmail: string) => {
  const coilRef = doc(db, "coils", coilId);
  const auditRef = doc(collection(db, "audit_logs"));

  try {
    await runTransaction(db, async (transaction) => {
      const coilDoc = await transaction.get(coilRef);
      if (!coilDoc.exists()) throw new Error("La bobina no existe.");

      if (coilDoc.data().status !== "AVAILABLE") {
        throw new Error(
          "Solo se pueden anular bobinas DISPONIBLES. Si ya tiene cortes, anula los cortes primero.",
        );
      }

      transaction.update(coilRef, {
        status: "VOIDED",
        voidedBy: userEmail,
        voidedAt: serverTimestamp(),
      });

      transaction.set(auditRef, {
        action: "VOID_COIL",
        entityId: coilId,
        userEmail: userEmail,
        details: `Se anuló el ingreso de la bobina madre: ${coilId}`,
        timestamp: serverTimestamp(),
      });
    });
    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || "Error desconocido al anular.");
  }
};

// EDITAR BOBINA MADRE (AHORA INCLUYE ESPESOR)
export const updateCoil = async (
  coilId: string,
  updates: {
    initialWeight: number;
    currentWeight: number;
    masterWidth: number;
    thickness: number;
  },
  userEmail: string,
) => {
  const coilRef = doc(db, "coils", coilId);
  const auditRef = doc(collection(db, "audit_logs"));

  try {
    await runTransaction(db, async (transaction) => {
      const coilDoc = await transaction.get(coilRef);
      if (!coilDoc.exists()) throw new Error("La bobina no existe.");

      if (coilDoc.data().status !== "AVAILABLE") {
        throw new Error(
          "Solo puedes editar bobinas DISPONIBLES para no corromper los costos actuales.",
        );
      }

      transaction.update(coilRef, {
        initialWeight: updates.initialWeight,
        currentWeight: updates.currentWeight,
        masterWidth: updates.masterWidth,
        thickness: updates.thickness, // Aseguramos que se actualice el espesor
        updatedAt: serverTimestamp(),
      });

      transaction.set(auditRef, {
        action: "EDIT_COIL",
        entityId: coilId,
        userEmail: userEmail,
        details: `Editó bobina: Peso a ${updates.initialWeight}kg, Ancho a ${updates.masterWidth}mm, Espesor a ${updates.thickness}mm.`,
        timestamp: serverTimestamp(),
      });
    });
    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || "Error al editar.");
  }
};
