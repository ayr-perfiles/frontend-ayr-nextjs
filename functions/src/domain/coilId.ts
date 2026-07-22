export interface CoilIdParams {
  provider: string | null | undefined;
  finish: string;
  thickness: number;
  weight: number;
  counter: number;
}

/**
 * Genera el ID compuesto canónico para una bobina:
 * PROV-ACABADO-ESP-PESO-NNNNN
 */
export function generateCoilId(params: CoilIdParams): string {
  const provParts = (params.provider || "PROV")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const provCode = provParts.length > 0 ? provParts[0].substring(0, 6) : "PROV";

  const safeFinish = (params.finish || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");

  const esp = Math.round(Number(params.thickness) * 100)
    .toString()
    .padStart(3, "0");

  const peso = Math.round(Number(params.weight)).toString();

  const nnnnn = Number(params.counter).toString().padStart(5, "0");

  return `${provCode}-${safeFinish}-${esp}-${peso}-${nnnnn}`;
}
