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
  sum,
  count,
} from "firebase/firestore";
import { ProductionLog } from "@/types";

export interface ExtendedLog extends ProductionLog {
  scrapWeightKg?: number;
}

export interface FetchYieldParams {
  pageSize: number;
  searchTerm: string;
  startDate: string;
  endDate: string;
  direction?: "first" | "next" | "prev";
  cursorDoc?: any;
}

export const getYieldReport = async (params: FetchYieldParams) => {
  const {
    pageSize,
    searchTerm,
    startDate,
    endDate,
    direction = "first",
    cursorDoc,
  } = params;

  try {
    const collRef = collection(db, "production_logs");
    let baseConstraints: any[] = [];

    // 1. FILTROS BASE
    if (startDate)
      baseConstraints.push(
        where("timestamp", ">=", new Date(`${startDate}T00:00:00`)),
      );
    if (endDate)
      baseConstraints.push(
        where("timestamp", "<=", new Date(`${endDate}T23:59:59`)),
      );
    if (searchTerm)
      baseConstraints.push(
        where("parentCoilId", "==", searchTerm.trim().toUpperCase()),
      );

    // 2. CÁLCULO DE KPIs CON AGREGACIONES EN EL SERVIDOR (1 sola lectura de BD)
    const kpiQuery = query(collRef, ...baseConstraints);
    const aggregateSnapshot = await getAggregateFromServer(kpiQuery, {
      totalOps: count(),
      totalUsedWidth: sum("totalUsedWidth"),
      totalScrapWidth: sum("scrapWidth"),
    });

    const aggregates = aggregateSnapshot.data();
    const usedMm = aggregates.totalUsedWidth || 0;
    const scrapMm = aggregates.totalScrapWidth || 0;
    const totalMm = usedMm + scrapMm;
    const avgEfficiency = totalMm > 0 ? (usedMm / totalMm) * 100 : 0;
    const totalScrapKg = scrapMm * 0.85;

    // 3. OBTENER SOLO LOS REGISTROS PARA LA TABLA (Paginación Real)
    baseConstraints.push(orderBy("timestamp", "desc"));
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

    const logs = snap.docs.map((doc) => {
      const data = doc.data();
      const scrapKg = (data.scrapWidth || 0) * 0.85;
      return { id: doc.id, ...data, scrapWeightKg: scrapKg } as ExtendedLog;
    });

    return {
      logs,
      stats: {
        totalUsedMm: usedMm,
        totalScrapMm: Number(scrapMm.toFixed(2)),
        totalScrapKg: Number(totalScrapKg.toFixed(2)),
        avgEfficiency,
        totalOps: aggregates.totalOps,
      },
      firstDoc: snap.docs.length > 0 ? snap.docs[0] : null,
      lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    };
  } catch (error) {
    console.error("Error generando reporte:", error);
    throw new Error("No se pudo cargar el reporte de rendimiento.");
  }
};

// NUEVO: Función exclusiva para descargar Excel masivo (Sin paginación)
export const fetchAllYieldForExport = async (
  startDate: string,
  endDate: string,
  searchTerm: string,
) => {
  const collRef = collection(db, "production_logs");
  let baseConstraints: any[] = [];

  if (startDate)
    baseConstraints.push(
      where("timestamp", ">=", new Date(`${startDate}T00:00:00`)),
    );
  if (endDate)
    baseConstraints.push(
      where("timestamp", "<=", new Date(`${endDate}T23:59:59`)),
    );
  if (searchTerm)
    baseConstraints.push(
      where("parentCoilId", "==", searchTerm.trim().toUpperCase()),
    );

  baseConstraints.push(orderBy("timestamp", "desc"));

  const snap = await getDocs(query(collRef, ...baseConstraints));

  return snap.docs.map((doc) => {
    const data = doc.data();
    const scrapKg = (data.scrapWidth || 0) * 0.85;
    return { id: doc.id, ...data, scrapWeightKg: scrapKg } as ExtendedLog;
  });
};
