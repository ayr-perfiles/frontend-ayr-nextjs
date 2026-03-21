import { db } from "@/lib/firebase/clientApp";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";

export interface AuditLog {
  id: string;
  action: string;
  entityId: string;
  userEmail: string;
  details: string;
  timestamp: any;
}

/**
 * Obtiene los registros de auditoría ordenados por fecha (más recientes primero).
 * Limitamos a 200 para no sobrecargar la lectura de base de datos.
 */
export const getAuditLogs = async (limitCount = 200): Promise<AuditLog[]> => {
  try {
    const q = query(
      collection(db, "audit_logs"),
      orderBy("timestamp", "desc"),
      limit(limitCount),
    );

    const snap = await getDocs(q);
    return snap.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as AuditLog,
    );
  } catch (error) {
    console.error("Error obteniendo logs de auditoría:", error);
    return [];
  }
};
