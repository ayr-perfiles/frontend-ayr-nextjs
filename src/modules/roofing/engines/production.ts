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

// Sprint 4: El proceso de producción PVC (recepción de planchas) se implementará
// en el siguiente sprint. Por ahora se expone un stub que satisface el contrato.

const NOT_IMPLEMENTED: DomainError = {
  code: 'ROOFING_PRODUCTION_NOT_IMPLEMENTED',
  message: 'El motor de producción PVC se implementará en Sprint 4.',
};

export const roofingProductionEngine: ProductionEngine = {
  async planOperation(_input: PlanInput): Promise<Result<Plan, DomainError>> {
    return { success: false, error: NOT_IMPLEMENTED };
  },

  async executeOperation(
    _planId: string,
    _executionData: ExecutionData,
  ): Promise<Result<Output, DomainError>> {
    return { success: false, error: NOT_IMPLEMENTED };
  },

  async cancelOperation(
    _operationId: string,
    _reason: string,
  ): Promise<Result<void, DomainError>> {
    return { success: false, error: NOT_IMPLEMENTED };
  },

  async getStatus(operationId: string): Promise<OperationStatus> {
    return { id: operationId, status: 'NOT_IMPLEMENTED', progress: 0 };
  },
};
