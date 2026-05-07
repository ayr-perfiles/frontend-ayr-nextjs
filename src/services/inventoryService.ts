import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  endBefore,
  getDocs,
  limitToLast,
  documentId,
  getCountFromServer,
} from "firebase/firestore";
import { algoliaClient, ALGOLIA_INDICES } from "@/lib/algoliaClient";
import { Coil } from "@/types";

interface FetchParams {
  pageSize: number;
  statusFilter: string;
  searchTerm: string;
  startDate?: string;
  endDate?: string;
  cursorDoc?: any;
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
    cursorDoc,
    direction = "first",
    page = 0,
  } = params;

  // ==========================================
  // MOTOR 1: ALGOLIA (Con Hidratación de Firebase)
  // ==========================================
  if (searchTerm.trim().length > 0) {
    let filters =
      statusFilter !== "ALL" ? `status:${statusFilter}` : `NOT status:VOIDED`;

    const {
      hits,
      nbPages,
      page: currentPage,
      nbHits, // <-- EXTRAEMOS EL TOTAL DE RESULTADOS DE ALGOLIA
    } = await algoliaClient.searchSingleIndex({
      indexName: ALGOLIA_INDICES.COILS,
      searchParams: { query: searchTerm, filters, hitsPerPage: pageSize, page },
    });

    const hitIds = hits.map((h: any) => h.objectID);
    let coils: Coil[] = [];

    // HIPER-TRUCO: Usamos los IDs de Algolia para traer los datos puros y reales de Firebase
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

      // Los reordenamos para mantener la relevancia exacta de búsqueda que nos dio Algolia
      coils = hitIds
        .map((id) => firestoreDocs.find((d) => d.id === id))
        .filter(Boolean) as Coil[];
    }

    return {
      coils,
      isAlgolia: true,
      algoliaData: { totalPages: nbPages, currentPage, nbHits }, // <-- PASAMOS nbHits AL FRONTEND
      firstDoc: null,
      lastDoc: null,
      totalCount: nbHits, // <-- ESTANDARIZAMOS EL TOTAL PARA EL FRONTEND
    };
  }

  // ==========================================
  // MOTOR 2: FIRESTORE (Navegación y Filtro de Fechas)
  // ==========================================
  const collRef = collection(db, "coils");

  // 1. ARMAMOS LOS FILTROS BASE
  let baseConstraints: any[] = [];
  const hasDateFilter = !!startDate && !!endDate; // Solo aplica si ambas existen

  if (statusFilter === "ALL") {
    // 🔥 PREVENCIÓN DE CRASH FIREBASE:
    // Firebase no permite combinar "in" con filtros de rango (fechas >= <=).
    // Si hay fechas, quitamos el "in" temporalmente para que no explote.
    if (!hasDateFilter) {
      baseConstraints.push(
        where("status", "in", ["AVAILABLE", "IN_PROGRESS", "PROCESSED"]),
      );
    }
  } else {
    baseConstraints.push(where("status", "==", statusFilter));
  }

  // 2. APLICAMOS EL FILTRO DE FECHAS
  if (hasDateFilter) {
    baseConstraints.push(
      where("metadata.invoiceDate", ">=", new Date(`${startDate}T00:00:00`)),
    );
    baseConstraints.push(
      where("metadata.invoiceDate", "<=", new Date(`${endDate}T23:59:59`)),
    );
    baseConstraints.push(orderBy("metadata.invoiceDate", "desc"));
  } else {
    // Orden lógico si no hay filtro de fechas
    baseConstraints.push(orderBy("createdAt", "desc"));
  }

  // 3. CONTAMOS EL TOTAL REAL EN LA BASE DE DATOS
  const baseQuery = query(collRef, ...baseConstraints);
  const countSnapshot = await getCountFromServer(baseQuery);
  const totalCount = countSnapshot.data().count;

  // 4. APLICAMOS LA LÓGICA DE CURSORES Y LÍMITES
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

  // 5. EJECUTAMOS LA CONSULTA FINAL PAGINADA
  const q = query(collRef, ...paginationConstraints);
  const snapshot = await getDocs(q);

  let coils = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Coil[];

  // 6. FILTRO LOCAL DE ANULADOS
  // Ocultamos las anuladas localmente ya que tuvimos que quitar la regla a Firebase
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
