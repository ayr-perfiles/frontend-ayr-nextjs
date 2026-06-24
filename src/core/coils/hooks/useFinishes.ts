import { useState, useEffect } from 'react';
import { listFinishes, CoilFinish } from '../services/finishService';

export function useFinishes(onlyActive = true) {
  const [finishes, setFinishes] = useState<CoilFinish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFinishes = async () => {
      try {
        const data = await listFinishes(onlyActive);
        setFinishes(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar acabados');
      } finally {
        setLoading(false);
      }
    };
    fetchFinishes();
  }, [onlyActive]);

  return { finishes, loading, error };
}
