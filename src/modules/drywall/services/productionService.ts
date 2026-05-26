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
  endBefore,
  getCountFromServer,
  limitToLast,
  startAfter,
  documentId,
  QueryConstraint,
  QueryDocumentSnapshot,
  DocumentData,
  FieldValue,
} from "firebase/firestore";
import { Coil, ProductionLog } from "@/types";
import { algoliaClient, ALGOLIA_INDICES } from "@/lib/algoliaClient";
import { DEFAULT_PIECE_LENGTH_M } from "@/domain/steel/constants";
import { calculateCuttingPlan, calculateScrapPerStrip, type PlanItem } from "../domain/slitter";
import { calculateWeightedAverageCost } from "../domain/costing";
import { validateCoilData, validateProductionInput } from "../domain/validation";

export interface CoilUpdates {
  initialWeight: number;
  currentWeight: number;
  masterWidth: number;
  thickness: number;
  pricePerKg: number;
  providerDocType: "LOCAL" | "TAX_ID";
  providerDoc: string;
  providerName: string;
  invoiceNumber: string;
  invoiceDate?: string;
}

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

      validateCoilData(coil);

      const productsData: Record<string, { stripWidth?: number }> = {};
      for (const item of items) {
        const prodRef = doc(db, "products", item.sku);
        const prodDoc = await transaction.get(prodRef);

        if (!prodDoc.exists())
          throw new Error(`El producto ${item.sku} no existe en el catálogo.`);
        productsData[item.sku] = prodDoc.data() as { stripWidth?: number };
      }

      const planItems: PlanItem[] = items.map((item) => ({
        sku: item.sku,
        quantity: item.quantity,
        stripWidth: productsData[item.sku].stripWidth ?? 0,
      }));

      const totalCoilCost = coil.initialWeight * coil.pricePerKg;
      const { plannedStrips } = calculateCuttingPlan({
        totalCoilCost,
        masterWidth: coil.masterWidth!,
        items: planItems,
      });

      transaction.update(coilRef, {
        plannedStrips: plannedStrips,
        status: "IN_PROGRESS",
        updatedAt: serverTimestamp(),
      });
    });
    return { success: true };
  } catch (error: unknown) {
    console.error("Error en saveCuttingPlan:", error);
    throw new Error(error instanceof Error ? error.message : "Error al guardar plan de corte");
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

      validateCoilData(coil);

      if (!coil.thickness) {
        throw new Error(
          "Data corrupta: La bobina seleccionada no tiene espesor.",
        );
      }

      const weightPerMm = coil.initialWeight / coil.masterWidth!;
      const theoreticalStripWeight = activeStrip.width * weightPerMm;

      const pieceLength = product.lengthMeters || DEFAULT_PIECE_LENGTH_M;

      validateProductionInput({
        requestedPieces: pieces,
        stripWeight: theoreticalStripWeight,
        stripWidth: activeStrip.width,
        thickness: coil.thickness,
        pieceLength,
      });

      // Mantenemos el peso estándar para la valorización del Kardex
      const standardWeight = product.standardWeight || 0;
      const reportedProductionWeight = pieces * standardWeight;

      const currentQty = stockDoc.exists()
        ? stockDoc.data().totalQuantity || 0
        : 0;
      const currentWeightStock = stockDoc.exists()
        ? stockDoc.data().totalWeight || 0
        : 0;
      const currentAverageCost = stockDoc.exists()
        ? stockDoc.data().lastCostPerPiece || 0
        : 0;

      const costOfThisBatch = activeStrip.costPerStrip / pieces;
      const newAverageCost = calculateWeightedAverageCost({
        currentQty,
        currentAverageCost,
        batchTotalCost: activeStrip.costPerStrip,
        newPieces: pieces,
      });

      const scrapPerStrip = calculateScrapPerStrip(
        coil.masterWidth!,
        coil.plannedStrips!,
      );

      const newCurrentWeight = Math.max(
        0,
        (coil.currentWeight || coil.initialWeight) - theoreticalStripWeight,
      );

      const updatedStrips = [...coil.plannedStrips!];
      updatedStrips[stripIndex].pendingCount -= 1;
      const totalPending = updatedStrips.reduce(
        (sum, s) => sum + s.pendingCount,
        0,
      );

      transaction.update(coilRef, {
        plannedStrips: updatedStrips,
        status: totalPending === 0 ? "PROCESSED" : "IN_PROGRESS",
        currentWeight:
          totalPending === 0 ? 0 : Number(newCurrentWeight.toFixed(2)),
        updatedAt: serverTimestamp(),
      });

      const newKardexBalance = currentQty + pieces;

      transaction.set(
        stockRef,
        {
          sku,
          totalQuantity: newKardexBalance,
          totalWeight: currentWeightStock + reportedProductionWeight,
          lastCostPerPiece: Number(newAverageCost.toFixed(6)),
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
        costPerPiece: Number(costOfThisBatch.toFixed(6)),
        averageCostAfter: Number(newAverageCost.toFixed(6)),
        reportedWeight: reportedProductionWeight,
        operatorId,
        status: "ACTIVE",
        timestamp: serverTimestamp(),
      });

      const kardexRef = doc(collection(db, "kardex_movements"));
      transaction.set(kardexRef, {
        sku: sku,
        date: serverTimestamp(),
        type: "IN",
        quantity: pieces,
        balance: newKardexBalance,
        reference: coilId,
        description: "Ingreso por Producción",
        user: operatorId,
      });
    });
    return { success: true };
  } catch (e: unknown) {
    console.error("Error en Fase 2:", e);
    throw new Error(e instanceof Error ? e.message : "Error al procesar el fleje.");
  }
};

