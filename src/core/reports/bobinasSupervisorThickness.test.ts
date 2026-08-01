import { describe, it, expect } from 'vitest';
import { buildBobinaRow } from './bobinasSupervisorLogic';

describe('buildBobinaRow - thickness check', () => {
  it('uses exact raw thickness for espesorMm', () => {
    const coil = { id: 'TREAM-ALU-ROJO-RAL-3020-026-4839-00038', thickness: 0.26 };
    const row = buildBobinaRow(coil, {}, 0.008);
    expect(row.espesorMm).toBe(0.26);
  });
});
