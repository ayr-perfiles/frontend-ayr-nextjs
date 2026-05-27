"use client";

import { useState, useEffect } from "react";
import { collection, query, onSnapshot, where, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";
import type { Sale, StockSummary, Coil } from "@/types";

interface DashboardKpis {
  totalSales: number;
  totalProfit: number;
  inventoryValue: number;
  activeCoils: number;
}

export function useDashboard() {
  const [kpis, setKpis] = useState<DashboardKpis>({
    totalSales: 0,
    totalProfit: 0,
    inventoryValue: 0,
    activeCoils: 0,
  });
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [activeCoilsList, setActiveCoilsList] = useState<Coil[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubStock = onSnapshot(query(collection(db, "inventory_stock")), (snap) => {
      let invValue = 0;
      snap.docs.forEach((doc) => {
        const data = doc.data() as StockSummary;
        invValue += data.totalQuantity * (data.lastCostPerPiece || 0);
      });
      setKpis((prev) => ({ ...prev, inventoryValue: invValue }));
    });

    const unsubSales = onSnapshot(
      query(collection(db, "sales"), where("status", "==", "COMPLETED")),
      (snap) => {
        let salesSum = 0;
        let profitSum = 0;
        snap.docs.forEach((doc) => {
          const data = doc.data() as Sale;
          salesSum += data.totalAmount;
          profitSum += data.totalProfit || 0;
        });
        setKpis((prev) => ({ ...prev, totalSales: salesSum, totalProfit: profitSum }));
      },
    );

    const unsubCoils = onSnapshot(
      query(collection(db, "coils"), where("status", "in", ["AVAILABLE", "IN_PROGRESS"])),
      (snap) => {
        setKpis((prev) => ({ ...prev, activeCoils: snap.size }));
        setActiveCoilsList(snap.docs.map((doc) => doc.data() as Coil).slice(0, 5));
      },
    );

    const unsubRecentSales = onSnapshot(
      query(collection(db, "sales"), orderBy("timestamp", "desc"), limit(5)),
      (snap) => {
        setRecentSales(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Sale));
        setIsLoading(false);
      },
    );

    return () => {
      unsubStock();
      unsubSales();
      unsubCoils();
      unsubRecentSales();
    };
  }, []);

  return { kpis, recentSales, activeCoilsList, isLoading };
}
