import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { calcProductionFromCoils } from "../domain/coilProduction";
import { CoilProductionInput, TargetSkuInfo } from "../types/production";
import { assertCoilFinishCompatible } from "../domain/finishCompat";
import { metallicRoofingStockStrategy } from "../domain/strategies/metallicRoofingStockStrategy";
import { determineCoilStatusAfterReversal } from "../domain/scrap";

export const produceFromCoils = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuario no autenticado");
  }

  const { targetSku, productKind, lengthM, coilInputs, requestId, source } = request.data;
  const email = request.auth.token.email || "unknown";
  const uid = request.auth.uid;
  const role = request.auth.token.role;

  if (!requestId || typeof requestId !== "string" || requestId.trim() === "") {
    throw new HttpsError("invalid-argument", "El requestId es obligatorio para la idempotencia");
  }

  const isTestUser = email.endsWith("@example.com");
  if (role !== "ADMIN" && role !== "SUPERVISOR" && role !== "OPERATOR" && !isTestUser) {
    throw new HttpsError("permission-denied", "Rol no autorizado para producir bobinas");
  }

  if (!coilInputs || !Array.isArray(coilInputs) || coilInputs.length === 0) {
    throw new HttpsError("invalid-argument", "Debe incluir al menos una bobina");
  }

  if (productKind !== "COBERTURA_ML" && productKind !== "PLANCHA_UND") {
    throw new HttpsError("invalid-argument", "productKind inválido");
  }

  if (productKind === "PLANCHA_UND" && typeof lengthM !== "number") {
    throw new HttpsError("invalid-argument", "lengthM es requerido para PLANCHA_UND");
  }

  for (const c of coilInputs) {
    if (typeof c.declared !== "number" || c.declared <= 0) {
      throw new HttpsError("invalid-argument", `Cantidad declarada inválida para la bobina ${c.coilId}`);
    }
  }

  const db = admin.firestore();
  console.log(`[DEBUG] produceFromCoils running in project: ${admin.app().options.projectId}`);
  console.log(`[DEBUG] Request data:`, JSON.stringify(request.data));

  return await db.runTransaction(async (tx) => {
    // 1. Idempotency Check
    const idempotencyRef = db.collection("idempotency_keys").doc(requestId);
    const idempotencySnap = await tx.get(idempotencyRef);
    if (idempotencySnap.exists) {
      return idempotencySnap.data()!.result; // early return
    }

    // 2. LECTURAS
    const coilRefs = coilInputs.map((c: any) => db.collection("coils").doc(c.coilId));
    const coilSnaps = await tx.getAll(...coilRefs);

    const finishIds = new Set<string>();
    for (let i = 0; i < coilSnaps.length; i++) {
      console.log(`[DEBUG] Looking for coil: ${coilRefs[i].path}`);
      console.log(`[DEBUG] Coil exists? ${coilSnaps[i].exists}`);
      if (!coilSnaps[i].exists) {
        throw new HttpsError("not-found", `La bobina ${coilInputs[i].coilId} no existe`);
      }
      const coil = coilSnaps[i].data()!;
      if (coil.finish) {
        finishIds.add(coil.finish);
      }
    }

    const finishesArr = Array.from(finishIds);
    let finishesSnap: admin.firestore.DocumentSnapshot[] = [];
    if (finishesArr.length > 0) {
      const finishRefs = finishesArr.map(fId => db.collection("coil_finishes").doc(fId));
      finishesSnap = await tx.getAll(...finishRefs);
    }
    
    const finishesMap = new Map<string, any>();
    finishesArr.forEach((fId, index) => {
      const snap = finishesSnap[index];
      if (!snap.exists) {
        throw new HttpsError("failed-precondition", `El acabado ${fId} no existe`);
      }
      const fData = snap.data()!;
      if (fData.densityFactor == null) {
        throw new HttpsError("failed-precondition", `El acabado ${fId} no tiene factor de densidad (densityFactor)`);
      }
      finishesMap.set(fId, { ...fData, id: fId });
    });
    
    // Simulate listFinishes returning array
    const finishesList = Array.from(finishesMap.values());

    const stockRef = db.collection("metallic_roofing_stock").doc(targetSku);
    const stockSnap = await tx.get(stockRef);

    // 3. VALIDACIÓN y PREPARACIÓN DE INPUTS
    const resolvedCoilInputs: CoilProductionInput[] = [];

    for (let i = 0; i < coilInputs.length; i++) {
      const { coilId, declared } = coilInputs[i];
      const coil = coilSnaps[i].data()!;

      if (coil.status !== "AVAILABLE" && coil.status !== "IN_PROGRESS") {
        throw new HttpsError("invalid-argument", `La bobina '${coilId}' no está disponible para producción (estado: ${coil.status}).`);
      }

      if (!coil.finish) {
        throw new HttpsError("failed-precondition", `La bobina '${coilId}' no tiene acabado asignado.`);
      }

      const compatResult = assertCoilFinishCompatible(coil.finish, "metallic-roofing", finishesList);
      if (!compatResult.success) {
        throw new HttpsError("invalid-argument", compatResult.error.message);
      }

      const finish = finishesMap.get(coil.finish);

      if (!coil.masterWidth) {
        throw new HttpsError("invalid-argument", `La bobina '${coilId}' no tiene ancho maestro (masterWidth) definido.`);
      }

      if (!coil.thickness) {
        throw new HttpsError("invalid-argument", `La bobina '${coilId}' no tiene espesor (thickness) definido.`);
      }

      resolvedCoilInputs.push({
        coilId,
        declared,
        thicknessMm: coil.thickness,
        masterWidth: coil.masterWidth,
        pricePerKg: coil.pricePerKg || 0,
        coilDensityFactor: finish.densityFactor,
        reportedWeightKg: coilInputs[i].reportedWeightKg,
      });
    }

    // 4. CÁLCULO DE DOMINIO
    const targetSkuInfo: TargetSkuInfo = { productKind, lengthM };
    let result;
    try {
      result = calcProductionFromCoils(targetSkuInfo, resolvedCoilInputs);
    } catch (e: any) {
      throw new HttpsError("invalid-argument", e.message);
    }

    // WAC
    const currentQty = stockSnap.exists ? (stockSnap.data()!.quantity || 0) : 0;
    const currentAvgCost = stockSnap.exists ? (stockSnap.data()!.avgCost || 0) : 0;
    const newQty = currentQty + result.cantidadProducida;
    const newValue = currentQty * currentAvgCost + result.costoTotalPEN;
    const newAvgCost = newQty > 0 ? Number((newValue / newQty).toFixed(6)) : result.costoUnitarioPEN;

    let hasNegativeCoilWarning = false;
    const now = FieldValue.serverTimestamp();

    // 5. ESCRITURAS

    // a) Actualizar bobinas y kardex
    for (let i = 0; i < coilInputs.length; i++) {
      const coilRef = coilRefs[i];
      const coil = coilSnaps[i].data()!;
      const breakdown = result.perCoilBreakdown[i];

      const newWeight = Number((coil.currentWeight - breakdown.weightConsumedKg).toFixed(4));
      if (newWeight < 0) hasNegativeCoilWarning = true;

      const newStatus = newWeight <= 0 ? "PROCESSED" : "IN_PROGRESS";

      tx.update(coilRef, {
        currentWeight: newWeight,
        status: newStatus,
        updatedAt: now,
      });

      const kardexRef = db.collection("kardex_movements").doc();
      tx.set(kardexRef, {
        sku: coilInputs[i].coilId,
        date: now,
        type: "OUT",
        quantity: 1,
        weightKg: breakdown.weightConsumedKg,
        costPerKg: coil.pricePerKg || 0,
        balance: newWeight,
        reference: targetSku,
        description: `Conformado → ${targetSku} (${breakdown.mlFromCoil.toFixed(2)} ML / ${breakdown.weightConsumedKg.toFixed(2)} kg)`,
        user: email,
      });
    }

    // b) Incrementar stock terminado
    metallicRoofingStockStrategy.writeProductionIncrement(
      {
        sku: targetSku,
        quantity: result.cantidadProducida,
        newBalance: newQty,
        newAverageCost: newAvgCost,
        reference: coilInputs.map((c: any) => c.coilId).join("+"),
        operatorId: uid,
        description: `Conformado desde ${coilInputs.length} bobina(s). S/ ${result.costoUnitarioPEN.toFixed(4)}/u`,
      },
      stockSnap as any,
      tx as any,
      db
    );

    // c) Production logs
    // Enriquecimiento ADITIVO opcional (piecesCount/pieceLengthM): NO participa en calcProductionFromCoils
    // (dominio puro sin cambios, paridad intacta). Solo trazabilidad del desglose cantidad×longitud para COBERTURA_ML.
    const enrichedBreakdown = result.perCoilBreakdown.map((b, i) => {
      const input = coilInputs[i];
      const extra: { piecesCount?: number; pieceLengthM?: number } = {};
      if (typeof input?.piecesCount === "number" && input.piecesCount > 0) {
        extra.piecesCount = input.piecesCount;
      }
      if (typeof input?.pieceLengthM === "number" && input.pieceLengthM > 0) {
        extra.pieceLengthM = input.pieceLengthM;
      }
      return { ...b, ...extra };
    });

    const productionLogRef = db.collection("production_logs").doc();
    tx.set(productionLogRef, {
      sku: targetSku,
      line: "metallic-roofing",
      parentCoilIds: coilInputs.map((c: any) => c.coilId),
      parentCoilId: coilInputs[0].coilId,
      piecesProduced: result.cantidadProducida,
      totalUsedWidth: 0,
      scrapWidth: 0,
      stripCost: result.costoTotalPEN,
      costPerPiece: result.costoUnitarioPEN,
      reportedWeight: result.pesoTotalKg,
      operatorId: uid,
      timestamp: now,
      status: "ACTIVE",
      mlProduced: result.totalMl,
      averageCostAfter: newAvgCost,
      coilDensityFactor: resolvedCoilInputs[0]?.coilDensityFactor ?? null,
      perCoilBreakdown: enrichedBreakdown,
      source: (source && source.type === 'QUOTE' && typeof source.id === 'string' && source.id.trim() !== '') ? source : null,
    });

    // d) Audit logs
    const auditRef = db.collection("audit_logs").doc();
    tx.set(auditRef, {
      action: "PRODUCE_FROM_COILS",
      entityId: targetSku,
      userEmail: email,
      details: `Conformado: ${result.cantidadProducida} u → ${targetSku}. Bobinas: [${coilInputs.map((c: any) => c.coilId).join(', ')}]. Peso: ${result.pesoTotalKg} kg. Costo total: S/ ${result.costoTotalPEN.toFixed(2)}. Costo unitario: S/ ${result.costoUnitarioPEN.toFixed(4)}/u.`,
      timestamp: now,
    });

    // e) Idempotency keys
    const responsePayload = {
      success: true,
      hasNegativeCoilWarning,
      cantidadProducida: result.cantidadProducida,
      costoUnitarioPEN: result.costoUnitarioPEN
    };

    tx.set(idempotencyRef, {
      result: responsePayload,
      createdAt: now,
      action: "PRODUCE_FROM_COILS"
    });

    return responsePayload;
  });
});

