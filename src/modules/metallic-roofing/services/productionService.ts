import { db } from '@/lib/firebase/clientApp';
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import type { Coil, CoilStatus } from '@/types';
import { listFinishes } from '@/core/coils/services/finishService';
import { assertCoilFinishCompatible } from '@/core/coils/domain/finishCompat';
import { metallicRoofingStockStrategy } from '@/core/sales/strategies';
import {
  calcProductionFromCoils,
  type CoilProductionInput,
  type TargetSkuInfo,
} from '../domain/coilProduction';

export interface ProduceFromCoilsParams {
  targetSku: string;
  productKind: 'COBERTURA_ML' | 'PLANCHA_UND';
  /** Requerido si productKind === 'PLANCHA_UND'. */
  lengthM: number | null;
  coilInputs: Array<{
    coilId: string;
    /** ML declarados (COBERTURA_ML) | piezas declaradas (PLANCHA_UND). */
    declared: number;
  }>;
  operatorId: string;
  userEmail: string;
}

export interface ProduceFromCoilsResult {
  success: true;
  hasNegativeCoilWarning: boolean;
  cantidadProducida: number;
  costoUnitarioPEN: number;
}

/**
 * Acción atómica: consume bobinas → incrementa stock terminado metallic-roofing.
 *
 * Patrón: listFinishes() FUERA de tx (read idempotente) → runTransaction (reads primero).
 * Stock negativo de bobina: PERMITIDO — retorna hasNegativeCoilWarning:true en lugar de lanzar.
 */
