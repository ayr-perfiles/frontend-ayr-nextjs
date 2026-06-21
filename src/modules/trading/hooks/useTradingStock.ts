import { useEffect, useState } from 'react';
import { fetchInventory, fetchInventoryKpis, InventoryFilters, InventoryItem } from '../services/inventoryService';

export function useTradingStock(filters: InventoryFilters) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await fetchInventory(filters);
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar inventario');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.searchTerm, filters.category, filters.showOnlyWithStock, filters.showOnlyNegative]);

  return { items, loading, error, refresh };
}

export function useTradingKpis() {
  const [kpis, setKpis] = useState<{ totalProducts: number; totalPieces: number; negativeCount: number } | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const data = await fetchInventoryKpis();
      setKpis(data);
    } catch (err) {
      console.error('Error loading KPIs', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return { kpis, loading, refresh };
}