// FASE 3: REVERTIR REGISTRO
export const revertProductionLog = async (logId: string, userEmail: string) => {
  const logRef = doc(db, "production_logs", logId);
  const auditRef = doc(collection(db, "audit_logs"));

  try {
    const logSnap = await getDocs(
      query(collection(db, "production_logs"), where("__name__", "==", logId)),
    );
    if (logSnap.empty) throw new Error("El registro no existe.");
    const logDataForQuery = logSnap.docs[0].data();

    const recentLogsQuery = query(
      collection(db, "production_logs"),
      where("sku", "==", logDataForQuery.sku),
      where("status", "==", "ACTIVE"),
      orderBy("timestamp", "desc"),
      limit(2),
    );
    const recentLogsSnap = await getDocs(recentLogsQuery);

    let previousValidCost: number | null = null;
    recentLogsSnap.docs.forEach((docSnap) => {
      if (docSnap.id !== logId) {
        previousValidCost =
          docSnap.data().averageCostAfter || docSnap.data().costPerPiece || 0;
      }
    });

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
      let newQuantity = 0;

      if (stockDoc.exists()) {
        const stockData = stockDoc.data();
        newQuantity = stockData.totalQuantity - logData.piecesProduced;
        const newWeight = stockData.totalWeight - weightToSubtract;

        const stockUpdatePayload: {
          totalQuantity: number;
          totalWeight: number;
          lastUpdate: FieldValue;
          lastCostPerPiece?: number;
        } = {
          totalQuantity: newQuantity,
          totalWeight: newWeight,
          lastUpdate: serverTimestamp(),
        };

        if (previousValidCost !== null) {
          stockUpdatePayload.lastCostPerPiece = previousValidCost;
        } else if (newQuantity === 0) {
          stockUpdatePayload.lastCostPerPiece = 0;
        }

        transaction.update(stockRef, stockUpdatePayload);
      }

      const kardexRef = doc(collection(db, "kardex_movements"));
      transaction.set(kardexRef, {
        sku: logData.sku,
        date: serverTimestamp(),
        type: "OUT",
        quantity: logData.piecesProduced,
        balance: newQuantity,
        reference: logData.parentCoilId,
        description: "Anulación de Producción",
        user: userEmail,
      });

      if (coilDoc.exists()) {
        const coilData = coilDoc.data() as Coil;

        validateCoilData(coilData);

        const updatedStrips = coilData.plannedStrips?.map((strip) => {
          if (strip.sku === logData.sku) {
            return { ...strip, pendingCount: strip.pendingCount + 1 };
          }
          return strip;
        });

        const weightPerMm = coilData.initialWeight / coilData.masterWidth!;
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
  } catch (error: unknown) {
    console.error("Error revirtiendo registro:", error);
    throw new Error(error instanceof Error ? error.message : "Error al anular el registro.");
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
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : "Error desconocido al anular.");
  }
};

