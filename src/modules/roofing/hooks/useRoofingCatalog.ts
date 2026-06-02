"use client";

import { useState, useEffect, useCallback } from "react";
import { listProducts } from "@/modules/roofing/services/catalogService";
import type { RoofingProduct, RoofingFilters } from "@/modules/roofing/types";

const DEBOUNCE_MS = 400;

export interface UseRoofingCatalogResult {
  products: RoofingProduct[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useRoofingCatalog(filters?: RoofingFilters): UseRoofingCatalogResult {
  const { searchTerm, status, material, color } = filters ?? {};

  const [products, setProducts] = useState<RoofingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search term to avoid a Firestore call on every keystroke
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
        material: material ?? undefined,
        color: color ?? undefined,
        searchTerm: debouncedSearch || undefined,
      });

      setProducts(results);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cargar catálogo PVC";
      setError(msg);
      console.error("[useRoofingCatalog]", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, material, color]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => load(), [load]);

  return { products, loading, error, refresh };
}
