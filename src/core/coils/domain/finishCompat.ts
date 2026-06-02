import { BusinessLine } from "@/types";
import { CoilFinish } from "../services/finishService";
import { Result, DomainError } from "@/core/contracts";

export function assertCoilFinishCompatible(
  coilFinishId: string,
  line: BusinessLine,
  activeFinishes: CoilFinish[]
): Result<void, DomainError> {
  const finish = activeFinishes.find((f) => f.id === coilFinishId);

  if (!finish) {
    return {
      success: false,
      error: {
        code: "COIL_FINISH_NOT_FOUND",
        message: `El acabado '${coilFinishId}' no existe o está inactivo.`,
      },
    };
  }

  if (!finish.active) {
     return {
      success: false,
      error: {
        code: "COIL_FINISH_INACTIVE",
        message: `El acabado '${finish.label}' está inactivo.`,
      },
    };
  }

  if (!finish.lines.includes(line)) {
    return {
      success: false,
      error: {
        code: "COIL_FINISH_MISMATCH",
        message: `El acabado '${finish.label}' no es compatible con la línea ${line}.`,
      },
    };
  }

  return { success: true, data: undefined };
}
