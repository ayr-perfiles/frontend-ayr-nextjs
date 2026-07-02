import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/clientApp";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";

export interface ScrapLog {
  id: string;
  coilId: string;
  scrapWeightKg: number;
  scrapCostPEN: number;
  reason: string;
  adminId: string;
  timestamp: Timestamp | null;
  status?: string;
  isVoided: boolean;
}

export function useCoilScraps(coilId: string | undefined) {
  const [scraps, setScraps] = useState<ScrapLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScraps = async () => {
    if (!coilId) return;
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, "scrap_logs"),
        where("coilId", "==", coilId)
      );
      const snap = await getDocs(q);
      const results: ScrapLog[] = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          coilId: data.coilId,
          scrapWeightKg: data.scrapWeightKg || 0,
          scrapCostPEN: data.scrapCostPEN || 0,
          reason: data.reason || "",
          adminId: data.adminId || "",
          timestamp: data.timestamp || null,
          status: data.status,
          isVoided: data.status === "VOIDED",
        };
      });

      // Ordenar en memoria (timestamp DESC) para evitar índices compuestos
      results.sort((a, b) => {
        const tA = a.timestamp?.toMillis() || 0;
        const tB = b.timestamp?.toMillis() || 0;
        return tB - tA;
      });

      setScraps(results);
    } catch (err: any) {
      console.error("Error fetching scrap_logs:", err);
      setError("Error al cargar las mermas: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScraps();
  }, [coilId]);

  return { scraps, loading, error, refresh: fetchScraps };
}
