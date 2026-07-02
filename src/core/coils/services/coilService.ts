import { db, functions } from "@/lib/firebase/clientApp";
import {
  collection,
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
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
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
  finishFilter?: string;
  currencyFilter?: string;
  providerFilter?: string;
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
    currencyFilter,
    providerFilter,
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

    if (currencyFilter && currencyFilter !== "ALL") {
      filters.push(`metadata.currency:${currencyFilter}`);
    }

    if (providerFilter && providerFilter.trim() !== "") {
      filters.push(`metadata.provider:${providerFilter}`);
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
        where("status", "in", ["AVAILABLE", "IN_PROGRESS", "PROCESSED", "EN_TERCERO"]),
      );
    }
  } else {
    baseConstraints.push(where("status", "==", statusFilter));
  }

  if (finishFilter && finishFilter !== "ALL") {
    baseConstraints.push(where("finish", "==", finishFilter));
  }

  if (currencyFilter && currencyFilter !== "ALL") {
    baseConstraints.push(where("metadata.currency", "==", currencyFilter));
  }

  if (providerFilter && providerFilter.trim() !== "") {
    baseConstraints.push(where("metadata.provider", "==", providerFilter.trim()));
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

export const voidCoil = async (coilId: string, _userEmail: string) => {
  const callable = httpsCallable<{ coilId: string }, { success: boolean }>(
    functions,
    "voidCoil"
  );
  try {
    const response = await callable({ coilId });
    return response.data;
  } catch (error: any) {
    if (error?.code) {
      switch (error.code) {
        case "unauthenticated":
          throw new Error("Debes iniciar sesión para anular bobinas.");
        case "permission-denied":
          throw new Error("Solo un administrador o supervisor puede anular bobinas.");
        case "not-found":
          throw new Error("La bobina especificada no existe.");
        case "failed-precondition":
          throw new Error(error.message || "Solo se pueden anular bobinas DISPONIBLES.");
        case "invalid-argument":
          throw new Error(error.message || "Datos inválidos.");
        default:
          throw new Error(error.message || "Error al anular bobina.");
      }
    }
    throw new Error("Error interno del servidor.");
  }
};

export const deleteCoilDraft = async (coilId: string) => {
  const callable = httpsCallable<{ coilId: string }, { success: boolean }>(
    functions,
    "deleteCoilDraft"
  );
  try {
    const response = await callable({ coilId });
    return response.data;
  } catch (error: any) {
    if (error?.code) {
      switch (error.code) {
        case "unauthenticated":
          throw new Error("Debes iniciar sesión para eliminar bobinas.");
        case "permission-denied":
          throw new Error("Solo un administrador puede eliminar bobinas.");
        case "not-found":
          throw new Error("La bobina especificada no existe.");
        case "failed-precondition":
          throw new Error(error.message || "La bobina tiene movimientos y no puede ser eliminada.");
        case "invalid-argument":
          throw new Error(error.message || "Datos inválidos.");
        default:
          throw new Error(error.message || "Error al eliminar bobina.");
      }
    }
    throw new Error("Error interno del servidor.");
  }
};

export const updateCoil = async (
  coilId: string,
  updates: CoilUpdates,
  _userEmail: string
) => {
  const callable = httpsCallable<{ coilId: string; updates: CoilUpdates }, { success: boolean }>(
    functions,
    "updateCoil"
  );
  try {
    const response = await callable({ coilId, updates });
    return response.data;
  } catch (error: any) {
    if (error?.code) {
      switch (error.code) {
        case "unauthenticated":
          throw new Error("Debes iniciar sesión para editar bobinas.");
        case "permission-denied":
          throw new Error("Solo un administrador o supervisor puede editar bobinas.");
        case "not-found":
          throw new Error("La bobina especificada no existe.");
        case "failed-precondition":
          throw new Error(error.message || "Solo puedes editar bobinas DISPONIBLES.");
        case "invalid-argument":
          throw new Error(error.message || "Datos inválidos.");
        default:
          throw new Error(error.message || "Error al editar bobina.");
      }
    }
    throw new Error("Error de red o de servidor al editar la bobina.");
  }
};

export const cancelCoilPlan = async (coilId: string, _userEmail: string) => {
  const callable = httpsCallable<{ coilId: string }, { success: boolean }>(
    functions,
    "cancelCoilPlan"
  );
  try {
    const response = await callable({ coilId });
    return response.data;
  } catch (error: any) {
    if (error?.code) {
      switch (error.code) {
        case "unauthenticated":
          throw new Error("Debes iniciar sesión para cancelar planes.");
        case "permission-denied":
          throw new Error("Solo un administrador o supervisor puede cancelar planes.");
        case "not-found":
          throw new Error("La bobina especificada no existe.");
        case "failed-precondition":
          throw new Error(error.message || "Solo se pueden cancelar planes de bobinas EN PROCESO.");
        case "invalid-argument":
          throw new Error(error.message || "Datos inválidos.");
        default:
          throw new Error(error.message || "Error al cancelar plan.");
      }
    }
    throw new Error("Error de red o de servidor al cancelar el plan.");
  }
};