export async function produceFromCoils(
  params: ProduceFromCoilsParams,
): Promise<ProduceFromCoilsResult> {
  const { targetSku, productKind, lengthM, coilInputs, operatorId, userEmail } = params;

  // Carga de acabados FUERA de la transacción (lectura simple, patrón de consumeCoil)
  const finishes = await listFinishes(true);

  let hasNegativeCoilWarning = false;

  const txResult = await runTransaction(db, async (tx) => {
    // ── LECTURAS (todas antes de cualquier escritura) ─────────────────────────

    const coilRefs = coilInputs.map((c) => doc(db, 'coils', c.coilId));
    const stockRef = doc(db, 'metallic_roofing_stock', targetSku);

    const [stockSnap, ...coilSnaps] = await Promise.all([
      tx.get(stockRef),
      ...coilRefs.map((ref) => tx.get(ref)),
    ]);

    // ── VALIDACIONES + construcción de inputs de dominio ─────────────────────

    const resolvedCoilInputs: CoilProductionInput[] = [];

    for (let i = 0; i < coilInputs.length; i++) {
      const snap = coilSnaps[i];
      const { coilId, declared } = coilInputs[i];

      if (!snap.exists()) {
        throw new Error(`La bobina '${coilId}' no existe.`);
      }

      const coil = snap.data() as Coil;

      if (coil.status !== 'AVAILABLE' && coil.status !== 'IN_PROGRESS') {
        throw new Error(
          `La bobina '${coilId}' no está disponible para producción (estado: ${coil.status}).`,
        );
      }

      if (!coil.finish) {
        throw new Error(`La bobina '${coilId}' no tiene acabado asignado. Edítala primero.`);
      }

      const compatResult = assertCoilFinishCompatible(coil.finish, 'metallic-roofing', finishes);
      if (!compatResult.success) {
        throw new Error(compatResult.error.message);
      }

      const finish = finishes.find((f) => f.id === coil.finish);
      if (!finish?.densityFactor) {
        throw new Error(
          `El acabado '${coil.finish}' no tiene factor de densidad configurado. ` +
            `Configúralo en Acabados antes de registrar producción.`,
        );
      }

      if (!coil.masterWidth) {
        throw new Error(`La bobina '${coilId}' no tiene ancho maestro (masterWidth) definido.`);
      }

      if (!coil.thickness) {
        throw new Error(`La bobina '${coilId}' no tiene espesor (thickness) definido.`);
      }

      resolvedCoilInputs.push({
        coilId,
        declared,
        thicknessMm: coil.thickness,
        masterWidth: coil.masterWidth,
        pricePerKg: coil.pricePerKg,
        coilDensityFactor: finish.densityFactor,
      });
    }

    // ── CÁLCULOS DE DOMINIO ───────────────────────────────────────────────────

    const targetSkuInfo: TargetSkuInfo = { productKind, lengthM };
    const result = calcProductionFromCoils(targetSkuInfo, resolvedCoilInputs);

    // WAC del stock terminado
    const currentQty = metallicRoofingStockStrategy.extractQuantity(stockSnap);
    const currentAvgCost = metallicRoofingStockStrategy.extractAvgCost(stockSnap);
    const newQty = currentQty + result.cantidadProducida;
    const newValue = currentQty * currentAvgCost + result.costoTotalPEN;
    const newAvgCost =
      newQty > 0
        ? Number((newValue / newQty).toFixed(6))
        : result.costoUnitarioPEN;

    // ── ESCRITURAS ────────────────────────────────────────────────────────────

    // 1. Actualizar cada bobina + kardex OUT
    for (let i = 0; i < coilInputs.length; i++) {
      const coilRef = coilRefs[i];
      const coil = coilSnaps[i].data() as Coil;
      const breakdown = result.perCoilBreakdown[i];

      const newWeight = Number((coil.currentWeight - breakdown.weightConsumedKg).toFixed(4));
      if (newWeight < 0) hasNegativeCoilWarning = true;

      const newStatus: CoilStatus = newWeight <= 0 ? 'PROCESSED' : 'IN_PROGRESS';

      tx.update(coilRef, {
        currentWeight: newWeight,
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      tx.set(doc(collection(db, 'kardex_movements')), {
        sku: coilInputs[i].coilId,
        date: serverTimestamp(),
        type: 'OUT',
        quantity: 1,
        weightKg: breakdown.weightConsumedKg,
        costPerKg: coil.pricePerKg,
        balance: newWeight,
        reference: targetSku,
        description: `Conformado → ${targetSku} (${breakdown.mlFromCoil.toFixed(2)} ML / ${breakdown.weightConsumedKg.toFixed(2)} kg)`,
        user: userEmail,
      });
    }

    // 2. Incrementar stock terminado (con WAC calculado)
    metallicRoofingStockStrategy.writeProductionIncrement(
      {
        sku: targetSku,
        quantity: result.cantidadProducida,
        newBalance: newQty,
        newAverageCost: newAvgCost,
        reference: coilInputs.map((c) => c.coilId).join('+'),
        operatorId,
        description: `Conformado desde ${coilInputs.length} bobina(s). S/ ${result.costoUnitarioPEN.toFixed(4)}/u`,
      },
      stockSnap,
      tx,
    );

    // 3. Production log (campos congelados para P-M7)
    tx.set(doc(collection(db, 'production_logs')), {
      sku: targetSku,
      line: 'metallic-roofing',
      parentCoilIds: coilInputs.map((c) => c.coilId),
      parentCoilId: coilInputs.length === 1 ? coilInputs[0].coilId : null,
      piecesProduced: result.cantidadProducida,
      totalUsedWidth: 0,
      scrapWidth: 0,
      stripCost: result.costoTotalPEN,
      costPerPiece: result.costoUnitarioPEN,
      reportedWeight: result.pesoTotalKg,
      operatorId,
      timestamp: serverTimestamp(),
      status: 'ACTIVE',
      // P-M5 extensions
      weightConsumedKg: result.pesoTotalKg,
      mlProduced: result.totalMl,
      costoUnitarioPEN: result.costoUnitarioPEN,
      avgCostAfter: newAvgCost,
      coilDensityFactor: resolvedCoilInputs[0]?.coilDensityFactor ?? null,
    });

    // 4. Audit log
    tx.set(doc(collection(db, 'audit_logs')), {
      action: 'PRODUCE_FROM_COILS',
      entityId: targetSku,
      userEmail,
      details:
        `Conformado: ${result.cantidadProducida} u → ${targetSku}. ` +
        `Bobinas: [${coilInputs.map((c) => c.coilId).join(', ')}]. ` +
        `Peso: ${result.pesoTotalKg} kg. ` +
        `Costo total: S/ ${result.costoTotalPEN.toFixed(2)}. ` +
        `Costo unitario: S/ ${result.costoUnitarioPEN.toFixed(4)}/u.`,
      timestamp: serverTimestamp(),
    });

    return { result, newAvgCost };
  });

  return {
    success: true,
    hasNegativeCoilWarning,
    cantidadProducida: txResult.result.cantidadProducida,
    costoUnitarioPEN: txResult.result.costoUnitarioPEN,
  };
}
