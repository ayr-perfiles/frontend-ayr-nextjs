"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { fetchKardexPaginated, KardexMovement } from "@/services/kardexService";

export interface KardexFilters {
  selectedSku: string;
  pageSize: number;
  startDate: string;
  endDate: string;
}

type Cursor = QueryDocumentSnapshot<DocumentData> | null;

export function useKardex(filters: KardexFilters) {
  const [movements, setMovements] = useState<KardexMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [globalStock, setGlobalStock] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const firstDocRef = useRef<Cursor>(null);
  const lastDocRef = useRef<Cursor>(null);

  const loadData = useCallback(
    async (dir: "first" | "next" | "prev" = "first") => {
      if (!filters.selectedSku) {
        setMovements([]);
        setTotalCount(0);
        return;
      }
      if ((filters.startDate && !filters.endDate) || (!filters.startDate && filters.endDate)) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchKardexPaginated({
          sku: filters.selectedSku,
          pageSize: filters.pageSize,
          startDate: filters.startDate,
          endDate: filters.endDate,
          direction: dir,
          cursorDoc: dir === "next" ? lastDocRef.current : dir === "prev" ? firstDocRef.current : null,
        });
        setMovements(res.movements);
        if (dir === "first" && res.movements.length > 0) {
          setGlobalStock(res.movements[0].balance);
        }
        firstDocRef.current = (res.firstDoc ?? null) as Cursor;
        lastDocRef.current = (res.lastDoc ?? null) as Cursor;
        setTotalCount(res.totalCount);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar el Kardex");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters.selectedSku, filters.pageSize, filters.startDate, filters.endDate],
  );

  useEffect(() => {
    setCurrentPage(1);
    firstDocRef.current = null;
    lastDocRef.current = null;
    void loadData("first");
  }, [loadData]);

  const hasNextPage = movements.length === filters.pageSize;

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

  return { movements, loading, error, totalCount, globalStock, currentPage, hasNextPage, nextPage, prevPage, refresh };
}
