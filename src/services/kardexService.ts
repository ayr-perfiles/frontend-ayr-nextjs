import { db } from "@/lib/firebase/clientApp";
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
  getAggregateFromServer,
  count,
} from "firebase/firestore";

export interface KardexMovement {
  id: string;
  sku: string;
  date: Date;
  type: "IN" | "OUT" | "SCRAP";
  quantity: number;
  balance: number;
  reference: string;
  description: string;
  user: string;
}

export interface FetchKardexParams {
  sku: string;
  pageSize: number;
  startDate: string;
  endDate: string;
  direction?: "first" | "next" | "prev";
  cursorDoc?: any;
}

export const fetchKardexPaginated = async (params: FetchKardexParams) => {
  const {
    sku,
    pageSize,
    startDate,
    endDate,
    direction = "first",
    cursorDoc,
  } = params;

  try {
    const collRef = collection(db, "kardex_movements");
    let baseConstraints: any[] = [where("sku", "==", sku)];

    if (startDate)
      baseConstraints.push(
        where("date", ">=", new Date(`${startDate}T00:00:00`)),
      );
    if (endDate)
      baseConstraints.push(
        where("date", "<=", new Date(`${endDate}T23:59:59`)),
      );

    // CONTAR TOTALES (Agregación de Servidor, cuesta 1 sola lectura)
    const countQuery = query(collRef, ...baseConstraints);
    const aggregateSnapshot = await getAggregateFromServer(countQuery, {
      total: count(),
    });
    const totalCount = aggregateSnapshot.data().total;

    // PAGINACIÓN LIMITADA
    baseConstraints.push(orderBy("date", "desc"));
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

    const tableQuery = query(collRef, ...paginationConstraints);
    const snap = await getDocs(tableQuery);

    const movements = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate() || new Date(),
      } as KardexMovement;
    });

    return {
      movements,
      totalCount,
      firstDoc: snap.docs.length > 0 ? snap.docs[0] : null,
      lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    };
  } catch (error) {
    console.error("Error cargando Kardex Unificado:", error);
    throw new Error("No se pudo cargar el historial.");
  }
};

// Función exclusiva para descargar Excel masivo (Sin paginación)
export const fetchAllKardexForExport = async (
  sku: string,
  startDate: string,
  endDate: string,
) => {
  const collRef = collection(db, "kardex_movements");
  let constraints: any[] = [where("sku", "==", sku)];
  if (startDate)
    constraints.push(where("date", ">=", new Date(`${startDate}T00:00:00`)));
  if (endDate)
    constraints.push(where("date", "<=", new Date(`${endDate}T23:59:59`)));
  constraints.push(orderBy("date", "desc"));

  const snap = await getDocs(query(collRef, ...constraints));
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      date: data.date?.toDate() || new Date(),
    } as KardexMovement;
  });
};
