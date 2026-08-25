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
import { buildCoilAlgoliaFilters } from "../coilAlgoliaFilters";
import { listFinishes } from "./finishService";

export interface CoilUpdates
  extends Pick<NonNullable<Coil["metadata"]>, "currency" | "exchangeRate" | "originalCurrencyValue"> {
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
    const filters = buildCoilAlgoliaFilters(
      { statusFilter, finishFilter, currencyFilter, providerFilter },
      "inventory",
    );

    const {
      hits,
      nbPages,
      page: currentPage,
      nbHits,
    } = await algoliaClient.searchSingleIndex({
      indexName: ALGOLIA_INDICES.COILS,
      searchParams: { query: searchTerm, filters, hitsPerPage: pageSize, page },
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

export interface CoilExportFilters {
  statusFilter: string;
  searchTerm?: string;
  finishFilter?: string;
  currencyFilter?: string;
  providerFilter?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Trae TODAS las bobinas que matchean los filtros de pantalla (sin `limit`, sin paginar).
 * A diferencia de `fetchInventory` (que arma la tabla en pantalla y excluye VOIDED cuando
 * statusFilter==="ALL"), acá VOIDED SÍ se incluye en "ALL" — el export debe mostrar el
 * inventario completo, la anulación se marca en la fila, no se esconde.
 */
export const fetchCoilsForExport = async (filters: CoilExportFilters): Promise<Coil[]> => {
  const {
    statusFilter,
    searchTerm = "",
    finishFilter,
    currencyFilter,
    providerFilter,
    startDate,
    endDate,
  } = filters;

  try {
    if (searchTerm.trim().length > 0) {
      const algoliaFilters = buildCoilAlgoliaFilters(
        { statusFilter, finishFilter, currencyFilter, providerFilter },
        "export",
      );

      const allHitIds: string[] = [];
      const hitsPerPage = 1000;
      let page = 0;
      let nbPages = 1;
      do {
        const { hits, nbPages: totalPages } = await algoliaClient.searchSingleIndex({
          indexName: ALGOLIA_INDICES.COILS,
          searchParams: { query: searchTerm, filters: algoliaFilters, hitsPerPage, page },
        });
        allHitIds.push(...(hits as Array<{ objectID: string }>).map((h) => h.objectID));
        nbPages = totalPages ?? 0;
        page++;
      } while (page < nbPages);

      if (allHitIds.length === 0) return [];

      const chunkSize = 30;
      const chunks: string[][] = [];
      for (let i = 0; i < allHitIds.length; i += chunkSize) {
        chunks.push(allHitIds.slice(i, i + chunkSize));
      }

      const snapshots = await Promise.all(
        chunks.map((chunk) =>
          getDocs(query(collection(db, "coils"), where(documentId(), "in", chunk))),
        ),
      );

      return snapshots.flatMap((snap) =>
        snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Coil[],
      );
    }

    const collRef = collection(db, "coils");
    const constraints: QueryConstraint[] = [];
    const hasDateFilter = !!startDate && !!endDate;
    // ALL: cero where de status -> robusto a cualquier status presente/futuro. finish/currency/provider
    // a cliente para no exigir indice compuesto inexistente.
    const isAllStatus = statusFilter === "ALL";

    if (!isAllStatus) {
      constraints.push(where("status", "==", statusFilter));
      if (finishFilter && finishFilter !== "ALL") {
        constraints.push(where("finish", "==", finishFilter));
      }
      if (currencyFilter && currencyFilter !== "ALL") {
        constraints.push(where("metadata.currency", "==", currencyFilter));
      }
      if (providerFilter && providerFilter.trim() !== "") {
        constraints.push(where("metadata.provider", "==", providerFilter.trim()));
      }
    }

    if (hasDateFilter) {
      constraints.push(where("metadata.invoiceDate", ">=", new Date(`${startDate}T00:00:00`)));
      constraints.push(where("metadata.invoiceDate", "<=", new Date(`${endDate}T23:59:59`)));
      constraints.push(orderBy("metadata.invoiceDate", "desc"));
    } else {
      constraints.push(orderBy("createdAt", "desc"));
    }

    const snapshot = await getDocs(query(collRef, ...constraints));
    let coils = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Coil[];

    if (isAllStatus) {
      if (finishFilter && finishFilter !== "ALL") {
        coils = coils.filter((c) => c.finish === finishFilter);
      }
      if (currencyFilter && currencyFilter !== "ALL") {
        coils = coils.filter((c) => c.metadata?.currency === currencyFilter);
      }
      if (providerFilter && providerFilter.trim() !== "") {
        coils = coils.filter((c) => c.metadata?.provider === providerFilter.trim());
      }
    }

    return coils;
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

export const reverseCoilSplit = async (childId: string) => {
  const callable = httpsCallable<{ childId: string }, { success: boolean, newMotherWeight: number, newMotherWidth: number, newMotherStatus: string }>(
    functions,
    "reverseCoilSplit"
  );
  try {
    const response = await callable({ childId });
    return response.data;
  } catch (error: any) {
    if (error?.code) {
      switch (error.code) {
        case "unauthenticated":
          throw new Error("Debes iniciar sesión para revertir splits.");
        case "permission-denied":
          throw new Error("Solo un administrador puede revertir splits.");
        case "not-found":
          throw new Error("La bobina especificada no existe.");
        case "failed-precondition":
          throw new Error(error.message || "No se puede revertir el split.");
        case "invalid-argument":
          throw new Error(error.message || "Datos inválidos.");
        default:
          throw new Error(error.message || "Error al revertir split.");
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

export const voidCoilScrap = async (scrapLogId: string) => {
  const callable = httpsCallable<{ scrapLogId: string }, { success: boolean }>(
    functions,
    "voidCoilScrap"
  );
  try {
    const response = await callable({ scrapLogId });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.message || "Error al anular la merma.");
  }
};

export const setCoilClosed = async (coilId: string, close: boolean, remnantAsMerma?: boolean) => {
  const callable = httpsCallable<{ coilId: string; close: boolean; remnantAsMerma?: boolean }, { success: boolean }>(
    functions,
    "setCoilClosed"
  );
  try {
    const response = await callable({ coilId, close, remnantAsMerma });
    return response.data;
  } catch (error: any) {
    if (error?.code) {
      switch (error.code) {
        case "unauthenticated":
          throw new Error("Debes iniciar sesión para cerrar/abrir bobinas.");
        case "permission-denied":
          throw new Error("Solo un administrador puede cerrar/abrir bobinas.");
        case "not-found":
          throw new Error("La bobina especificada no existe.");
        default:
          throw new Error(error.message || "Error al cerrar/abrir bobina.");
      }
    }
    throw new Error("Error interno del servidor.");
  }
};
