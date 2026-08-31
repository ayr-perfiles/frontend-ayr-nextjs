import { useState, useEffect, useCallback } from 'react';
import { listFinishes, CoilFinish } from '../services/finishService';

/**
 * Lee `coil_finishes`. Devuelve además `refetch` para re-consultar sin recargar
 * la página ([NAV-B-FINISHES]): la pantalla de acabados escribía y después hacía
 * `window.location.reload()`, que tapaba la falta de refresco tirando abajo el
 * framework entero.
 *
 * `refetch` es referencialmente ESTABLE por `onlyActive` (useCallback). Importa:
 * `useCoils` depende de que la identidad de lo que devuelve este hook no cambie
 * en cada render para no re-disparar `loadData` en loop (ver useCoils.ts:101-108).
 */
export function useFinishes(onlyActive = true) {
  const [finishes, setFinishes] = useState<CoilFinish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFinishes = useCallback(async () => {
    try {
      setError(null);
      const data = await listFinishes(onlyActive);
      setFinishes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar acabados');
    } finally {
      setLoading(false);
    }
  }, [onlyActive]);

  useEffect(() => {
    fetchFinishes();
  }, [fetchFinishes]);

  return { finishes, loading, error, refetch: fetchFinishes };
}
