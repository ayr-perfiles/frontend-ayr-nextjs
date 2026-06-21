import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';
import type { Coil, ProductionLog } from '@/types';
import { calcCoilYieldDeviation, type YieldDeviationResult } from '../domain/yieldCalc';
import { useFinishes } from '@/core/coils/hooks/useFinishes';

export function useCoilYield(coil?: Coil | null) {
  const [result, setResult] = useState<YieldDeviationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const { finishes } = useFinishes(false);

  useEffect(() => {
    if (!coil || !coil.finish) {
      setResult(null);
      setLoading(false);
      return;
    }

    const finishObj = finishes.find((f) => f.id === coil.finish);
    const isMetallic = finishObj?.lines.includes('metallic-roofing');
    const densityFactor = finishObj?.densityFactor;

    if (!isMetallic || !densityFactor) {
      setResult(null);
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchYield() {
      try {
        setLoading(true);

        // Fetch production logs
        const prodQuery = query(
          collection(db, 'production_logs'),
          where('parentCoilId', '==', coil!.id)
        );
        const prodSnap = await getDocs(prodQuery);
        const logs = prodSnap.docs.map((d) => d.data() as ProductionLog);

        // Fetch direct sales of the coil (isCoil = true)
        // Ventas de bobina cruda
        const salesQuery = query(
          collection(db, 'sales'),
          where('status', '!=', 'VOIDED')
        );
        const salesSnap = await getDocs(salesQuery);
        let kgVendidoCrudo = 0;
        
        salesSnap.docs.forEach(doc => {
          const data = doc.data();
          if (Array.isArray(data.items)) {
            data.items.forEach((item: any) => {
              // si se vendió la bobina directamente (raw coil)
              if (item.isCoil && item.sku === coil!.id) {
                kgVendidoCrudo += (item.quantity || 0);
              }
            });
          }
        });

        if (!isMounted) return;

        const res = calcCoilYieldDeviation({
          coil: coil!,
          productionLogs: logs,
          densityFactor: densityFactor as number,
          kgVendidoCrudo,
        });

        setResult(res);
      } catch (err) {
        console.error('Error fetching coil yield:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchYield();

    return () => {
      isMounted = false;
    };
  }, [coil, finishes]);

  return { result, loading };
}
