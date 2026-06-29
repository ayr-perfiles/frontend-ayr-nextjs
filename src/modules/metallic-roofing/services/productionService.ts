import { db, functions } from '@/lib/firebase/clientApp';
import { httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import type { Coil, CoilStatus, ProductionLog } from '@/types';

export interface ProduceFromCoilsParams {
  targetSku: string;
  productKind: 'COBERTURA_ML' | 'PLANCHA_UND';
  /** Requerido si productKind === 'PLANCHA_UND'. */
  lengthM: number | null;
  coilInputs: Array<{
    coilId: string;
    /** ML declarados (COBERTURA_ML) | piezas declaradas (PLANCHA_UND). */
    declared: number;
    reportedWeightKg?: number;
  }>;
  requestId: string;
}

export interface ProduceFromCoilsResult {
  success: true;
  hasNegativeCoilWarning: boolean;
  cantidadProducida: number;
  costoUnitarioPEN: number;
}

const errorMap: Record<string, string> = {
  'not-found': 'No encontrado.',
  'failed-precondition': 'Requisito incumplido.',
  'invalid-argument': 'Datos inválidos.',
  'permission-denied': 'Permiso denegado.',
  'unauthenticated': 'No autenticado.',
};

/**
 * Invoca la Callable 'produceFromCoils' en el backend.
 */
export async function produceFromCoils(
  params: ProduceFromCoilsParams,
): Promise<ProduceFromCoilsResult> {
  try {
    const callable = httpsCallable<ProduceFromCoilsParams, ProduceFromCoilsResult>(
      functions,
      'produceFromCoils',
    );
    const { data } = await callable(params);
    return data;
  } catch (error: any) {
    if (error.code && typeof error.code === 'string') {
      const fbCode = error.code.replace('functions/', '');
      throw new Error(error.message || errorMap[fbCode] || 'Error al registrar producción.');
    }
    throw error;
  }
}

export async function voidProductionFromCoils(
  productionLogId: string,
  userEmail: string,
): Promise<{ success: boolean }> {
  return await runTransaction(db, async (tx) => {
    // ── 1. LECTURAS ────────────────────────────────────────────────────────────
    const logRef = doc(db, 'production_logs', productionLogId);
    const logSnap = await tx.get(logRef);

    if (!logSnap.exists()) {
      throw new Error(`El registro de producción '${productionLogId}' no existe.`);
    }

    const log = logSnap.data() as ProductionLog;

    if (log.status === 'VOIDED') {
      throw new Error(`El registro de producción ya fue anulado.`);
    }

    if (log.line !== 'metallic-roofing') {
      throw new Error(`El registro no pertenece a la línea metallic-roofing.`);
    }

    if (!log.perCoilBreakdown || log.perCoilBreakdown.length === 0) {
      throw new Error(
        `El registro de producción no tiene desglose de bobinas (perCoilBreakdown) válido. No se puede anular de forma precisa.`,
      );
    }

    const coilRefs = log.perCoilBreakdown.map((b) => doc(db, 'coils', b.coilId));
    const stockRef = doc(db, 'metallic_roofing_stock', log.sku);

    const [stockSnap, ...coilSnaps] = await Promise.all([
      tx.get(stockRef),
      ...coilRefs.map((ref) => tx.get(ref)),
    ]);

    for (let i = 0; i < coilSnaps.length; i++) {
      if (!coilSnaps[i].exists()) {
        throw new Error(`La bobina '${log.perCoilBreakdown[i].coilId}' referenciada no existe.`);
      }
    }

    if (!stockSnap.exists()) {
      throw new Error(`El stock del producto '${log.sku}' no existe.`);
    }

    // ── 2. ESCRITURAS ──────────────────────────────────────────────────────────

    // a) LOG
    tx.update(logRef, {
      status: 'VOIDED',
      voidedAt: serverTimestamp(),
      voidedBy: userEmail,
    });

    // b) BOBINAS
    const EPSILON = 0.01;
    for (let i = 0; i < log.perCoilBreakdown.length; i++) {
      const breakdown = log.perCoilBreakdown[i];
      const coilRef = coilRefs[i];
      const coil = coilSnaps[i].data() as Coil;

      const newWeight = coil.currentWeight + breakdown.weightConsumedKg;
      let newStatus: CoilStatus = 'IN_PROGRESS';

      if (newWeight >= coil.initialWeight - EPSILON) {
        newStatus = 'AVAILABLE';
      }

      tx.update(coilRef, {
        currentWeight: Number(newWeight.toFixed(4)),
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      // Kardex de la bobina (IN)
      tx.set(doc(collection(db, 'kardex_movements')), {
        sku: coil.id,
        date: serverTimestamp(),
        type: 'IN',
        quantity: 1,
        weightKg: breakdown.weightConsumedKg,
        costPerKg: coil.pricePerKg,
        balance: Number(newWeight.toFixed(4)),
        reference: productionLogId,
        description: `Devolución MP por anulación de producción ${productionLogId}`,
        user: userEmail,
      });
    }

    // c) PRODUCTO TERMINADO (metallic_roofing_stock)
    const stockData = stockSnap.data();
    const currentQty = stockData.quantity as number || 0;
    const currentTotalValue = stockData.totalValue as number || 0;

    const nuevaQuantity = currentQty - log.piecesProduced;
    const costoCorrida = log.perCoilBreakdown.reduce((acc, b) => acc + b.costPEN, 0);
    const nuevoTotalValue = currentTotalValue - costoCorrida;
    const nuevoAvgCost = nuevaQuantity > 0 ? nuevoTotalValue / nuevaQuantity : 0;

    tx.update(stockRef, {
      quantity: nuevaQuantity,
      totalValue: Number(nuevoTotalValue.toFixed(2)),
      avgCost: Number(nuevoAvgCost.toFixed(6)),
      lastUpdate: serverTimestamp(),
    });

    // Movimiento stock terminado (SALIDA)
    tx.set(doc(collection(db, 'metallic_roofing_stock_movements')), {
      sku: log.sku,
      type: 'SALIDA',
      quantity: log.piecesProduced,
      costPerUnit: log.costPerPiece,
      reason: `Anulación de producción ${productionLogId}`,
      businessLine: 'metallic-roofing',
      createdBy: userEmail,
      createdAt: serverTimestamp(),
      referenceId: productionLogId,
    });

    // d) AUDIT
    tx.set(doc(collection(db, 'audit_logs')), {
      action: 'VOID_PRODUCTION_FROM_COILS',
      entityId: productionLogId,
      userEmail,
      details: `Anulación de ${log.piecesProduced} u de ${log.sku}. Devolución de MP a ${log.perCoilBreakdown.length} bobina(s).`,
      timestamp: serverTimestamp(),
    });

    return { success: true };
  });
}
