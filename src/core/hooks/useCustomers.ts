"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { fetchCustomersPaginated } from "@/services/crmService";

export interface CustomersFilters {
  pageSize: number;
  searchTerm: string;
}

type Cursor = QueryDocumentSnapshot<DocumentData> | null;

export function useCustomers(filters: CustomersFilters) {
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
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
      setLoading(true);
      setError(null);
      try {
        const res = await fetchCustomersPaginated({
          pageSize: filters.pageSize,
          searchTerm: debouncedSearch,
          direction: dir,
          cursorDoc: dir === "next" ? lastDocRef.current : dir === "prev" ? firstDocRef.current : null,
        });
        setCustomers(res.customers as Record<string, unknown>[]);
        firstDocRef.current = (res.firstDoc ?? null) as Cursor;
        lastDocRef.current = (res.lastDoc ?? null) as Cursor;
        setFilteredTotal(res.totalCount || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar clientes");
      } finally {
        setLoading(false);
      }
    },
     
    [debouncedSearch, filters.pageSize],
  );

  useEffect(() => {
    setCurrentPage(1);
    firstDocRef.current = null;
    lastDocRef.current = null;
    void loadData("first");
  }, [loadData]);

  const hasNextPage = customers.length === filters.pageSize;

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

  return { customers, loading, error, filteredTotal, currentPage, hasNextPage, nextPage, prevPage, refresh };
}
