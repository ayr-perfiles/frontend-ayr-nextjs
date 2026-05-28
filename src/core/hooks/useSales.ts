"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import type { Sale } from "@/types";
import { fetchSales } from "@/core/sales/services/salesService";

export interface SalesFilters {
  pageSize: number;
  statusFilter: string;
  businessLine: "ALL" | "drywall" | "roofing" | "metallic-roofing";
  searchTerm: string;
  startDate: string;
  endDate: string;
}

type Cursor = QueryDocumentSnapshot<DocumentData> | null;

export function useSales(filters: SalesFilters) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.searchTerm);

  const firstDocRef = useRef<Cursor>(null);
  const lastDocRef = useRef<Cursor>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.searchTerm), 400);
    return () => clearTimeout(t);
  }, [filters.searchTerm]);

  const loadData = useCallback(
    async (dir: "first" | "next" | "prev" = "first") => {
      if ((filters.startDate && !filters.endDate) || (!filters.startDate && filters.endDate)) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchSales({
          pageSize: filters.pageSize,
          statusFilter: filters.statusFilter,
          businessLine: filters.businessLine === "ALL" ? "" : filters.businessLine,
          searchTerm: debouncedSearch,
          startDate: filters.startDate,
          endDate: filters.endDate,
          direction: dir,
          cursorDoc: dir === "next" ? lastDocRef.current : dir === "prev" ? firstDocRef.current : null,
        });
        setSales(res.sales as unknown as Sale[]);
        firstDocRef.current = (res.firstDoc ?? null) as Cursor;
        lastDocRef.current = (res.lastDoc ?? null) as Cursor;
        setFilteredTotal(res.totalCount || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar ventas");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedSearch, filters.pageSize, filters.statusFilter, filters.businessLine, filters.startDate, filters.endDate],
  );

  useEffect(() => {
    setCurrentPage(1);
    firstDocRef.current = null;
    lastDocRef.current = null;
    void loadData("first");
  }, [loadData]);

  const hasNextPage = sales.length === filters.pageSize;

  const nextPage = useCallback(() => {
    if (!hasNextPage) return;
    setCurrentPage((p) => p + 1);
    void loadData("next");
  }, [hasNextPage, loadData]);

  const prevPage = useCallback(() => {
    if (currentPage <= 1) return;
    setCurrentPage((p) => p - 1);
    void loadData("prev");
  }, [currentPage, loadData]);

  const refresh = useCallback(() => {
    setCurrentPage(1);
    firstDocRef.current = null;
    lastDocRef.current = null;
    void loadData("first");
  }, [loadData]);

  return { sales, loading, error, filteredTotal, currentPage, hasNextPage, nextPage, prevPage, refresh };
}
