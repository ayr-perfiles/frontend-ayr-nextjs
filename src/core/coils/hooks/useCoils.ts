"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { Coil, BusinessLine } from "@/types";
import { fetchInventory } from "../services/coilService";
import { getFinishIdsForLine } from "../domain/finishCompat";
import { useFinishes } from "./useFinishes";

const DEBOUNCE_MS = 500;

export interface CoilFilters {
  searchTerm: string;
  statusFilter: string;
  finishFilter?: string;
  currencyFilter?: string;
  providerFilter?: string;
  startDate: string;
  endDate: string;
  pageSize: number;
  /** Scope por línea de negocio (frente #10). `undefined` = sin scope (comportamiento actual). */
  lineFilter?: BusinessLine;
}

export interface UseCoilsResult {
  coils: Coil[];
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

type AlgoliaPageData = { totalPages: number; currentPage: number; nbHits: number };
type FetchInventoryResult =
  | {
      coils: Coil[];
      isAlgolia: true;
      isMemory?: false;
      algoliaData: AlgoliaPageData;
      firstDoc: null;
      lastDoc: null;
      totalCount: number;
    }
  | {
      coils: Coil[];
      isAlgolia: false;
      isMemory: true;
      firstDoc: null;
      lastDoc: null;
      totalCount: number;
    }
  | {
      coils: Coil[];
      isAlgolia: false;
      isMemory?: false;
      firstDoc: QueryDocumentSnapshot<DocumentData> | null;
      lastDoc: QueryDocumentSnapshot<DocumentData> | null;
      totalCount: number;
    };

export function useCoils(filters: CoilFilters): UseCoilsResult {
  const {
    searchTerm,
    statusFilter,
    finishFilter,
    currencyFilter,
    providerFilter,
    startDate,
    endDate,
    pageSize,
    lineFilter,
  } = filters;

  const [coils, setCoils] = useState<Coil[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [isAlgoliaMode, setIsAlgoliaMode] = useState(false);
  const [isMemoryMode, setIsMemoryMode] = useState(false);
  // 0-indexed, compartido por los dos modos que paginan por número (Algolia y memoria) —
  // son el mismo mecanismo. `currentPage` (1-indexed) es solo para pantalla/TablePagination.
  const [numericPage, setNumericPage] = useState(0);
  const [algoliaTotalPages, setAlgoliaTotalPages] = useState(0);

  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const firstDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  // `finishes` (useState de useFinishes) es referencialmente estable entre renders —
  // el useMemo alcanza para no recrear el array de ids en cada render y no disparar
  // loop infinito vía las deps de loadData.
  const { finishes, loading: finishesLoading } = useFinishes(true);
  const lineFinishIds = useMemo(
    () => (lineFilter ? getFinishIdsForLine(finishes, lineFilter) : undefined),
    [finishes, lineFilter],
  );

  const loadData = useCallback(
    async (direction: "first" | "next" | "prev" = "first", requestedPage = 0) => {
      // (a) Los finishes todavía no cargaron: esperar, sin tocar loading (arranca en
      // `true`) — el useEffect re-dispara solo cuando `finishesLoading` pase a false.
      // Sin `lineFilter` (ej. bobinas-supervisor) esto nunca aplica: dispara normal.
      if (lineFilter && finishesLoading) return;

      // (b) Los finishes YA cargaron y la línea no tiene ninguno activo: `lineFinishIds`
      // es [] mismo para siempre, no "todavía". Vacío honesto (loading:false, coils:[]),
      // nunca spinner eterno — distinto de (a), que es un [] transitorio.
      if (lineFilter && !finishesLoading && (lineFinishIds?.length ?? 0) === 0) {
        setCoils([]);
        setFilteredTotal(0);
        setIsAlgoliaMode(false);
        setIsMemoryMode(false);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = (await fetchInventory({
          pageSize,
          statusFilter,
          finishFilter,
          currencyFilter,
          providerFilter,
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
          page: requestedPage,
          lineFinishIds,
        })) as FetchInventoryResult;

        setCoils(res.coils);
        setIsAlgoliaMode(res.isAlgolia);
        setIsMemoryMode(!!res.isMemory);
        setFilteredTotal(res.totalCount ?? res.coils.length);

        if (res.isAlgolia) {
          setAlgoliaTotalPages(res.algoliaData.totalPages);
          setNumericPage(res.algoliaData.currentPage);
          firstDocRef.current = null;
          lastDocRef.current = null;
        } else if (res.isMemory) {
          // La respuesta en modo memoria no confirma la página (no hay servidor que la
          // eche): se asume la que se pidió, que es la única fuente de verdad acá.
          setNumericPage(requestedPage);
          firstDocRef.current = null;
          lastDocRef.current = null;
        } else {
          firstDocRef.current = res.firstDoc;
          lastDocRef.current = res.lastDoc;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al cargar inventario";
        setError(msg);
        console.error("[useCoils]", err);
      } finally {
        setLoading(false);
      }
    },
    [
      pageSize,
      statusFilter,
      finishFilter,
      currencyFilter,
      providerFilter,
      debouncedSearch,
      startDate,
      endDate,
      lineFilter,
      lineFinishIds,
      finishesLoading,
    ],
  );

  useEffect(() => {
    if ((startDate && !endDate) || (!startDate && endDate)) return;
    setCurrentPage(1);
    loadData("first", 0);
  }, [loadData, startDate, endDate]);

  const hasNextPage = isAlgoliaMode
    ? numericPage + 1 < algoliaTotalPages
    : isMemoryMode
      ? currentPage * pageSize < filteredTotal
      : coils.length === pageSize;

  const nextPage = useCallback(() => {
    if (!hasNextPage) return;
    setCurrentPage((prev) => prev + 1);
    if (isAlgoliaMode || isMemoryMode) {
      loadData("first", numericPage + 1);
    } else {
      loadData("next");
    }
  }, [hasNextPage, isAlgoliaMode, isMemoryMode, numericPage, loadData]);

  const prevPage = useCallback(() => {
    if (currentPage <= 1) return;
    setCurrentPage((prev) => prev - 1);
    if (isAlgoliaMode || isMemoryMode) {
      loadData("first", numericPage - 1);
    } else {
      loadData("prev");
    }
  }, [currentPage, isAlgoliaMode, isMemoryMode, numericPage, loadData]);

  const refresh = useCallback(() => {
    setCurrentPage(1);
    loadData("first", 0);
  }, [loadData]);

  return {
    coils,
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
