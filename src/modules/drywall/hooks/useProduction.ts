"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/clientApp";
import { collection, query, onSnapshot } from "firebase/firestore";
import type { StockSummary } from "@/types";

export function useProduction() {
  const [stock, setStock] = useState<StockSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "inventory_stock"));
    const unsub = onSnapshot(q, (snapshot) => {
      setStock(
        snapshot.docs.map((doc) => ({ sku: doc.id, ...doc.data() }) as StockSummary),
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { stock, loading };
}
