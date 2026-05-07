import { db } from "@/lib/firebase/clientApp";
import {
  doc,
  runTransaction,
  serverTimestamp,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
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

      // --- NUEVA LÓGICA DE COSTO ABSORBIDO (MERMA DE REFILADO) ---

      // 1. Calculamos el Ancho Total que realmente se va a convertir en flejes
      const totalPlannedWidth = items.reduce((sum, item) => {
        const product = productsData[item.sku];
        return sum + (product.stripWidth || 0) * item.quantity;
      }, 0);

      if (totalPlannedWidth > coil.masterWidth) {
        throw new Error(
          "El ancho total de los flejes supera el ancho de la bobina.",
        );
      }

      // 2. Costo Total de la Bobina Madre
      const totalCoilCost = coil.initialWeight * coil.pricePerKg;

      // 3. Calculamos el costo por milímetro (absorbiendo merma si aplica)
      let effectiveCostPerMm = totalCoilCost / coil.masterWidth; // Costo estándar

      const leftoverWidth = coil.masterWidth - totalPlannedWidth;

      // Si sobra algo, pero es 40mm o menos, asumimos que es chatarra de bordes (refile) y la absorbemos
      if (leftoverWidth > 0 && leftoverWidth <= 40) {
        effectiveCostPerMm = totalCoilCost / totalPlannedWidth;
      }

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
          // Aquí usamos el nuevo costo efectivo que ya incluye la merma de los bordes
          costPerStrip: Number((width * effectiveCostPerMm).toFixed(2)),
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

// FASE 2: PROCESAR UN FLEJE (CONFORMADORA) CON COSTO PROMEDIO PONDERADO
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
      if (!coil.masterWidth || !coil.initialWeight) {
        throw new Error(
          "Data corrupta: La bobina seleccionada no tiene un ancho maestro o peso inicial registrado.",
        );
      }

      const weightPerMm = coil.initialWeight / coil.masterWidth;
      const theoreticalStripWeight = activeStrip.width * weightPerMm;

      const standardWeight = product.standardWeight || 0;
      if (standardWeight === 0)
        throw new Error(
          `El SKU ${sku} no tiene Peso Estándar configurado en el catálogo.`,
        );

      const reportedProductionWeight = pieces * standardWeight;

      if (reportedProductionWeight > theoreticalStripWeight * 1.05) {
        throw new Error(
          `¡Límite Físico Excedido! Es imposible sacar ${pieces} piezas. ` +
            `El fleje pesa ${theoreticalStripWeight.toFixed(2)}kg y reportaste ${reportedProductionWeight.toFixed(2)}kg.`,
        );
      }

      // Extraemos el inventario actual antes del nuevo ingreso
      const currentQty = stockDoc.exists()
        ? stockDoc.data().totalQuantity || 0
        : 0;
      const currentWeightStock = stockDoc.exists()
        ? stockDoc.data().totalWeight || 0
        : 0;
      const currentAverageCost = stockDoc.exists()
        ? stockDoc.data().lastCostPerPiece || 0
        : 0;

      // --- 2. CÁLCULO DE COSTO PROMEDIO PONDERADO ---

      // Costo específico de ESTE lote que sale de la máquina hoy
      const costOfThisBatch = activeStrip.costPerStrip / pieces;

      let newAverageCost = costOfThisBatch; // Por defecto asume el costo de hoy

      // Si tenemos stock positivo real en el almacén, aplicamos el Promedio Ponderado
      if (currentQty > 0) {
        const inventoryValueBefore = currentQty * currentAverageCost;
        const newBatchValue = activeStrip.costPerStrip; // El valor total en dinero del fleje

        // Fórmula contable: (Valor Total Antiguo + Valor Total Nuevo) / (Piezas Antiguas + Piezas Nuevas)
        newAverageCost =
          (inventoryValueBefore + newBatchValue) / (currentQty + pieces);
      }
      // NOTA: Si currentQty es <= 0 (negativo por ventas), omitimos el promedio
      // y usamos el 'costOfThisBatch' como nuevo precio base para no distorsionar las matemáticas.

      const totalPlannedWidth = coil.plannedStrips!.reduce(
        (sum, s) => sum + s.width * s.initialCount,
        0,
      );
      const scrapPerStrip =
        (coil.masterWidth - totalPlannedWidth) /
        coil.plannedStrips!.reduce((sum, s) => sum + s.initialCount, 0);

      const newCurrentWeight = Math.max(
        0,
        (coil.currentWeight || coil.initialWeight) - theoreticalStripWeight,
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

      // Sumar al Stock e Inyectar el Costo Promedio
      transaction.set(
        stockRef,
        {
          sku,
          totalQuantity: currentQty + pieces,
          totalWeight: currentWeightStock + reportedProductionWeight,
          lastCostPerPiece: Number(newAverageCost.toFixed(6)), // <--- AHORA GUARDA EL COSTO PROMEDIO
          lastUpdate: serverTimestamp(),
        },
        { merge: true },
      );

      // Guardar Log (Mantiene el costo de este lote individual para auditoría)
      transaction.set(logRef, {
        parentCoilId: coilId,
        sku,
        piecesProduced: pieces,
        totalUsedWidth: activeStrip.width,
        scrapWidth: Number(scrapPerStrip.toFixed(2)),
        stripCost: activeStrip.costPerStrip,
        costPerPiece: Number(costOfThisBatch.toFixed(6)), // El costo que rindió esta máquina
        averageCostAfter: Number(newAverageCost.toFixed(6)), // El promedio que generó en el almacén global
        reportedWeight: reportedProductionWeight,
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
    // --- 1. BÚSQUEDA DEL COSTO ANTERIOR ---
    // Leemos el registro que vamos a anular para saber de qué producto (SKU) se trata
    const logSnap = await getDocs(
      query(collection(db, "production_logs"), where("__name__", "==", logId)),
    );
    if (logSnap.empty) throw new Error("El registro no existe.");
    const logDataForQuery = logSnap.docs[0].data();

    // Buscamos los últimos 2 cortes válidos de este producto en el historial
    const recentLogsQuery = query(
      collection(db, "production_logs"),
      where("sku", "==", logDataForQuery.sku),
      where("status", "==", "ACTIVE"),
      orderBy("timestamp", "desc"),
      limit(2),
    );
    const recentLogsSnap = await getDocs(recentLogsQuery);

    let previousValidCost: number | null = null;

    // Si el log que estamos anulando es el último, tomamos el costo del "penúltimo"
    recentLogsSnap.docs.forEach((docSnap) => {
      if (docSnap.id !== logId) {
        previousValidCost =
          docSnap.data().averageCostAfter || docSnap.data().costPerPiece || 0;
      }
    });

    // --- 2. EJECUTAR LA TRANSACCIÓN DE ANULACIÓN ---
    await runTransaction(db, async (transaction) => {
      const logDoc = await transaction.get(logRef);
      if (!logDoc.exists()) throw new Error("El registro no existe.");
      const logData = logDoc.data() as ProductionLog & {
        reportedWeight?: number;
      };

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
      const weightToSubtract =
        logData.reportedWeight || logData.piecesProduced * standardWeight;

      // REVERTIR INVENTARIO Y RESTAURAR COSTO EXACTO
      if (stockDoc.exists()) {
        const stockData = stockDoc.data();
        const newQuantity = stockData.totalQuantity - logData.piecesProduced;
        const newWeight = stockData.totalWeight - weightToSubtract;

        const stockUpdatePayload: any = {
          totalQuantity: newQuantity,
          totalWeight: newWeight,
          lastUpdate: serverTimestamp(),
        };

        // 💡 AQUÍ APLICAMOS LA MAGIA: Restauramos el costo al valor del corte anterior
        if (previousValidCost !== null) {
          stockUpdatePayload.lastCostPerPiece = previousValidCost;
        } else if (newQuantity === 0) {
          // Si no hay cortes anteriores y el stock llega a cero, reseteamos a cero
          stockUpdatePayload.lastCostPerPiece = 0;
        }

        transaction.update(stockRef, stockUpdatePayload);
      }

      // REVERTIR BOBINA (Devolver el fleje a la máquina)
      if (coilDoc.exists()) {
        const coilData = coilDoc.data() as Coil;

        if (!coilData.masterWidth || !coilData.initialWeight) {
          throw new Error(
            "Data corrupta: La bobina madre no tiene ancho o peso inicial.",
          );
        }

        const updatedStrips = coilData.plannedStrips?.map((strip) => {
          if (strip.sku === logData.sku) {
            return { ...strip, pendingCount: strip.pendingCount + 1 };
          }
          return strip;
        });

        const weightPerMm = coilData.initialWeight / coilData.masterWidth;
        const restoredStripWeight = logData.totalUsedWidth * weightPerMm;
        const newCurrentWeight = Math.min(
          coilData.initialWeight,
          (coilData.currentWeight || 0) + restoredStripWeight,
        );

        transaction.update(coilRef, {
          plannedStrips: updatedStrips,
          status: "IN_PROGRESS",
          currentWeight: Number(newCurrentWeight.toFixed(2)),
          updatedAt: serverTimestamp(),
        });
      }

      // MARCAR COMO ANULADO EN AUDITORÍA
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

// EDITAR BOBINA MADRE (MEJORADO: AHORA GUARDA DATOS FINANCIEROS Y DE PROVEEDOR)
export const updateCoil = async (
  coilId: string,
  updates: any, // Recibe toda la data del modal
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

      // Convertimos la fecha de string a Date exacto de mediodía
      const finalInvoiceDate = updates.invoiceDate
        ? new Date(`${updates.invoiceDate}T12:00:00`)
        : null;

      const updatePayload: any = {
        initialWeight: updates.initialWeight,
        currentWeight: updates.currentWeight,
        masterWidth: updates.masterWidth,
        thickness: updates.thickness,
        pricePerKg: updates.pricePerKg,
        "metadata.providerName": updates.providerName,
        "metadata.provider": updates.providerName, // Mantenemos compatibilidad
        "metadata.providerDoc": updates.providerDoc,
        "metadata.providerDocType": updates.providerDocType,
        "metadata.invoiceNumber": updates.invoiceNumber,
        updatedAt: serverTimestamp(),
      };

      if (finalInvoiceDate) {
        updatePayload["metadata.invoiceDate"] = finalInvoiceDate;
      }

      transaction.update(coilRef, updatePayload);

      transaction.set(auditRef, {
        action: "EDIT_COIL",
        entityId: coilId,
        userEmail: userEmail,
        details: `Editó bobina: Peso ${updates.initialWeight}kg, Espesor ${updates.thickness}mm, Valor /Kg S/ ${updates.pricePerKg}.`,
        timestamp: serverTimestamp(),
      });
    });
    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || "Error al editar.");
  }
};

// --- NUEVA FUNCIÓN: CANCELAR PLAN DE CORTE (REVERTIR A DISPONIBLE) ---
export const cancelCuttingPlan = async (coilId: string, userEmail: string) => {
  const coilRef = doc(db, "coils", coilId);
  const auditRef = doc(collection(db, "audit_logs"));

  try {
    await runTransaction(db, async (transaction) => {
      const coilDoc = await transaction.get(coilRef);
      if (!coilDoc.exists()) throw new Error("La bobina no existe.");

      const coilData = coilDoc.data() as Coil;

      if (coilData.status !== "IN_PROGRESS") {
        throw new Error(
          "Solo se pueden cancelar planes de bobinas EN PROCESO.",
        );
      }

      // 🛡️ VALIDACIÓN ESTRICTA A PRUEBA DE ERRORES:
      // Verificamos si AL MENOS UN fleje ya tiene menos cantidad pendiente que la inicial (es decir, ya pasó por la máquina)
      const hasProcessedStrips = coilData.plannedStrips?.some(
        (strip) => strip.initialCount !== strip.pendingCount,
      );

      if (hasProcessedStrips) {
        throw new Error(
          "⛔ IMPOSIBLE CANCELAR: Ya se han ejecutado cortes en esta bobina. Para cancelar, primero debes anular los cortes realizados desde el historial de producción.",
        );
      }

      // Si pasa la validación (nadie ha cortado nada aún), limpiamos y devolvemos a AVAILABLE
      transaction.update(coilRef, {
        status: "AVAILABLE",
        plannedStrips: [], // Borramos el plan de corte erróneo
        updatedAt: serverTimestamp(),
      });

      transaction.set(auditRef, {
        action: "CANCEL_CUTTING_PLAN",
        entityId: coilId,
        userEmail: userEmail,
        details: `Canceló plan de corte. Bobina devuelta a DISPONIBLE de forma segura.`,
        timestamp: serverTimestamp(),
      });
    });
    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || "Error al cancelar el plan.");
  }
};
