import type { ProductionEngine, Result, DomainError } from '@/core/contracts';

/**
 * 🔜 PLACEHOLDER. v1 de metallic-roofing NO modela producción (las coberturas se
 * inventarían como producto terminado). El conformado desde bobina se implementa en
 * un sprint posterior. Como el contrato hace `productionEngine` OPCIONAL,
 * este archivo NO se exporta todavía en index.ts.
 */
const notImplemented = (): Result<never, DomainError> => ({
  success: false,
  error: { code: 'NOT_IMPLEMENTED', message: 'Producción de aluzinc aún no implementada.' },
});

export const metallicRoofingProductionEngine: ProductionEngine = {
  async planOperation() {
    return notImplemented();
  },
  async executeOperation() {
    return notImplemented();
  },
  async cancelOperation() {
    return notImplemented();
  },
  async getStatus(operationId: string) {
    return { id: operationId, status: 'NOT_IMPLEMENTED', progress: 0 };
  },
};
