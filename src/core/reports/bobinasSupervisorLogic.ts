export interface CoilRow {
  id: string;
  und: number;
  espesorMm: number;
  anchoM: number;
  acabado: string;
  proveedor: string;
  empresa: string;
  pesoKg: number;
  metrajeML: number;
  fechaFactura: Date | null;
}

export interface SupervisorReportResult {
  abiertas: CoilRow[];
  cerradas: CoilRow[];
  subAbiertas: { count: number; pesoKg: number; metrajeML: number };
  subCerradas: { count: number; pesoKg: number; metrajeML: number };
}

export function classifyBobina(coil: any): 'ABIERTA' | 'CERRADA' | null {
  if (coil.status === 'VOIDED') return null;
  if (!coil.finish || (!coil.finish.startsWith('ALZ-') && !coil.finish.startsWith('ALU-'))) return null;

  const currentWeight = coil.currentWeight ?? 0;
  const initialWeight = coil.initialWeight ?? 0;

  if (coil.isClosed === false && currentWeight > 0) return 'ABIERTA';
  if ((coil.isClosed === true || coil.isClosed === undefined) && Math.abs(currentWeight - initialWeight) < 0.01) return 'CERRADA';
  
  return null;
}

export function normalizeInvoiceDate(raw: any): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw.toDate === 'function') {
    const d = raw.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw.seconds === 'number') {
    return new Date(raw.seconds * 1000);
  }
  if (typeof raw._seconds === 'number') {
    return new Date(raw._seconds * 1000);
  }
  if (typeof raw === 'string') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function filterByMonth(coil: any, monthKey: string): boolean {
  if (monthKey === 'ALL') return true;
  const d = normalizeInvoiceDate(coil.metadata?.invoiceDate);
  if (!d) return false;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}` === monthKey;
}

export function deriveMetrajeML(coil: any, densityFactor: number): number {
  const weight = coil.currentWeight ?? 0;
  const thickness = coil.thickness ?? 0;
  const masterWidth = coil.masterWidth ?? 0;
  if (thickness <= 0 || masterWidth <= 0 || densityFactor <= 0) return 0;
  return weight / (thickness * masterWidth * densityFactor);
}

export function buildBobinaRow(coil: any, finishMeta: any, densityFactor: number): CoilRow {
  return {
    id: coil.id,
    und: 1,
    espesorMm: coil.thickness ?? 0,
    anchoM: (coil.masterWidth ?? 0) / 1000,
    acabado: coil.finish ?? '—',
    proveedor: coil.metadata?.provider ?? '—',
    empresa: 'PERFILES',
    pesoKg: coil.currentWeight ?? 0,
    metrajeML: deriveMetrajeML(coil, densityFactor),
    fechaFactura: normalizeInvoiceDate(coil.metadata?.invoiceDate)
  };
}

export function buildSupervisorReport(coils: any[], finishesMap: Record<string, any>, monthKey: string = 'ALL'): SupervisorReportResult {
  const abiertas: CoilRow[] = [];
  const cerradas: CoilRow[] = [];
  
  const subAbiertas = { count: 0, pesoKg: 0, metrajeML: 0 };
  const subCerradas = { count: 0, pesoKg: 0, metrajeML: 0 };

  for (const coil of coils) {
    if (!filterByMonth(coil, monthKey)) continue;

    const classification = classifyBobina(coil);
    if (!classification) continue;

    const finishMeta = finishesMap[coil.finish] || {};
    const densityFactor = finishMeta.densityFactor ?? 0;

    const row = buildBobinaRow(coil, finishMeta, densityFactor);

    if (classification === 'ABIERTA') {
      abiertas.push(row);
      subAbiertas.count++;
      subAbiertas.pesoKg += row.pesoKg;
      subAbiertas.metrajeML += row.metrajeML;
    } else {
      cerradas.push(row);
      subCerradas.count++;
      subCerradas.pesoKg += row.pesoKg;
      subCerradas.metrajeML += row.metrajeML;
    }
  }

  const sortFn = (a: CoilRow, b: CoilRow) => {
    if (a.espesorMm !== b.espesorMm) return a.espesorMm - b.espesorMm;
    const colorCmp = a.acabado.localeCompare(b.acabado);
    if (colorCmp !== 0) return colorCmp;
    return b.pesoKg - a.pesoKg; // desc
  };

  abiertas.sort(sortFn);
  cerradas.sort(sortFn);

  return { abiertas, cerradas, subAbiertas, subCerradas };
}
