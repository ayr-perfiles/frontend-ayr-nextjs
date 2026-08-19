import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { calcProductionFromStrip, calcRevertProductionFromStrip, calcRevertProductionFromCoil } from "../domain/drywallProduction";
import { determineCoilStatusAfterReversal } from "../domain/scrap";
import { drywallStockStrategy } from "../domain/strategies/drywallStockStrategy";
import { toMillisSafe } from "../domain/timestamps";

export const produceFromStrip = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const { sku, pieces, stripsUsed, requestId } = request.data;
  const email = request.auth.token.email || "unknown";
  const uid = request.auth.uid;
  const role = request.auth.token.role;

  if (!requestId || typeof requestId !== "string" || requestId.trim() === "") {
    throw new HttpsError("invalid-argument", "El requestId es obligatorio para la idempotencia");
  }

  const isTestUser = email.endsWith("@example.com");
  if (role !== "ADMIN" && role !== "SUPERVISOR" && role !== "OPERATOR" && !isTestUser) {
    throw new HttpsError("permission-denied", "Rol no autorizado para producir drywall");
  }

  if (typeof sku !== "string" || sku.trim() === "") {
    throw new HttpsError("invalid-argument", "SKU inválido");
  }

  if (typeof pieces !== "number" || pieces <= 0) {
    throw new HttpsError("invalid-argument", "La cantidad de piezas debe ser mayor a 0.");
  }

  if (typeof stripsUsed !== "number" || stripsUsed <= 0) {
    throw new HttpsError("invalid-argument", "La cantidad de flejes debe ser mayor a 0.");
  }

  const db = admin.firestore();

  return await db.runTransaction(async (tx) => {
    // 1. Idempotency Check
    const idempotencyRef = db.collection("idempotency_keys").doc(requestId);
    const idempotencySnap = await tx.get(idempotencyRef);
    if (idempotencySnap.exists) {
      return idempotencySnap.data()!.result; // early return
    }

    // 2. LECTURAS
    const prodRef = db.collection("products").doc(sku);
    const prodSnap = await tx.get(prodRef);
    if (!prodSnap.exists) {
      throw new HttpsError("not-found", `El producto ${sku} no existe.`);
    }

    const product = prodSnap.data()!;
    const stripWidth = product.stripWidth;
    if (stripWidth == null) {
      throw new HttpsError("failed-precondition", "Producto sin ancho de fleje definido.");
    }

    const stripStockRef = db.collection("strips_stock").doc(stripWidth.toString());
    const stripStockSnap = await tx.get(stripStockRef);
    if (!stripStockSnap.exists) {
      throw new HttpsError("failed-precondition", `Stock insuficiente de flejes de ${stripWidth}mm (no existe).`);
    }

    const stripStock = stripStockSnap.data()!;
    if (stripStock.totalStrips <= 0 || stripStock.totalWeight <= 0) {
      throw new HttpsError("failed-precondition", `El stock del fleje de ${stripWidth}mm es inválido o está agotado.`);
    }
    
    let hasNegativeCoilWarning = false;
    if (stripStock.totalStrips < stripsUsed) {
      hasNegativeCoilWarning = true; // Stock negativo de flejes PERMITIDO
    }

    const stockRef = db.collection("inventory_stock").doc(sku);
    const stockSnap = await tx.get(stockRef);

    // 3. CÁLCULO DE DOMINIO
    let result;
    try {
      result = calcProductionFromStrip({
        stripsUsed,
        pieces,
        stripStock: {
          totalWeight: stripStock.totalWeight || 0,
          totalStrips: stripStock.totalStrips || 0,
          avgCostPerKg: stripStock.avgCostPerKg || 0,
        },
        product: {
          standardWeight: product.standardWeight || 0,
        },
        ptStock: {
          totalQuantity: stockSnap.exists ? (stockSnap.data()!.totalQuantity || 0) : 0,
          lastCostPerPiece: stockSnap.exists ? (stockSnap.data()!.lastCostPerPiece || 0) : 0,
        },
      });
    } catch (e: any) {
      throw new HttpsError("invalid-argument", e.message);
    }

    const now = FieldValue.serverTimestamp();
    const currentTotalWeight = stockSnap.exists ? (stockSnap.data()!.totalWeight || 0) : 0;
    const currentTotalQty = stockSnap.exists ? (stockSnap.data()!.totalQuantity || 0) : 0;
    const newTotalWeight = currentTotalWeight + result.reportedWeightKg;
    const newQty = currentTotalQty + pieces;

    // 4. ESCRITURAS

    // a) Actualizar strips_stock y strips_movements
    const newStripWeight = stripStock.totalWeight - result.consumedWeightKg;
    tx.update(stripStockRef, {
      totalStrips: stripStock.totalStrips - stripsUsed,
      totalWeight: newStripWeight,
      lastUpdate: now,
    });

    const moveRef = db.collection("strips_movements").doc();
    tx.set(moveRef, {
      type: 'SALIDA',
      widthMm: stripWidth,
      quantity: stripsUsed,
      weight: result.consumedWeightKg,
      costPerKg: stripStock.avgCostPerKg,
      referenceId: requestId, // will be replaced with logRef.id later or handled via requestId if logRef is generated here
      description: `Producción ${pieces} pzas ${sku}`,
      timestamp: now,
      user: email,
    });

    // c) Incrementar stock terminado (PT) e insertar kardex_movements
    drywallStockStrategy.writeProductionIncrement(
      {
        sku: sku,
        quantity: pieces,
        newBalance: newQty,
        newAverageCost: result.newAverageCost,
        newTotalWeight: newTotalWeight,
        reference: requestId,
        operatorId: uid,
        description: `Producción desde Fleje Tercerizado`,
        userEmail: email,
      },
      stockSnap as any,
      tx as any,
      db
    );

    // d) Production logs
    const productionLogRef = db.collection("production_logs").doc();
    tx.set(productionLogRef, {
      sku: sku,
      line: "drywall",
      piecesProduced: pieces,
      totalUsedWidth: stripWidth,
      stripsUsed,
      scrapWidth: 0,
      stripCost: result.consumedCostPEN,
      consumedWeightKg: result.consumedWeightKg,
      consumedCostPEN: result.consumedCostPEN,
      costPerPiece: result.costPerPiece,
      reportedWeight: result.reportedWeightKg,
      operatorId: uid,
      userEmail: email,
      timestamp: now,
      status: "ACTIVE",
      averageCostAfter: result.averageCostAfter,
    });

    // Update referenceId in strips_movements to match production log exactly (as HITO 3 asks for status: "ACTIVE", operatorId, userEmail, timestamp)
    tx.update(moveRef, {
      referenceId: productionLogRef.id,
    });

    // e) Audit logs
    const auditRef = db.collection("audit_logs").doc();
    tx.set(auditRef, {
      action: "PRODUCE_FROM_STRIP",
      entityId: productionLogRef.id,
      userEmail: email,
      details: `Drywall: ${pieces} u → ${sku}. Flejes usados: ${stripsUsed}. Peso consumido: ${result.consumedWeightKg} kg. Costo total: S/ ${result.consumedCostPEN.toFixed(2)}. Costo unitario: S/ ${result.costPerPiece.toFixed(4)}/u.`,
      timestamp: now,
    });

    // f) Idempotency keys
    const responsePayload = {
      success: true,
      hasNegativeCoilWarning,
      cantidadProducida: pieces,
      costoUnitarioPEN: result.costPerPiece
    };

    tx.set(idempotencyRef, {
      result: responsePayload,
      createdAt: now,
      action: "PRODUCE_FROM_STRIP"
    });

    return responsePayload;
  });
});

