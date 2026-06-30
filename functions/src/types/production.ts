// ⚠️ SYNC MARKER: Este archivo es un port de los tipos de producción del frontend.
// Copia fiel de src/modules/metallic-roofing/domain/coilProduction.ts y src/types (BusinessLine, etc).
// Mantener en sincronía con el frontend.

export type BusinessLine =
  | "drywall"
  | "roofing"
  | "metallic-roofing"
  | "trading"
  | "services";

export interface CoilFinish {
  id: string;
  label: string;
  active: boolean;
  densityFactor?: number;
  lines: BusinessLine[];
}

export interface DomainError {
  code: string;
  message: string;
}

export type Result<T, E = DomainError> =
  | { success: true; data: T }
  | { success: false; error: E };

export interface CoilProductionInput {
  coilId: string;
  declared: number;
  thicknessMm: number;
  masterWidth: number;
  pricePerKg: number;
  coilDensityFactor: number;
  reportedWeightKg?: number;
}

export interface TargetSkuInfo {
  productKind: 'COBERTURA_ML' | 'PLANCHA_UND';
  lengthM: number | null;
}

export interface CoilBreakdown {
  coilId: string;
  mlFromCoil: number;
  weightConsumedKg: number;
  costPEN: number;
}

export interface CoilProductionResult {
  totalMl: number;
  cantidadProducida: number;
  pesoTotalKg: number;
  costoTotalPEN: number;
  costoUnitarioPEN: number;
  perCoilBreakdown: CoilBreakdown[];
}
