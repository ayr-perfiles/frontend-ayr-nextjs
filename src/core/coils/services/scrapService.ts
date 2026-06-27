import { functions } from "@/lib/firebase/clientApp";
import { httpsCallable } from "firebase/functions";

export interface RegisterScrapParams {
  coilId: string;
  scrapWeightKg: number;
  reason: string;
}

export interface RegisterScrapResult {
  scrapLogId: string;
  newWeight: number;
  scrapCostPEN: number;
  hasNegativeCoilWarning: boolean;
}

export async function registerCoilScrap(
  params: RegisterScrapParams,
): Promise<RegisterScrapResult> {
  const callable = httpsCallable<RegisterScrapParams, RegisterScrapResult>(
    functions,
    "registerCoilScrap"
  );

  try {
    const response = await callable(params);
    return response.data;
  } catch (error: any) {
    if (error?.code) {
      switch (error.code) {
        case "permission-denied":
          throw new Error("Solo un administrador puede registrar mermas.");
        case "not-found":
          throw new Error("La bobina especificada no existe.");
        case "failed-precondition":
          throw new Error("No se puede registrar merma en una bobina anulada o vendida.");
        case "invalid-argument":
          throw new Error(error.message || "Datos inválidos.");
        default:
          throw new Error(error.message || "Ocurrió un error al registrar la merma.");
      }
    }
    throw new Error("Error de red o de servidor al registrar la merma.");
  }
}
