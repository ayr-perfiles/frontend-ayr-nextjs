import { db, functions } from "@/lib/firebase/clientApp";
import { httpsCallable } from "firebase/functions";
import {
  doc,
  runTransaction,
  serverTimestamp,
  collection,
  getDoc,
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
import { Coil, ProductionLog, StripStock } from "@/types";
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

export const saveCuttingPlan = async (
  coilId: string,
  items: { sku: string; quantity: number }[],
) => {
  const coilRef = doc(db, "coils", coilId);

  try {
    await runTransaction(db, async (transaction) => {
      // 1. LECTURAS INICIALES
      const coilDoc = await transaction.get(coilRef);
      if (!coilDoc.exists()) throw new Error("La bobina no existe.");

      const prodSnaps: Record<string, any> = {};
      for (const item of items) {
        const prodRef = doc(db, "products", item.sku);
        prodSnaps[item.sku] = await transaction.get(prodRef);
      }

      const coil = coilDoc.data() as Coil;
      validateCoilData(coil);

      const planItems: PlanItem[] = items.map((item) => {
        const prodDoc = prodSnaps[item.sku];
        if (!prodDoc.exists()) throw new Error(`Producto ${item.sku} no existe.`);
        const prodData = prodDoc.data();
        return {
          sku: item.sku,
          quantity: item.quantity,
          stripWidth: prodData.stripWidth ?? 0,
        };
      });

      const totalCoilCost = coil.initialWeight * coil.pricePerKg;
      const { plannedStrips } = calculateCuttingPlan({
        totalCoilCost,
        masterWidth: coil.masterWidth!,
        items: planItems,
      });

      // 2. ESCRITURAS
      transaction.update(coilRef, {
        plannedStrips: plannedStrips,
        status: "IN_PROGRESS",
        updatedAt: serverTimestamp(),
      });
    });
    return { success: true };
  } catch (error: unknown) {
    console.error("Error en saveCuttingPlan:", error);
    throw new Error(error instanceof Error ? error.message : "Error al guardar plan");
  }
};

import { consumeCoil } from "@/core/coils/services/coilConsumptionService";

// @deprecated Use produceFromStrip for Drywall instead.
export const processSingleStrip = async (
  coilId: string,
  sku: string,
  pieces: number,
  operatorId: string,
) => {
  const coilRef = doc(db, "coils", coilId);
  const prodRef = doc(db, "products", sku);

  try {
    const coilSnap = await getDoc(coilRef);
    const prodSnap = await getDoc(prodRef);

    if (!coilSnap.exists() || !prodSnap.exists()) throw new Error("Data no encontrada");

    const coil = coilSnap.data() as Coil;
    const product = prodSnap.data();

    let densityFactor: number | undefined;
    if (coil.finish) {
      const finishRef = doc(db, "coil_finishes", coil.finish);
      const finishSnap = await getDoc(finishRef);
      if (finishSnap.exists()) {
        densityFactor = finishSnap.data().densityFactor;
      }
    }

    if (!densityFactor) {
      throw new Error(`La bobina no tiene factor de densidad configurado (Acabado: ${coil.finish || 'Ninguno'}). Imposible validar límite de producción.`);
    }

    const stripIndex = coil.plannedStrips?.findIndex(s => s.sku === sku && s.pendingCount > 0);
    if (stripIndex === undefined || stripIndex === -1) throw new Error("No hay flejes disponibles");

    const activeStrip = coil.plannedStrips![stripIndex];
    validateCoilData(coil);

    const weightPerMm = coil.initialWeight / coil.masterWidth!;
    const theoreticalStripWeight = activeStrip.width * weightPerMm;
    const pieceLength = product.lengthMeters || DEFAULT_PIECE_LENGTH_M;

    validateProductionInput({
      requestedPieces: pieces,
      stripWeight: theoreticalStripWeight,
      stripWidth: activeStrip.width,
      thickness: coil.thickness || 0,
      pieceLength,
      densityFactor,
    });

    const standardWeight = product.standardWeight || 0;
    const reportedWeight = pieces * standardWeight;

    const stockRef = doc(db, "inventory_stock", sku);
    const stockDoc = await getDoc(stockRef);
    const currentQty = stockDoc.exists() ? stockDoc.data().totalQuantity || 0 : 0;
    const currentAvgCost = stockDoc.exists() ? stockDoc.data().lastCostPerPiece || 0 : 0;

    const newAverageCost = calculateWeightedAverageCost({
      currentQty,
      currentAverageCost: currentAvgCost,
      batchTotalCost: activeStrip.costPerStrip,
      newPieces: pieces,
    });

    const scrapPerStrip = calculateScrapPerStrip(coil.masterWidth!, coil.plannedStrips!);

    const updatedStrips = [...coil.plannedStrips!];
    updatedStrips[stripIndex].pendingCount -= 1;
    const totalPending = updatedStrips.reduce((sum, s) => sum + s.pendingCount, 0);

    await consumeCoil({
      coilId,
      line: 'drywall',
      sku,
      pieces,
      weightConsumed: theoreticalStripWeight,
      operatorId,
      additionalLogData: {
        totalUsedWidth: activeStrip.width,
        scrapWidth: Number(scrapPerStrip.toFixed(2)),
        stripCost: activeStrip.costPerStrip,
        costPerPiece: Number((activeStrip.costPerStrip / pieces).toFixed(6)),
        averageCostAfter: Number(newAverageCost.toFixed(6)),
        reportedWeight,
      },
      additionalCoilUpdates: {
        plannedStrips: updatedStrips,
        status: totalPending === 0 ? "PROCESSED" : "IN_PROGRESS",
      },
      additionalStockParams: {
        newAverageCost,
        newWeight: reportedWeight,
      }
    });

    return { success: true };
  } catch (e: unknown) {
    console.error("Error en processSingleStrip:", e);
    throw new Error(e instanceof Error ? e.message : "Error al procesar fleje.");
  }
};

const errorMap: Record<string, string> = {
  'unauthenticated': 'Debe iniciar sesión para registrar producción.',
  'permission-denied': 'No tiene permisos para registrar producción.',
  'not-found': 'Un recurso necesario no existe (ej. producto o stock).',
  'failed-precondition': 'Requisito incumplido (ej. falta de stock o configuración incompleta).',
  'invalid-argument': 'Parámetros inválidos.',
};

export const produceFromStrip = async (params: {
  sku: string;
  pieces: number;
  stripsUsed: number;
  requestId: string;
}) => {
  const { sku, pieces, stripsUsed, requestId } = params;

  try {
    const produceCallable = httpsCallable<{
      sku: string;
      pieces: number;
      stripsUsed: number;
      requestId: string;
    }, {
      success: boolean;
      hasNegativeCoilWarning: boolean;
      cantidadProducida: number;
      costoUnitarioPEN: number;
    }>(functions, "produceFromStrip");

    const result = await produceCallable({
      sku,
      pieces,
      stripsUsed,
      requestId,
    });

    return result.data;
  } catch (error: any) {
    if (error.code && typeof error.code === 'string') {
      const fbCode = error.code.replace('functions/', '');
      throw new Error(error.message || errorMap[fbCode] || 'Error al registrar producción.');
    }
    throw error;
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

      if (coilData.status !== "IN_PROGRESS") throw new Error("No en proceso.");
      if (coilData.plannedStrips?.some(s => s.initialCount !== s.pendingCount)) throw new Error("Cortes ya ejecutados.");

      transaction.update(coilRef, { status: "AVAILABLE", plannedStrips: [], updatedAt: serverTimestamp() });
      transaction.set(auditRef, {
        action: "CANCEL_CUTTING_PLAN",
        entityId: coilId,
        userEmail,
        details: `Canceló plan de corte.`,
        timestamp: serverTimestamp()
      });
    });
    return { success: true };
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : "Error al cancelar.");
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
  const { pageSize, skuFilter, searchTerm, startDate, endDate, direction = "first", cursorDoc, page = 0 } = params;

  if (searchTerm && searchTerm.trim().length > 0) {
    const { hits, nbPages, page: currentPage, nbHits } = await algoliaClient.searchSingleIndex({
      indexName: ALGOLIA_INDICES.PRODUCTION || "production_logs_index",
      searchParams: { query: searchTerm, filters: skuFilter !== "ALL" ? `sku:${skuFilter}` : "", hitsPerPage: pageSize, page },
    });
    const hitIds = (hits as Array<{ objectID: string }>).map(h => h.objectID);
    if (hitIds.length === 0) return { logs: [], isAlgolia: true, algoliaData: { totalPages: 0, currentPage: 0, nbHits: 0 }, totalCount: 0 };
    const snap = await getDocs(query(collection(db, "production_logs"), where(documentId(), "in", hitIds)));
    const fDocs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ProductionLog[];
    const logs = hitIds.map(id => fDocs.find(d => d.id === id)).filter(Boolean) as ProductionLog[];
    return { logs, isAlgolia: true, algoliaData: { totalPages: nbPages, currentPage, nbHits }, totalCount: nbHits };
  }

  const collRef = collection(db, "production_logs");
  let baseConstraints: QueryConstraint[] = [where("line", "==", "drywall")];
  if (skuFilter !== "ALL") baseConstraints.push(where("sku", "==", skuFilter));
  if (startDate && endDate) {
    baseConstraints.push(where("timestamp", ">=", new Date(`${startDate}T00:00:00`)));
    baseConstraints.push(where("timestamp", "<=", new Date(`${endDate}T23:59:59`)));
  }
  baseConstraints.push(orderBy("timestamp", "desc"));
  const countSnapshot = await getCountFromServer(query(collRef, ...baseConstraints));
  const totalCount = countSnapshot.data().count;

  let pConstraints = [...baseConstraints];
  if (direction === "next" && cursorDoc) pConstraints.push(startAfter(cursorDoc), limit(pageSize));
  else if (direction === "prev" && cursorDoc) pConstraints.push(endBefore(cursorDoc), limitToLast(pageSize));
  else pConstraints.push(limit(pageSize));

  const snapshot = await getDocs(query(collRef, ...pConstraints));
  const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ProductionLog[];
  return { logs, isAlgolia: false, firstDoc: snapshot.docs[0] || null, lastDoc: snapshot.docs[snapshot.docs.length - 1] || null, totalCount };
};
