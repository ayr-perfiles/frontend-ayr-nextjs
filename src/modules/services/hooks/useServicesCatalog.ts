import { useEffect, useState } from 'react';
import { listProducts } from '../services/catalogService';
import type { ServiceProduct } from '../types';

export function useServicesCatalog(filters?: {
  active?: boolean;
  searchTerm?: string;
}) {
  const [products, setProducts] = useState<ServiceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await listProducts(filters);
      setProducts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar catálogo de servicios');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters?.active, filters?.searchTerm]);

  return { products, loading, error, refresh };
}
