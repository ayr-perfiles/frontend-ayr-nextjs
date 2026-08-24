"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchInventory,
  fetchInventoryKpis,
  type InventoryItem,
} from "@/modules/metallic-roofing/services/inventoryService";

export interface MetallicStockFilters {
  searchTerm: string;
  family: string;
  finish: string;

  showOnlyWithStock: boolean;
  showOnlyNegative: boolean;
}

export interface MetallicKpis {
  totalProducts: number;
  totalPieces: number;
  negativeCount: number;
}

export function useMetallicStock(filters: MetallicStockFilters) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [kpis, setKpis] = useState<MetallicKpis>({ totalProducts: 0, totalPieces: 0, negativeCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.searchTerm);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.searchTerm), 400);
    return () => clearTimeout(t);
  }, [filters.searchTerm]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, kpiData] = await Promise.all([
        fetchInventory({
          searchTerm: debouncedSearch || undefined,
          family: filters.family || undefined,
          finish: filters.finish || undefined,

          showOnlyWithStock: filters.showOnlyWithStock,
          showOnlyNegative: filters.showOnlyNegative,
        }),
        fetchInventoryKpis(),
      ]);
      setItems(data);
      setKpis(kpiData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar inventario aluzinc");
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearch,
    filters.family,
    filters.finish,

    filters.showOnlyWithStock,
    filters.showOnlyNegative,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, kpis, loading, error, refresh: load };
}
