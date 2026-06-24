import { useEffect, useState } from 'react';
import { listProducts } from '../services/catalogService';
import type { TradingProduct, TradingCategory } from '../types';

export function useTradingCatalog(filters?: {
  active?: boolean;
  category?: TradingCategory;
  searchTerm?: string;
}) {
  const [products, setProducts] = useState<TradingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await listProducts(filters);
      setProducts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar catálogo');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters?.active, filters?.category, filters?.searchTerm]);

  return { products, loading, error, refresh };
}
