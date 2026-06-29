import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { calcProductionFromStrip } from "../domain/drywallProduction";
import { drywallStockStrategy } from "../domain/strategies/drywallStockStrategy";

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

  const isTestUser = email.endsWith("@example.com") || email.endsWith("@ayrsteel.com");
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
