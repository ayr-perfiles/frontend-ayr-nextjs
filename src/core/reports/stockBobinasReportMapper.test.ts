import { describe, it, expect } from 'vitest';
import { mapStockBobinasToReportRows } from './stockBobinasReportMapper';
import { StockBobinaRow } from './stockBobinasLogic';

describe('mapStockBobinasToReportRows', () => {
  it('acabado/proveedor null => "—" (fila Natural); pasan a través cuando hay valor (fila Prepintado)', () => {
    const rows: StockBobinaRow[] = [
      { tipo: 'Natural', estado: 'ABIERTA', espesor: 0.28, acabado: null, proveedor: null, numBobinas: 2, pesoKg: 7000, metrajeML: 1500 },
      { tipo: 'Prepintado', estado: 'CERRADA', espesor: 0.28, acabado: 'ROJO 3020', proveedor: 'TREAM PERU S.A.C.', numBobinas: 1, pesoKg: 3711, metrajeML: 1354.3 },
    ];
    const result = mapStockBobinasToReportRows(rows);
    expect(result[0].acabado).toBe('—');
    expect(result[0].proveedor).toBe('—');
    expect(result[1].acabado).toBe('ROJO 3020');
    expect(result[1].proveedor).toBe('TREAM PERU S.A.C.');
  });
});
