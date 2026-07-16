import { functions } from '@/lib/firebase/clientApp';
import { httpsCallable } from 'firebase/functions';

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
    /** Solo COBERTURA_ML: desglose cantidad×longitud que originó `declared`. Trazabilidad, no participa en el costeo. */
    piecesCount?: number;
    pieceLengthM?: number;
  }>;
  requestId: string;
  source?: { type: 'QUOTE'; id: string; label?: string } | null;
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

/**
 * Invoca la Callable 'voidProductionFromCoils' en el backend (thin-client).
 */
export async function voidProductionFromCoils(
  logId: string,
): Promise<{ success: boolean }> {
  const callable = httpsCallable<{ logId: string }, { success: boolean }>(
    functions,
    'voidProductionFromCoils',
  );
  try {
    const response = await callable({ logId });
    return response.data;
  } catch (error: any) {
    if (error?.code) {
      switch (error.code) {
        case 'unauthenticated':
          throw new Error('Debes iniciar sesión para anular una producción.');
        case 'permission-denied':
          throw new Error('Solo un administrador puede anular una producción.');
        case 'not-found':
          throw new Error('El registro de producción no existe.');
        case 'failed-precondition':
          throw new Error(error.message || 'No se puede anular esta producción.');
        case 'invalid-argument':
          throw new Error(error.message || 'Datos inválidos.');
        default:
          throw new Error(error.message || 'Error al anular la producción.');
      }
    }
    throw new Error('Error interno del servidor.');
  }
}
