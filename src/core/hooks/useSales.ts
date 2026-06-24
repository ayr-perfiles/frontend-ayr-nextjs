"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import type { Sale } from "@/types";
import { fetchSales } from "@/core/sales/services/salesService";

export interface SalesFilters {
  pageSize: number;
  statusFilter: string;
  businessLine: "ALL" | "drywall" | "roofing" | "metallic-roofing" | "trading" | "services";
  searchTerm: string;
  startDate: string;
  endDate: string;
  sunatFilter: string;
}

type Cursor = QueryDocumentSnapshot<DocumentData> | null;

export function useSales(filters: SalesFilters) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [aggregates, setAggregates] = useState<{ totalAmount: number; totalProfit: number; totalWeight: number } | null>(null);
  const [isAlgolia, setIsAlgolia] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.searchTerm);

  const firstDocRef = useRef<Cursor>(null);
  const lastDocRef = useRef<Cursor>(null);
  const prevFiltersRef = useRef({
    statusFilter: filters.statusFilter,
    businessLine: filters.businessLine,
    searchTerm: filters.searchTerm,
    startDate: filters.startDate,
    endDate: filters.endDate,
    sunatFilter: filters.sunatFilter,
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.searchTerm), 400);
    return () => clearTimeout(t);
  }, [filters.searchTerm]);

  const loadData = useCallback(
    async (dir: "first" | "next" | "prev" = "first", forceRefetchAggregates = false) => {
      if ((filters.startDate && !filters.endDate) || (!filters.startDate && filters.endDate)) return;
      
      const filtersChanged = 
        prevFiltersRef.current.statusFilter !== filters.statusFilter ||
        prevFiltersRef.current.businessLine !== filters.businessLine ||
        prevFiltersRef.current.searchTerm !== debouncedSearch ||
        prevFiltersRef.current.startDate !== filters.startDate ||
        prevFiltersRef.current.endDate !== filters.endDate ||
        prevFiltersRef.current.sunatFilter !== filters.sunatFilter;

      // Skip aggregates if filters haven't changed AND we already have them (from a previous first-page load)
      // This applies to both pagination (dir="next"/"prev") and pageSize changes
      const skipAggregates = forceRefetchAggregates ? false : 
        (!filtersChanged && dir !== "first" ? true : (!filtersChanged && dir === "first" && aggregates !== null));

      prevFiltersRef.current = {
        statusFilter: filters.statusFilter,
        businessLine: filters.businessLine,
        searchTerm: debouncedSearch,
        startDate: filters.startDate,
        endDate: filters.endDate,
        sunatFilter: filters.sunatFilter,
      };

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
          sunatFilter: filters.sunatFilter,
          direction: dir,
          cursorDoc: dir === "next" ? lastDocRef.current : dir === "prev" ? firstDocRef.current : null,
          skipAggregates,
        });
        setSales(res.sales as unknown as Sale[]);
        firstDocRef.current = (res.firstDoc ?? null) as Cursor;
        lastDocRef.current = (res.lastDoc ?? null) as Cursor;
        
        if (!skipAggregates) {
          setFilteredTotal(res.totalCount || 0);
          setAggregates(res.aggregates);
          setIsAlgolia(res.isAlgolia);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar ventas");
      } finally {
        setLoading(false);
      }
    },
     
    [debouncedSearch, filters.pageSize, filters.statusFilter, filters.businessLine, filters.startDate, filters.endDate, filters.sunatFilter],
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
    void loadData("first", true);
  }, [loadData]);

  return { sales, loading, error, filteredTotal, aggregates, isAlgolia, currentPage, hasNextPage, nextPage, prevPage, refresh };
}
