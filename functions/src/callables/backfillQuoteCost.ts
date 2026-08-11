import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { isQuoteFulfilled, productionUnitCostBySku, applyCostCascade, ProductionLogLike } from "../domain/quoteFulfillment";

// LISTA CONGELADA de cotizaciones aprobadas para el backfill
const WHITELIST_QUOTE_IDS = [
  "COT-FFA1-1289",
  "COT-FFA1-1262",
  "COT-FFA1-1290",
  "COT-FFA1-1279",
  "COT-FFA1-1264",
  "COT-BBV1-316",
  "COT-FFA1-1265",
  "COT-FFA1-1276"
];

export const backfillQuoteCost = functions.https.onCall(async (request) => {
  // 1. Autorización: Solo ADMIN
  const role = request.auth?.token?.role;
  if (role !== "ADMIN") {
    throw new functions.https.HttpsError("permission-denied", "Only ADMIN can backfill quote costs");
  }

  const quoteId = request.data?.quoteId;
  if (!quoteId || typeof quoteId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Missing or invalid quoteId");
  }

  // 2. Guard de whitelist
  if (!WHITELIST_QUOTE_IDS.includes(quoteId)) {
    return { skipped: true, reason: "not-in-whitelist" };
  }

  const db = admin.firestore();

  // 3. Query de logs PRE-txn
  const logsSnap = await db
    .collection("production_logs")
    .where("source.id", "==", quoteId)
    .get();

  const logs = logsSnap.docs.map(d => d.data() as ProductionLogLike);
  
  // Si no hay logs en absoluto, no califica
  if (logs.length === 0) {
    return { skipped: true, reason: "no-production-logs" };
  }

  return await db.runTransaction(async (tx) => {
    // 4. tx.get de cotización y venta
    const quoteRef = db.collection("sales").doc(quoteId);
    const quoteSnap = await tx.get(quoteRef);

    if (!quoteSnap.exists) {
      return { skipped: true, reason: "quote-not-found" };
    }

    const quoteData = quoteSnap.data() as any;

    // (ii) isQuoteFulfilled
    if (!isQuoteFulfilled(quoteData.items, logs)) {
      return { skipped: true, reason: "quote-not-fulfilled" };
    }

    const relatedSaleId = quoteData.relatedSaleId;
    if (!relatedSaleId) {
      return { skipped: true, reason: "no-related-sale" };
    }

    const saleRef = db.collection("sales").doc(relatedSaleId);
    const saleSnap = await tx.get(saleRef);

    if (!saleSnap.exists) {
      return { skipped: true, reason: "sale-not-found" };
    }

    const saleData = saleSnap.data() as any;

    // Idempotencia: (iv) la venta NO tiene costSyncedAt
    if (saleData.costSyncedAt) {
      return { skipped: true, reason: "already-synced" };
    }

    // 5. Apply cost cascade
    const costBySku = productionUnitCostBySku(logs);
    const updatedSale = applyCostCascade(saleData, costBySku);

    // 6. tx.update
    tx.update(saleRef, {
      items: updatedSale.items,
      totalCost: updatedSale.totalCost,
      totalProfit: updatedSale.totalProfit,
      allFlags: updatedSale.allFlags,
      costSyncedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { skipped: false, success: true, updatedSaleId: relatedSaleId };
  });
});
