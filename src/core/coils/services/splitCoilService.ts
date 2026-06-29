import { functions } from "@/lib/firebase/clientApp";
import { httpsCallable } from "firebase/functions";

export interface SplitCoilParams {
  coilId: string;
  newChildWidthMm: number;
  requestId: string;
}

export interface SplitCoilResult {
  childId: string;
}

export async function splitCoilAction(
  coilId: string,
  newChildWidthMm: number,
  requestId: string
): Promise<{ childId: string }> {
  const callable = httpsCallable<SplitCoilParams, SplitCoilResult>(
    functions,
    "registerCoilSplit"
  );

  try {
    const response = await callable({ coilId, newChildWidthMm, requestId });
    return response.data;
  } catch (error: any) {
    if (error?.code) {
      const fbCode = error.code.replace('functions/', '');
      switch (fbCode) {
        case "unauthenticated":
          throw new Error("Debes iniciar sesión para realizar esta acción.");
        case "permission-denied":
          throw new Error("No tienes permisos suficientes para dividir bobinas.");
        case "not-found":
          throw new Error("La bobina especificada no existe.");
        case "failed-precondition":
          throw new Error(error.message || "La bobina no cumple las condiciones para dividirse.");
        case "invalid-argument":
          throw new Error(error.message || "Datos inválidos.");
        default:
          throw new Error(error.message || "Ocurrió un error al dividir la bobina.");
      }
    }
    throw new Error("Error de red o de servidor al dividir la bobina.");
  }
}
