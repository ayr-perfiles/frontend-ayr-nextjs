"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchInventory,
  fetchInventoryKpis,
  type InventoryItem,
  type InventoryFilters,
} from "@/modules/roofing/services/inventoryService";
import type { RoofingMaterial } from "@/modules/roofing/types";

export interface RoofingStockFilters {
  searchTerm: string;
  material: RoofingMaterial | "";
  color: string;
  showOnlyWithStock: boolean;
  showOnlyNegative: boolean;
}

export interface RoofingKpis {
  totalProducts: number;
  totalPieces: number;
  negativeCount: number;
}

export function useRoofingStock(filters: RoofingStockFilters) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [kpis, setKpis] = useState<RoofingKpis>({ totalProducts: 0, totalPieces: 0, negativeCount: 0 });
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
      const inventoryFilters: InventoryFilters = {
        searchTerm: debouncedSearch || undefined,
        material: filters.material || undefined,
        color: filters.color || undefined,
        showOnlyWithStock: filters.showOnlyWithStock,
        showOnlyNegative: filters.showOnlyNegative,
      };
      const [data, kpiData] = await Promise.all([
        fetchInventory(inventoryFilters),
        fetchInventoryKpis(),
      ]);
      setItems(data);
      setKpis(kpiData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar inventario PVC");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters.material, filters.color, filters.showOnlyWithStock, filters.showOnlyNegative]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, kpis, loading, error, refresh: load };
}