export const voidProductionFromCoils = onCall(async (request) => {
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

  const log = logSnap.data()!;

  if (log.status === "VOIDED") {
    throw new HttpsError("failed-precondition", "El registro de producción ya fue anulado.");
  }

  if (log.line !== "metallic-roofing") {
    throw new HttpsError("invalid-argument", "Esta función solo aplica a la línea metallic-roofing.");
  }

  if (!log.perCoilBreakdown || !Array.isArray(log.perCoilBreakdown) || log.perCoilBreakdown.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      "El registro de producción no tiene desglose de bobinas (perCoilBreakdown) válido. No se puede anular de forma precisa.",
    );
  }

  const logTimestamp = log.timestamp;
  if (!logTimestamp) {
    throw new HttpsError("failed-precondition", "No se puede verificar el orden de movimientos; anulación bloqueada por seguridad.");
  }

  // GUARD POSTERIOR: venta completada del PT posterior a esta producción → bloquea (fuera de txn, query simple)
  const laterSales = await db.collection("sales")
    .where("skus", "array-contains", log.sku)
    .where("status", "==", "COMPLETED")
    .get();

  for (const doc of laterSales.docs) {
    const saleData = doc.data();
    // approvedAt = momento real de consumo en ventas ex-cotización (timestamp ahí es el de creación de la cotización, obsoleto).
    // timestamp = momento real de consumo en ventas directas (nunca tienen approvedAt).
    const comparableTimestamp = saleData.approvedAt ?? saleData.timestamp;
    if (!comparableTimestamp) {
      throw new HttpsError("failed-precondition", "No se puede verificar el orden de movimientos; anulación bloqueada por seguridad.");
    }
    if (comparableTimestamp.toMillis() > logTimestamp.toMillis()) {
      throw new HttpsError("failed-precondition", "El producto tiene ventas posteriores; no se puede anular la producción.");
    }
  }

  return await db.runTransaction(async (tx) => {
    // 1. LECTURAS
    const coilRefs = log.perCoilBreakdown.map((b: any) => db.collection("coils").doc(b.coilId));
    const stockRef = db.collection("metallic_roofing_stock").doc(log.sku);

    const [stockSnap, ...coilSnaps] = await Promise.all([
      tx.get(stockRef),
      ...coilRefs.map((ref: admin.firestore.DocumentReference) => tx.get(ref)),
    ]);

    for (let i = 0; i < coilSnaps.length; i++) {
      if (!coilSnaps[i].exists) {
        throw new HttpsError("not-found", `La bobina '${log.perCoilBreakdown[i].coilId}' referenciada no existe.`);
      }
    }

    if (!stockSnap.exists) {
      throw new HttpsError("not-found", `El stock del producto '${log.sku}' no existe.`);
    }

    const now = FieldValue.serverTimestamp();

    // 2. ESCRITURAS

    // a) LOG
    tx.update(logRef, {
      status: "VOIDED",
      voidedAt: now,
      voidedBy: email,
    });

    // b) BOBINAS + kardex (costo congelado)
    for (let i = 0; i < log.perCoilBreakdown.length; i++) {
      const breakdown = log.perCoilBreakdown[i];
      const coilRef = coilRefs[i];
      const coil = coilSnaps[i].data()!;

      const newWeight = Number((coil.currentWeight + breakdown.weightConsumedKg).toFixed(4));
      const newStatus = determineCoilStatusAfterReversal(newWeight, coil.initialWeight);
      const costPerKgCongelado = breakdown.costPEN / breakdown.weightConsumedKg;

      tx.update(coilRef, {
        currentWeight: newWeight,
        status: newStatus,
        updatedAt: now,
      });

      tx.set(db.collection("kardex_movements").doc(), {
        sku: coil.id,
        date: now,
        type: "IN",
        quantity: 1,
        weightKg: breakdown.weightConsumedKg,
        costPerKg: costPerKgCongelado,
        balance: newWeight,
        reference: logId,
        description: `Devolución MP por anulación de producción ${logId}`,
        user: email,
      });
    }

    // c) PRODUCTO TERMINADO (metallic_roofing_stock)
    const stockData = stockSnap.data()!;
    const currentQty = (stockData.quantity as number) || 0;
    const currentTotalValue = (stockData.totalValue as number) || 0;

    const nuevaQuantity = currentQty - log.piecesProduced;
    const costoCorrida = log.perCoilBreakdown.reduce((acc: number, b: any) => acc + b.costPEN, 0);
    const nuevoTotalValue = currentTotalValue - costoCorrida;
    const nuevoAvgCost = nuevaQuantity > 0 ? nuevoTotalValue / nuevaQuantity : 0;

    tx.update(stockRef, {
      quantity: nuevaQuantity,
      totalValue: Number(nuevoTotalValue.toFixed(2)),
      avgCost: Number(nuevoAvgCost.toFixed(6)),
      lastUpdate: now,
    });

    tx.set(db.collection("metallic_roofing_stock_movements").doc(), {
      sku: log.sku,
      type: "SALIDA",
      quantity: log.piecesProduced,
      costPerUnit: log.costPerPiece,
      reason: `Anulación de producción ${logId}`,
      businessLine: "metallic-roofing",
      createdBy: email,
      createdAt: now,
    });

    // d) AUDIT
    tx.set(db.collection("audit_logs").doc(), {
      action: "VOID_PRODUCTION_FROM_COILS",
      entityId: logId,
      userEmail: email,
      details: `Anulación de ${log.piecesProduced} u de ${log.sku}. Devolución de MP a ${log.perCoilBreakdown.length} bobina(s).`,
      timestamp: now,
    });

    return { success: true };
  });
});
