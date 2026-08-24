import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  where,
  getCountFromServer,
} from "firebase/firestore";

export interface AuditLog {
  id: string;
  action: string;
  entityId: string;
  userEmail: string;
  details: string;
  timestamp: any;
}

export interface FetchAuditParams {
  pageSize: number;
  searchTerm: string; // Buscará por correo del usuario
  actionFilter: string;
  startDate: string;
  endDate: string;
  direction?: "first" | "next" | "prev";
  cursorDoc?: any;
}

export const fetchAuditLogsPaginated = async (params: FetchAuditParams) => {
  const {
    pageSize,
    searchTerm,
    actionFilter,
    startDate,
    endDate,
    direction = "first",
    cursorDoc,
  } = params;

  try {
    const collRef = collection(db, "audit_logs");
    let baseConstraints: any[] = [];

    // 1. Filtro por Acción
    if (actionFilter !== "ALL") {
      baseConstraints.push(where("action", "==", actionFilter));
    }

    // 2. Filtro de Fechas
    if (startDate)
      baseConstraints.push(
        where("timestamp", ">=", new Date(`${startDate}T00:00:00`)),
      );
    if (endDate)
      baseConstraints.push(
        where("timestamp", "<=", new Date(`${endDate}T23:59:59`)),
      );

    // 3. Búsqueda por Email (Prefijo)
    if (searchTerm && searchTerm.trim().length > 0) {
      const term = searchTerm.trim().toLowerCase();
      baseConstraints.push(where("userEmail", ">=", term));
      baseConstraints.push(where("userEmail", "<=", term + "\uf8ff"));
      // Cuando usamos desigualdad (>=) en Firebase, el orderBy primario debe ser el mismo campo
      baseConstraints.push(orderBy("userEmail", "asc"));
      baseConstraints.push(orderBy("timestamp", "desc"));
    } else {
      baseConstraints.push(orderBy("timestamp", "desc"));
    }

    // 4. Conteo Total (Cuesta 1 sola lectura)
    const baseQuery = query(collRef, ...baseConstraints);
    const countSnapshot = await getCountFromServer(baseQuery);
    const totalCount = countSnapshot.data().count;

    // 5. Paginación Matemática
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

    const logs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AuditLog[];

    return {
      logs,
      firstDoc: snapshot.docs.length > 0 ? snapshot.docs[0] : null,
      lastDoc:
        snapshot.docs.length > 0
          ? snapshot.docs[snapshot.docs.length - 1]
          : null,
      totalCount,
    };
  } catch (error) {
    console.error("Error cargando auditoría:", error);
    throw new Error("No se pudo cargar el registro de auditoría.");
  }
};
