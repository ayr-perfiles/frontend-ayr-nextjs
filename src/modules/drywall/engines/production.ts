import { db } from '@/lib/firebase/clientApp';
import { doc, getDoc } from 'firebase/firestore';
import type {
  ProductionEngine,
  PlanInput,
  Plan,
  ExecutionData,
  Output,
  OperationStatus,
  DomainError,
  Result,
} from '@/core/contracts';
import { Coil } from '@/types';
import {
  saveCuttingPlan,
  processSingleStrip,
  cancelCuttingPlan,
} from '../services/productionService';

/**
 * Forma concreta de PlanInput para drywall.
 * planOperation espera este shape en input.
 */
export interface DrywallPlanInput extends PlanInput {
  coilId: string;
  items: { sku: string; quantity: number }[];
}

/**
 * Forma concreta de ExecutionData para drywall.
 * executeOperation espera este shape en executionData.
 */
export interface DrywallExecutionData extends ExecutionData {
  sku: string;
  pieces: number;
  operatorId: string;
}

function toDomainError(e: unknown): DomainError {
  const message = e instanceof Error ? e.message : 'Error desconocido en producción';
  return { code: 'DRYWALL_PRODUCTION_ERROR', message };
}

function calculateProgress(coil: Coil): number {
  const strips = coil.plannedStrips ?? [];
  if (strips.length === 0) return 0;
  const total = strips.reduce((sum, s) => sum + s.initialCount, 0);
  if (total === 0) return 0;
  const pending = strips.reduce((sum, s) => sum + s.pendingCount, 0);
  return Math.round(((total - pending) / total) * 100);
}

export const drywallProductionEngine: ProductionEngine = {
  async planOperation(input: PlanInput): Promise<Result<Plan, DomainError>> {
    const { coilId, items } = input as DrywallPlanInput;
    try {
      await saveCuttingPlan(coilId, items);
      return {
        success: true,
        data: { id: coilId, status: 'IN_PROGRESS' },
      };
    } catch (e) {
      return { success: false, error: toDomainError(e) };
    }
  },

  async executeOperation(
    planId: string,
    executionData: ExecutionData,
  ): Promise<Result<Output, DomainError>> {
    const { sku, pieces, operatorId } = executionData as DrywallExecutionData;
    try {
      await processSingleStrip(planId, sku, pieces, operatorId);
      return {
        success: true,
        data: {
          producedItems: [{ sku, quantity: pieces, cost: 0 }],
        },
      };
    } catch (e) {
      return { success: false, error: toDomainError(e) };
    }
  },

  async cancelOperation(
    operationId: string,
    reason: string,
  ): Promise<Result<void, DomainError>> {
    try {
      // reason contiene el email del usuario que cancela (userEmail)
      await cancelCuttingPlan(operationId, reason);
      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: toDomainError(e) };
    }
  },

  async getStatus(operationId: string): Promise<OperationStatus> {
    const coilSnap = await getDoc(doc(db, 'coils', operationId));
    if (!coilSnap.exists()) {
      return { id: operationId, status: 'NOT_FOUND', progress: 0 };
    }
    const coil = coilSnap.data() as Coil;

    const progressMap: Record<string, number> = {
      AVAILABLE: 0,
      IN_PROGRESS: calculateProgress(coil),
      PROCESSED: 100,
      VOIDED: 0,
    };

    return {
      id: operationId,
      status: coil.status,
      progress: progressMap[coil.status] ?? 0,
    };
  },
};
