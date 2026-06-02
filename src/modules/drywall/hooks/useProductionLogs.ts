"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { ProductionLog } from "@/types";
import {
  fetchProductionLogs,
  type FetchProductionParams,
} from "@/modules/drywall/services/productionService";

const DEBOUNCE_MS = 500;

export interface ProductionLogFilters {
  searchTerm: string;
  skuFilter: string;
  startDate: string;
  endDate: string;
  pageSize: number;
}

export interface UseProductionLogsResult {
  logs: ProductionLog[];
  loading: boolean;
  error: string | null;
  currentPage: number;
  filteredTotal: number;
  isAlgoliaMode: boolean;
  algoliaTotalPages: number;
  hasNextPage: boolean;
  nextPage: () => void;
  prevPage: () => void;
  refresh: () => void;
}

// Tipo discriminado para el resultado de fetchProductionLogs.
type AlgoliaPageData = { totalPages: number; currentPage: number; nbHits: number };
type FetchProductionLogsResult =
  | {
      logs: ProductionLog[];
      isAlgolia: true;
      algoliaData: AlgoliaPageData;
      firstDoc: null;
      lastDoc: null;
      totalCount: number;
    }
  | {
      logs: ProductionLog[];
      isAlgolia: false;
      firstDoc: QueryDocumentSnapshot<DocumentData> | null;
      lastDoc: QueryDocumentSnapshot<DocumentData> | null;
      totalCount: number;
    };

export function useProductionLogs(
  filters: ProductionLogFilters,
): UseProductionLogsResult {
  const { searchTerm, skuFilter, startDate, endDate, pageSize } = filters;

  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [isAlgoliaMode, setIsAlgoliaMode] = useState(false);
  const [algoliaCurrentPage, setAlgoliaCurrentPage] = useState(0);
  const [algoliaTotalPages, setAlgoliaTotalPages] = useState(0);

  // Búsqueda con debounce interno
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const firstDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const loadData = useCallback(
    async (direction: FetchProductionParams["direction"] = "first", algoliaPage = 0) => {
      setLoading(true);
      setError(null);
      try {
        const res = (await fetchProductionLogs({
          pageSize,
          skuFilter,
          searchTerm: debouncedSearch,
          startDate,
          endDate,
          direction,
          cursorDoc:
            direction === "next"
              ? lastDocRef.current
              : direction === "prev"
                ? firstDocRef.current
                : null,
          page: algoliaPage,
        })) as FetchProductionLogsResult;

        setLogs(res.logs);
        setIsAlgoliaMode(res.isAlgolia);
        setFilteredTotal(res.totalCount ?? res.logs.length);

        if (res.isAlgolia) {
          setAlgoliaTotalPages(res.algoliaData.totalPages);
          setAlgoliaCurrentPage(res.algoliaData.currentPage);
          firstDocRef.current = null;
          lastDocRef.current = null;
        } else {
          firstDocRef.current = res.firstDoc;
          lastDocRef.current = res.lastDoc;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al cargar historial de producción";
        setError(msg);
        console.error("[useProductionLogs]", err);
      } finally {
        setLoading(false);
      }
    },
     
    [pageSize, skuFilter, debouncedSearch, startDate, endDate],
  );

  // Recarga cuando cambia cualquier filtro. Guard: rango de fechas incompleto = no fetch.
  useEffect(() => {
    if ((startDate && !endDate) || (!startDate && endDate)) return;
    setCurrentPage(1);
    loadData("first", 0);
  }, [loadData, startDate, endDate]);

  const hasNextPage = isAlgoliaMode
    ? algoliaCurrentPage + 1 < algoliaTotalPages
    : logs.length === pageSize;

  const nextPage = useCallback(() => {
    if (!hasNextPage) return;
    setCurrentPage((prev) => prev + 1);
    if (isAlgoliaMode) {
      loadData("first", algoliaCurrentPage + 1);
    } else {
      loadData("next");
    }
  }, [hasNextPage, isAlgoliaMode, algoliaCurrentPage, loadData]);

  const prevPage = useCallback(() => {
    if (currentPage <= 1) return;
    setCurrentPage((prev) => prev - 1);
    if (isAlgoliaMode) {
      loadData("first", algoliaCurrentPage - 1);
    } else {
      loadData("prev");
    }
  }, [currentPage, isAlgoliaMode, algoliaCurrentPage, loadData]);

  const refresh = useCallback(() => {
    setCurrentPage(1);
    loadData("first", 0);
  }, [loadData]);

  return {
    logs,
    loading,
    error,
    currentPage,
    filteredTotal,
    isAlgoliaMode,
    algoliaTotalPages,
    hasNextPage,
    nextPage,
    prevPage,
    refresh,
  };
}
