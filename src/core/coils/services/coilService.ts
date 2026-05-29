import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  documentId,
  getCountFromServer,
  QueryConstraint,
  QueryDocumentSnapshot,
  DocumentData,
  FieldValue,
} from "firebase/firestore";
import { Coil, BusinessLine } from "@/types";
import { algoliaClient, ALGOLIA_INDICES } from "@/lib/algoliaClient";
import { listFinishes } from "./finishService";

export interface CoilUpdates {
  initialWeight: number;
  currentWeight: number;
  masterWidth: number;
  thickness: number;
  finish: string;
  pricePerKg: number;
  providerDocType: "LOCAL" | "TAX_ID";
  providerDoc: string;
  providerName: string;
  invoiceNumber: string;
  invoiceDate?: string;
}

interface FetchParams {
  pageSize: number;
  statusFilter: string;
  searchTerm: string;
  startDate?: string;
  endDate?: string;
  finishFilter?: string; // Nuevo filtro por acabado
  cursorDoc?: QueryDocumentSnapshot<DocumentData> | null;
  direction?: "next" | "prev" | "first";
  page?: number;
}

export const fetchInventory = async (params: FetchParams) => {
  const {
    pageSize,
    statusFilter,
    searchTerm,
    startDate,
    endDate,
    finishFilter,
    cursorDoc,
    direction = "first",
    page = 0,
  } = params;

  if (searchTerm.trim().length > 0) {
    let filters = [];
    if (statusFilter !== "ALL") filters.push(`status:${statusFilter}`);
    else filters.push(`NOT status:VOIDED`);
    
    if (finishFilter && finishFilter !== "ALL") {
      filters.push(`finish:${finishFilter}`);
    }

    const {
      hits,
      nbPages,
      page: currentPage,
      nbHits,
    } = await algoliaClient.searchSingleIndex({
      indexName: ALGOLIA_INDICES.COILS,
      searchParams: { query: searchTerm, filters: filters.join(' AND '), hitsPerPage: pageSize, page },
    });

    const hitIds = (hits as Array<{ objectID: string }>).map((h) => h.objectID);
    let coils: Coil[] = [];

    if (hitIds.length > 0) {
      const qDocs = query(
        collection(db, "coils"),
        where(documentId(), "in", hitIds),
      );
      const snap = await getDocs(qDocs);
      const firestoreDocs = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Coil[];

      coils = hitIds
        .map((id) => firestoreDocs.find((d) => d.id === id))
        .filter(Boolean) as Coil[];
    }

    return {
      coils,
      isAlgolia: true,
      algoliaData: { totalPages: nbPages, currentPage, nbHits },
      firstDoc: null,
      lastDoc: null,
      totalCount: nbHits,
    };
  }

  const collRef = collection(db, "coils");
  let baseConstraints: QueryConstraint[] = [];
  const hasDateFilter = !!startDate && !!endDate;

  if (statusFilter === "ALL") {
    if (!hasDateFilter) {
      baseConstraints.push(
        where("status", "in", ["AVAILABLE", "IN_PROGRESS", "PROCESSED"]),
      );
    }
  } else {
    baseConstraints.push(where("status", "==", statusFilter));
  }

  if (finishFilter && finishFilter !== "ALL") {
    baseConstraints.push(where("finish", "==", finishFilter));
  }

  if (hasDateFilter) {
    baseConstraints.push(
      where("metadata.invoiceDate", ">=", new Date(`${startDate}T00:00:00`)),
    );
    baseConstraints.push(
      where("metadata.invoiceDate", "<=", new Date(`${endDate}T23:59:59`)),
    );
    baseConstraints.push(orderBy("metadata.invoiceDate", "desc"));
  } else {
    baseConstraints.push(orderBy("createdAt", "desc"));
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

  const q = query(collRef, ...paginationConstraints);
  const snapshot = await getDocs(q);

  let coils = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Coil[];

  if (statusFilter === "ALL" && hasDateFilter) {
    coils = coils.filter((c) => c.status !== "VOIDED");
  }

  return {
    coils,
    isAlgolia: false,
    firstDoc: snapshot.docs.length > 0 ? snapshot.docs[0] : null,
    lastDoc:
      snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
    totalCount,
  };
};

export const fetchAvailableCoilsForExport = async (): Promise<Coil[]> => {
  try {
    const collRef = collection(db, "coils");
    const exportQuery = query(
      collRef,
      where("status", "==", "AVAILABLE"),
      orderBy("createdAt", "desc"),
    );

    const snapshot = await getDocs(exportQuery);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Coil[];
  } catch (error) {
    console.error("Error obteniendo bobinas para exportar:", error);
    throw new Error("No se pudo generar la data para el Excel.");
  }
};

export const listAvailableCoils = async (line: BusinessLine) => {
  const finishes = await listFinishes(true);
  const compatibleFinishIds = finishes
    .filter((f) => f.lines.includes(line))
    .map((f) => f.id);

  if (compatibleFinishIds.length === 0) return [];

  const collRef = collection(db, "coils");
  const q = query(
    collRef,
    where("status", "==", "AVAILABLE"),
    where("currentWeight", ">", 0),
    where("finish", "in", compatibleFinishIds.slice(0, 30)), // Firestore limit
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Coil);
};

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
        finish: updates.finish,
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
        details: `Editó bobina: Peso ${updates.initialWeight}kg, Espesor ${updates.thickness}mm, Acabado ${updates.finish}, Valor /Kg S/ ${updates.pricePerKg}.`,
        timestamp: serverTimestamp(),
      });
    });
    return { success: true };
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : "Error al editar.");
  }
};

export const cancelCoilPlan = async (coilId: string, userEmail: string) => {
  const coilRef = doc(db, "coils", coilId);
  const auditRef = doc(collection(db, "audit_logs"));

  try {
    await runTransaction(db, async (transaction) => {
      const coilDoc = await transaction.get(coilRef);
      if (!coilDoc.exists()) throw new Error("La bobina no existe.");

      const coilData = coilDoc.data() as Coil;

      if (coilData.status !== "IN_PROGRESS") {
        throw new Error("Solo se pueden cancelar planes de bobinas EN PROCESO.");
      }

      // Validar si ya se procesó algún fleje (lógica genérica para plannedStrips)
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
        details: `Canceló plan de corte/producción. Bobina devuelta a DISPONIBLE de forma segura.`,
        timestamp: serverTimestamp(),
      });
    });
    return { success: true };
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : "Error al cancelar el plan.");
  }
};

