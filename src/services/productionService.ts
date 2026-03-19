import { db } from "@/lib/firebase/clientApp";
import {
  doc,
  runTransaction,
  serverTimestamp,
  collection,
} from "firebase/firestore";
import { Coil, CoilStatus, ProductionLog } from "@/types";
import { PRODUCT_CATALOG } from "@/config/products";

// FASE 1: GUARDAR PLAN DE CORTE (SLITTER)
export const saveCuttingPlan = async (
  coilId: string,
  items: { sku: string; quantity: number }[],
) => {
  const coilRef = doc(db, "coils", coilId);

  try {
    await runTransaction(db, async (transaction) => {
      const coilDoc = await transaction.get(coilRef);
      if (!coilDoc.exists())
        throw new Error("La bobina no existe en la base de datos.");

      const coil = coilDoc.data() as Coil;

      // Validación de los datos base de la bobina
      if (!coil.initialWeight || !coil.masterWidth || !coil.pricePerKg) {
        throw new Error(
          "Datos de bobina incompletos (Peso, Ancho o Precio son 0 o undefined).",
        );
      }

      const costPerMm =
        (coil.initialWeight / coil.masterWidth) * coil.pricePerKg;

      const plannedStrips = items.map((item) => {
        const product =
          PRODUCT_CATALOG[item.sku as keyof typeof PRODUCT_CATALOG];

        if (!product)
          throw new Error(`El producto ${item.sku} no existe en el catálogo.`);

        const width = product.stripWidth;

        // Verificación manual antes de enviar a Firebase
        if (width === undefined || width === null) {
          throw new Error(
            `Error: El producto ${item.sku} tiene 'stripWidth' indefinido en el catálogo.`,
          );
        }

        const qty = Number(item.quantity) || 0;
        if (qty <= 0)
          throw new Error(`La cantidad para ${item.sku} debe ser mayor a 0.`);

        const calculatedCost = Number((width * costPerMm).toFixed(2));

        return {
          sku: item.sku,
          initialCount: qty,
          pendingCount: qty,
          width: width, // Guardamos el ancho físico
          costPerStrip: calculatedCost,
        };
      });

      console.log("Datos a enviar a Firebase:", { plannedStrips });

      // Ejecución de la actualización
      transaction.update(coilRef, {
        plannedStrips: plannedStrips,
        status: "IN_PROGRESS",
        updatedAt: serverTimestamp(),
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error detallado en saveCuttingPlan:", error);
    throw new Error(
      error.message || "Error desconocido al guardar el plan de corte",
    );
  }
};

// FASE 2: PROCESAR UN FLEJE (CONFORMADORA)
export const processSingleStrip = async (
  coilId: string,
  sku: string,
  pieces: number,
  operatorId: string,
) => {
  const coilRef = doc(db, "coils", coilId);
  const stockRef = doc(db, "inventory_stock", sku);
  const logRef = doc(collection(db, "production_logs"));

  try {
    await runTransaction(db, async (transaction) => {
      const coilDoc = await transaction.get(coilRef);
      const stockDoc = await transaction.get(stockRef);

      if (!coilDoc.exists()) throw new Error("Bobina no existe");
      const coil = coilDoc.data() as Coil;

      const stripIndex = coil.plannedStrips?.findIndex(
        (s) => s.sku === sku && s.pendingCount > 0,
      );
      if (stripIndex === undefined || stripIndex === -1)
        throw new Error("No hay flejes disponibles");

      const activeStrip = coil.plannedStrips![stripIndex];

      // --- CÁLCULO DE MERMA PROPORCIONAL ---
      const totalPlannedWidth = coil.plannedStrips!.reduce(
        (sum, s) => sum + s.width * s.initialCount,
        0,
      );
      const totalCoilScrap = coil.masterWidth - totalPlannedWidth;
      const totalStripsInCoil = coil.plannedStrips!.reduce(
        (sum, s) => sum + s.initialCount,
        0,
      );
      const scrapPerStrip = totalCoilScrap / totalStripsInCoil;

      // --- CÁLCULO DE DESCUENTO DE PESO ---
      // Calculamos cuánto pesa este fleje en específico basado en su ancho
      const weightPerMm = coil.initialWeight / coil.masterWidth;
      const stripWeight = activeStrip.width * weightPerMm;
      const newCurrentWeight = Math.max(0, coil.currentWeight - stripWeight);

      // Actualizar memoria de la bobina
      const updatedStrips = [...coil.plannedStrips!];
      updatedStrips[stripIndex].pendingCount -= 1;

      const totalPending = updatedStrips.reduce(
        (sum, s) => sum + s.pendingCount,
        0,
      );

      // Escrituras
      transaction.update(coilRef, {
        plannedStrips: updatedStrips,
        status: totalPending === 0 ? "PROCESSED" : "IN_PROGRESS",
        // Si se acaban los flejes, el peso baja a 0 (liquidando la merma). Si no, guarda el peso calculado.
        currentWeight:
          totalPending === 0 ? 0 : Number(newCurrentWeight.toFixed(2)),
        updatedAt: serverTimestamp(),
      });

      const currentQty = stockDoc.exists() ? stockDoc.data().totalQuantity : 0;
      const currentWeightStock = stockDoc.exists()
        ? stockDoc.data().totalWeight
        : 0;
      const product = PRODUCT_CATALOG[sku as keyof typeof PRODUCT_CATALOG];

      transaction.set(
        stockRef,
        {
          sku,
          totalQuantity: currentQty + pieces,
          totalWeight: currentWeightStock + pieces * product.standardWeight,
          lastCostPerPiece: Number(
            (activeStrip.costPerStrip / pieces).toFixed(4),
          ),
          lastUpdate: serverTimestamp(),
        },
        { merge: true },
      );

      transaction.set(logRef, {
        parentCoilId: coilId,
        sku,
        piecesProduced: pieces,
        totalUsedWidth: activeStrip.width,
        scrapWidth: Number(scrapPerStrip.toFixed(2)),
        stripCost: activeStrip.costPerStrip,
        costPerPiece: Number((activeStrip.costPerStrip / pieces).toFixed(4)),
        operatorId,
        timestamp: serverTimestamp(),
      });
    });
  } catch (e) {
    console.error(e);
    throw e;
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

      // 1. Verificación de seguridad
      if (logData.status === "VOIDED") {
        throw new Error("Este registro ya fue anulado previamente.");
      }

      const coilRef = doc(db, "coils", logData.parentCoilId);
      const stockRef = doc(db, "inventory_stock", logData.sku);

      const coilDoc = await transaction.get(coilRef);
      const stockDoc = await transaction.get(stockRef);

      // 2. REVERTIR INVENTARIO (Restar lo que se sumó por error)
      if (stockDoc.exists()) {
        const stockData = stockDoc.data();
        const product =
          PRODUCT_CATALOG[logData.sku as keyof typeof PRODUCT_CATALOG];
        const weightToSubtract =
          logData.piecesProduced * product.standardWeight;

        transaction.update(stockRef, {
          totalQuantity: Math.max(
            0,
            stockData.totalQuantity - logData.piecesProduced,
          ),
          totalWeight: Math.max(0, stockData.totalWeight - weightToSubtract),
          lastUpdate: serverTimestamp(),
        });
      }

      // 3. REVERTIR BOBINA (Devolver el fleje para que se pueda volver a usar)
      if (coilDoc.exists()) {
        const coilData = coilDoc.data() as Coil;
        const updatedStrips = coilData.plannedStrips?.map((strip) => {
          if (strip.sku === logData.sku) {
            return { ...strip, pendingCount: strip.pendingCount + 1 };
          }
          return strip;
        });

        // Calculamos el peso a devolver a la bobina
        const weightPerMm = coilData.initialWeight / coilData.masterWidth;
        const restoredStripWeight = logData.totalUsedWidth * weightPerMm;
        const newCurrentWeight = Math.min(
          coilData.initialWeight,
          coilData.currentWeight + restoredStripWeight,
        );

        transaction.update(coilRef, {
          plannedStrips: updatedStrips,
          status: "IN_PROGRESS", // Si la bobina se había marcado como terminada, la revivimos
          currentWeight: Number(newCurrentWeight.toFixed(2)), // Devolvemos el peso
          updatedAt: serverTimestamp(),
        });
      }

      // 4. MARCAR LOG COMO ANULADO (No lo borramos, lo tachamos)
      transaction.update(logRef, {
        status: "VOIDED",
        voidedBy: userEmail,
        voidedAt: serverTimestamp(),
      });

      // 5. REGISTRAR LA AUDITORÍA
      transaction.set(auditRef, {
        action: "VOID_PRODUCTION",
        entityId: logId,
        userEmail: userEmail,
        details: `Anulación de ${logData.piecesProduced} piezas de ${logData.sku}. Bobina afectada: ${logData.parentCoilId}`,
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

      const coilData = coilDoc.data();

      // REGLA DE NEGOCIO: Solo anular si no ha sido tocada
      if (coilData.status !== "AVAILABLE") {
        throw new Error(
          "⚠️ Solo se pueden anular bobinas DISPONIBLES. Si ya tiene cortes, anula los cortes primero.",
        );
      }

      // Marcamos como anulada
      transaction.update(coilRef, {
        status: "VOIDED",
        voidedBy: userEmail,
        voidedAt: serverTimestamp(),
      });

      // Guardamos la auditoría
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
    console.error("Error al anular bobina:", error);
    throw new Error(error.message || "Error desconocido al anular.");
  }
};

// EDITAR BOBINA MADRE
export const updateCoil = async (
  coilId: string,
  updates: {
    initialWeight: number;
    currentWeight: number;
    masterWidth: number;
  },
  userEmail: string,
) => {
  const coilRef = doc(db, "coils", coilId);
  const auditRef = doc(collection(db, "audit_logs"));

  try {
    await runTransaction(db, async (transaction) => {
      const coilDoc = await transaction.get(coilRef);
      if (!coilDoc.exists()) throw new Error("La bobina no existe.");

      const coilData = coilDoc.data();

      // REGLA: Solo editar si no tiene cortes
      if (coilData.status !== "AVAILABLE") {
        throw new Error(
          "⚠️ Solo puedes editar bobinas DISPONIBLES. Si ya tiene cortes, los costos se corromperán.",
        );
      }

      // Actualizamos la bobina
      transaction.update(coilRef, {
        initialWeight: updates.initialWeight,
        currentWeight: updates.currentWeight,
        masterWidth: updates.masterWidth,
        updatedAt: serverTimestamp(),
      });

      // Guardamos la auditoría
      transaction.set(auditRef, {
        action: "EDIT_COIL",
        entityId: coilId,
        userEmail: userEmail,
        details: `Editó bobina: Peso a ${updates.initialWeight}kg, Ancho a ${updates.masterWidth}mm.`,
        timestamp: serverTimestamp(),
      });
    });
    return { success: true };
  } catch (error: any) {
    console.error("Error al editar bobina:", error);
    throw new Error(error.message || "Error al editar.");
  }
};