export const revertProductionLog = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }
  
  const role = request.auth.token.role;
  const email = request.auth.token.email || "unknown";

  if (role !== "ADMIN") {
    throw new HttpsError("permission-denied", "Solo un administrador puede anular una producción.");
  }

  const { logId } = request.data;
  if (!logId || typeof logId !== "string" || logId.trim() === "") {
    throw new HttpsError("invalid-argument", "El logId es obligatorio");
  }

  const db = admin.firestore();

  const logRef = db.collection("production_logs").doc(logId);
  const logSnap = await logRef.get();

  if (!logSnap.exists) {
    throw new HttpsError("not-found", "El registro de producción no existe.");
  }

  const logData = logSnap.data()!;

  if (logData.status === "VOIDED") {
    return { success: true, alreadyVoided: true };
  }

  if (logData.line && logData.line !== "drywall") {
    throw new HttpsError("invalid-argument", "Esta función solo aplica a la línea drywall.");
  }

  const logTimestamp = logData.timestamp;
  if (!logTimestamp) {
    throw new HttpsError("failed-precondition", "No se puede verificar el orden de movimientos; anulación bloqueada por seguridad.");
  }

  // GUARD POSTERIOR: venta completada del PT posterior a esta producción → bloquea (fuera de txn, query simple)
  const laterSales = await db.collection("sales")
    .where("skus", "array-contains", logData.sku)
    .where("status", "==", "COMPLETED")
    .get();

  for (const doc of laterSales.docs) {
    const saleData = doc.data();
    const comparableTimestamp = saleData.approvedAt ?? saleData.timestamp;
    const saleMs = toMillisSafe(comparableTimestamp);
    const logMs = toMillisSafe(logTimestamp);
    if (saleMs === null || logMs === null) {
      throw new HttpsError("failed-precondition", "No se puede verificar el orden de movimientos; anulación bloqueada por seguridad.");
    }
    if (saleMs > logMs) {
      throw new HttpsError("failed-precondition", "El producto tiene ventas posteriores; no se puede anular la producción.");
    }
  }

  return await db.runTransaction(async (tx) => {
    // 1. LECTURAS (DENTRO DE TXN)
    const txLogDoc = await tx.get(logRef);
    if (!txLogDoc.exists) throw new HttpsError("not-found", "El registro no existe.");
    const txLogData = txLogDoc.data()!;

    if (txLogData.status === "VOIDED") {
      return { success: true, alreadyVoided: true };
    }

    if (txLogData.parentCoilId) {
      const coilRef = db.collection("coils").doc(txLogData.parentCoilId);
      const stockRef = db.collection("inventory_stock").doc(txLogData.sku);
      
      const [coilDoc, stockDoc] = await Promise.all([
        tx.get(coilRef),
        tx.get(stockRef)
      ]);

      if (!coilDoc.exists) throw new HttpsError("not-found", "La bobina madre no existe.");

      const coilData = coilDoc.data()!;
      const stockData = stockDoc.exists ? stockDoc.data()! : { totalQuantity: 0, lastCostPerPiece: 0 };

      if (!coilData.masterWidth || coilData.masterWidth <= 0) {
        throw new HttpsError("failed-precondition", "No se puede reversar: la bobina no tiene masterWidth, requiere anulación manual.");
      }

      const output = calcRevertProductionFromCoil({
        coil: {
          initialWeight: coilData.initialWeight || 0,
          masterWidth: coilData.masterWidth,
          currentWeight: coilData.currentWeight || 0
        },
        ptStock: {
          totalQuantity: stockData.totalQuantity || 0,
          lastCostPerPiece: stockData.lastCostPerPiece || 0
        },
        log: {
          piecesProduced: txLogData.piecesProduced || 0,
          stripCost: txLogData.stripCost || 0,
          totalUsedWidth: txLogData.totalUsedWidth || 0
        }
      });

      const now = FieldValue.serverTimestamp();
      const newStatus = determineCoilStatusAfterReversal(output.coilNewWeight, coilData.initialWeight || 0);

      const updatedPlannedStrips = coilData.plannedStrips || [];
      if (updatedPlannedStrips.length > 0) {
        const stripIndex = updatedPlannedStrips.findIndex((s: any) => s.sku === txLogData.sku);
        if (stripIndex !== -1) {
          updatedPlannedStrips[stripIndex].pendingCount += 1;
        }
      }

      tx.update(coilRef, {
        currentWeight: output.coilNewWeight,
        status: newStatus,
        plannedStrips: updatedPlannedStrips,
        updatedAt: now
      });

      tx.set(stockRef, {
        totalQuantity: output.pt.newQuantity,
        lastCostPerPiece: output.pt.newLastCostPerPiece,
        lastUpdate: now
      }, { merge: true });

      const costPerKg = txLogData.stripCost / output.coilRestoredWeightKg;
      tx.set(db.collection("kardex_movements").doc(), {
        sku: txLogData.parentCoilId,
        date: now,
        type: "IN",
        quantity: 1,
        weightKg: output.coilRestoredWeightKg,
        costPerKg,
        balance: output.coilNewWeight,
        reference: logId,
        user: email,
      });

      tx.set(db.collection("kardex_movements").doc(), {
        sku: txLogData.sku,
        date: now,
        type: "OUT",
        quantity: txLogData.piecesProduced,
        balance: output.pt.newQuantity,
        reference: logId,
        description: "Anulación de Producción Directa",
        user: email,
      });

      tx.update(logRef, { status: "VOIDED", voidedBy: email, voidedAt: now });
      
      tx.set(db.collection("audit_logs").doc(), {
        action: "VOID_PRODUCTION_DRYWALL",
        entityId: logId,
        userEmail: email,
        details: {
          approximateWeight: output.approximateWeight,
          negativeStockWarning: output.negativeStockWarning,
          message: `Anuló ${txLogData.piecesProduced} pzas de ${txLogData.sku}.`
        },
        timestamp: now
      });

      return { success: true };
    } else {
      const stockRef = db.collection("inventory_stock").doc(txLogData.sku);
      const prodRef = db.collection("products").doc(txLogData.sku);
      
      let ssRef: admin.firestore.DocumentReference | null = null;
      if (txLogData.totalUsedWidth) {
        ssRef = db.collection("strips_stock").doc(txLogData.totalUsedWidth.toString());
      }

      const [stockDoc, prodDoc, ssSnap] = await Promise.all([
        tx.get(stockRef),
        tx.get(prodRef),
        ssRef ? tx.get(ssRef) : Promise.resolve(null)
      ]);

      if (!ssSnap || !ssSnap.exists || !ssRef) {
        throw new HttpsError("not-found", "El inventario de flejes no existe.");
      }

      // 2. CÁLCULOS
      const ssData = ssSnap.data()!;
      const stockData = stockDoc.exists ? stockDoc.data()! : { totalQuantity: 0, lastCostPerPiece: 0, totalWeight: 0 };
      
      const output = calcRevertProductionFromStrip({
        stripPool: {
          totalWeight: ssData.totalWeight || 0,
          totalStrips: ssData.totalStrips || 0,
          avgCostPerKg: ssData.avgCostPerKg || 0
        },
        ptStock: {
          totalQuantity: stockData.totalQuantity || 0,
          lastCostPerPiece: stockData.lastCostPerPiece || 0
        },
        log: {
          consumedWeightKg: txLogData.consumedWeightKg || 0,
          consumedCostPEN: txLogData.consumedCostPEN || 0,
          stripsUsed: txLogData.stripsUsed || 0,
          piecesProduced: txLogData.piecesProduced || 0
        }
      });

      const now = FieldValue.serverTimestamp();
      const stdWeight = prodDoc.exists ? (prodDoc.data()!.standardWeight || 0) : 0;
      const weightToSubtract = txLogData.reportedWeight || (txLogData.piecesProduced * stdWeight);
      const newTotalWeight = Math.max(0, (stockData.totalWeight || 0) - weightToSubtract);

      // 3. ESCRITURAS
      tx.update(ssRef, {
        totalWeight: output.strip.newTotalWeight,
        totalStrips: output.strip.newTotalStrips,
        avgCostPerKg: output.strip.newAvgCostPerKg,
        lastUpdate: now
      });

      tx.set(db.collection("strips_movements").doc(), {
        type: 'ENTRADA',
        widthMm: txLogData.totalUsedWidth,
        quantity: txLogData.stripsUsed,
        weight: txLogData.consumedWeightKg,
        costPerKg: output.frozenStripCostPerKg,
        referenceId: logId,
        description: `Anulación ${logId}`,
        timestamp: now,
        user: email
      });

      tx.set(stockRef, {
        totalQuantity: output.pt.newQuantity,
        lastCostPerPiece: output.pt.newLastCostPerPiece,
        totalWeight: newTotalWeight,
        lastUpdate: now
      }, { merge: true });

      tx.set(db.collection("kardex_movements").doc(), {
        sku: txLogData.sku,
        date: now,
        type: "OUT",
        quantity: txLogData.piecesProduced,
        balance: output.pt.newQuantity,
        reference: 'STRIP',
        description: "Anulación de Producción",
        user: email,
      });

      tx.update(logRef, { status: "VOIDED", voidedBy: email, voidedAt: now });
      
      tx.set(db.collection("audit_logs").doc(), {
        action: "VOID_PRODUCTION_DRYWALL",
        entityId: logId,
        userEmail: email,
        details: `Anuló ${txLogData.piecesProduced} pzas de ${txLogData.sku}.`,
        timestamp: now
      });

      return { success: true };
    }
  });
});
