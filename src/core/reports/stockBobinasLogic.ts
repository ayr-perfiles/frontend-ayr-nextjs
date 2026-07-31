export interface StockBobinaRow {
  tipo: 'Natural' | 'Prepintado';
  estado: 'ABIERTA' | 'CERRADA';
  espesor: number;
  acabado: string | null;
  proveedor: string | null;
  numBobinas: number;
  pesoKg: number;
  metrajeML: number;
}

export interface CoilInput {
  id: string;
  status?: string;
  isClosed?: boolean;
  finish?: string;
  thickness?: number;
  masterWidth?: number;
  currentWeight?: number;
  provider?: string | null;
}

export interface FinishMetaInput {
  tipo?: string;
  /** Color+RAL ya combinados (derivado del label del finish), solo aplica a Prepintado. */
  acabado?: string | null;
  densityFactor?: number;
}

/** ML = pesoKg / (thicknessMm × masterWidth_mm × densityFactor). Sin dato suficiente => 0, nunca inventa. */
function deriveMetrajeML(coil: CoilInput, finishMeta: FinishMetaInput | undefined): number {
  const weight = coil.currentWeight ?? 0;
  const thickness = coil.thickness ?? 0;
  const masterWidth = coil.masterWidth ?? 0;
  const densityFactor = finishMeta?.densityFactor ?? 0;
  if (thickness <= 0 || masterWidth <= 0 || densityFactor <= 0) return 0;
  return weight / (thickness * masterWidth * densityFactor);
}

/** Stock real: excluye VOIDED y bobinas sin peso físico (PROCESSED consumidas => currentWeight<=0). Mismo criterio que runValorizacionCoils. */
function isStockable(coil: CoilInput): boolean {
  return coil.status !== 'VOIDED' && (coil.currentWeight ?? 0) > 0;
}

export function calculateStockBobinas(input: {
  coils: CoilInput[];
  finishesMap: Record<string, FinishMetaInput>;
}): {
  rows: StockBobinaRow[];
  negativeCoils: { id: string; finish: string; currentWeight: number }[];
} {
  const { coils, finishesMap } = input;

  const groups = new Map<string, StockBobinaRow>();
  const negativeCoils: { id: string; finish: string; currentWeight: number }[] = [];

  for (const coil of coils) {
    if (coil.status !== 'VOIDED' && (coil.currentWeight ?? 0) < 0) {
      negativeCoils.push({
        id: coil.id,
        finish: coil.finish || 'DESCONOCIDO',
        currentWeight: coil.currentWeight!
      });
    }

    if (!isStockable(coil)) continue;
    if (!coil.finish) continue;

    const finishMeta = finishesMap[coil.finish];
    const tipo = finishMeta?.tipo;
    if (tipo !== 'Natural' && tipo !== 'Prepintado') continue;

    const estado: 'ABIERTA' | 'CERRADA' = coil.isClosed === false ? 'ABIERTA' : 'CERRADA';
    const espesor = coil.thickness ?? 0;
    const acabado = tipo === 'Prepintado' ? (finishMeta?.acabado ?? null) : null;
    const proveedor = tipo === 'Prepintado' ? (coil.provider ?? null) : null;

    const key = `${tipo}|${estado}|${espesor}|${acabado ?? ''}|${proveedor ?? ''}`;

    let row = groups.get(key);
    if (!row) {
      row = { tipo, estado, espesor, acabado, proveedor, numBobinas: 0, pesoKg: 0, metrajeML: 0 };
      groups.set(key, row);
    }

    row.numBobinas += 1;
    row.pesoKg += coil.currentWeight ?? 0;
    row.metrajeML += deriveMetrajeML(coil, finishMeta);
  }

  const rows = Array.from(groups.values()).sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo);
    if (a.estado !== b.estado) return a.estado.localeCompare(b.estado);
    if (a.espesor !== b.espesor) return a.espesor - b.espesor;
    const acabadoCmp = (a.acabado ?? '').localeCompare(b.acabado ?? '');
    if (acabadoCmp !== 0) return acabadoCmp;
    return (a.proveedor ?? '').localeCompare(b.proveedor ?? '');
  });

  return { rows, negativeCoils };
}

