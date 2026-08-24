"use client";

import { useState, useEffect, useCallback } from "react";
import { listProducts } from "@/modules/metallic-roofing/services/catalogService";
import type { MetallicProduct } from "@/modules/metallic-roofing/types";

const DEBOUNCE_MS = 400;

export interface MetallicCatalogFilters {
  searchTerm?: string;
  family?: string;
  finish?: string;

  status?: "ALL" | "ACTIVE" | "INACTIVE";
}

export interface UseMetallicCatalogResult {
  products: MetallicProduct[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useMetallicCatalog(filters?: MetallicCatalogFilters): UseMetallicCatalogResult {
  const { searchTerm, status, family, finish } = filters ?? {};

  const [products, setProducts] = useState<MetallicProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm ?? "");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm ?? ""), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activeFilter =
        status === "ACTIVE" ? true : status === "INACTIVE" ? false : undefined;

      const results = await listProducts({
        active: activeFilter,
        family: family ?? undefined,
        finish: finish ?? undefined,

        searchTerm: debouncedSearch || undefined,
      });

      setProducts(results);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cargar catálogo aluzinc";
      setError(msg);
      console.error("[useMetallicCatalog]", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, family, finish]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => load(), [load]);

  return { products, loading, error, refresh };
}