// EDITAR BOBINA MADRE
export const updateCoil = async (
  coilId: string,
  updates: CoilUpdates,
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

      const finalInvoiceDate = updates.invoiceDate
        ? new Date(`${updates.invoiceDate}T12:00:00`)
        : null;

      const updatePayload: Record<string, unknown> = {
        initialWeight: updates.initialWeight,
        currentWeight: updates.currentWeight,
        masterWidth: updates.masterWidth,
        thickness: updates.thickness,
        pricePerKg: updates.pricePerKg,
        "metadata.providerName": updates.providerName,
        "metadata.provider": updates.providerName,
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
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : "Error al editar.");
  }
};

// CANCELAR PLAN DE CORTE
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

      const hasProcessedStrips = coilData.plannedStrips?.some(
        (strip) => strip.initialCount !== strip.pendingCount,
      );

      if (hasProcessedStrips) {
        throw new Error(
          "⛔ IMPOSIBLE CANCELAR: Ya se han ejecutado cortes en esta bobina. Para cancelar, primero debes anular los cortes realizados desde el historial de producción.",
        );
      }

      transaction.update(coilRef, {
        status: "AVAILABLE",
        plannedStrips: [],
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
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : "Error al cancelar el plan.");
  }
};

export interface FetchProductionParams {
  pageSize: number;
  skuFilter: string;
  searchTerm: string;
  startDate: string;
  endDate: string;
  direction?: "first" | "next" | "prev";
  cursorDoc?: QueryDocumentSnapshot<DocumentData> | null;
  page?: number;
}

export const fetchProductionLogs = async (params: FetchProductionParams) => {
  const {
    pageSize,
    skuFilter,
    searchTerm,
    startDate,
    endDate,
    direction = "first",
    cursorDoc,
    page = 0,
  } = params;

  if (searchTerm && searchTerm.trim().length > 0) {
    let filters = skuFilter !== "ALL" ? `sku:${skuFilter}` : "";

    const {
      hits,
      nbPages,
      page: currentPage,
      nbHits,
    } = await algoliaClient.searchSingleIndex({
      indexName: ALGOLIA_INDICES.PRODUCTION || "production_logs_index",
      searchParams: { query: searchTerm, filters, hitsPerPage: pageSize, page },
    });

    const hitIds = (hits as Array<{ objectID: string }>).map((h) => h.objectID);
    let logs: ProductionLog[] = [];

    if (hitIds.length > 0) {
      const qDocs = query(
        collection(db, "production_logs"),
        where(documentId(), "in", hitIds),
      );
      const snap = await getDocs(qDocs);
      const firestoreDocs = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ProductionLog[];

      logs = hitIds
        .map((id) => firestoreDocs.find((d) => d.id === id))
        .filter(Boolean) as ProductionLog[];
    }

    return {
      logs,
      isAlgolia: true,
      algoliaData: { totalPages: nbPages, currentPage, nbHits },
      firstDoc: null,
      lastDoc: null,
      totalCount: nbHits,
    };
  }

  const collRef = collection(db, "production_logs");
  let baseConstraints: QueryConstraint[] = [];
  const hasDateFilter = !!startDate && !!endDate;

  if (skuFilter !== "ALL") {
    baseConstraints.push(where("sku", "==", skuFilter));
  }

  if (hasDateFilter) {
    baseConstraints.push(
      where("timestamp", ">=", new Date(`${startDate}T00:00:00`)),
    );
    baseConstraints.push(
      where("timestamp", "<=", new Date(`${endDate}T23:59:59`)),
    );
    baseConstraints.push(orderBy("timestamp", "desc"));
  } else {
    baseConstraints.push(orderBy("timestamp", "desc"));
  }

  const baseQuery = query(collRef, ...baseConstraints);
  const countSnapshot = await getCountFromServer(baseQuery);
  const totalCount = countSnapshot.data().count;

  let paginationConstraints = [...baseConstraints];
  if (direction === "next" && cursorDoc) {
    paginationConstraints.push(startAfter(cursorDoc));
    paginationConstraints.push(limit(pageSize));
  } else if (direction === "prev" && cursorDoc) {
    paginationConstraints.push(endBefore(cursorDoc));
    paginationConstraints.push(limitToLast(pageSize));
  } else {
    paginationConstraints.push(limit(pageSize));
  }

  const finalQuery = query(collRef, ...paginationConstraints);
  const snapshot = await getDocs(finalQuery);

  let logs = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ProductionLog[];

  return {
    logs,
    isAlgolia: false,
    firstDoc: snapshot.docs.length > 0 ? snapshot.docs[0] : null,
    lastDoc:
      snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
    totalCount,
  };
};
