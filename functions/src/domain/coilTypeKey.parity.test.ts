import { describe, it, expect } from 'vitest';
import { buildCoilTypeKey } from './coilTypeKey';
import { buildCoilTypeKey as clientBuildCoilTypeKey } from '../../../src/core/coils/domain/coilTypeKey';

describe('buildCoilTypeKey — parity cliente/servidor', () => {
  const cases: Array<{ input: { finish: string; thickness: number }; expected: string }> = [
    { input: { finish: 'GALV', thickness: 0.45 }, expected: 'BOB-GALV-045' },
    { input: { finish: 'GALV', thickness: 0.42 }, expected: 'BOB-GALV-042' },
    { input: { finish: 'X', thickness: 1.2 }, expected: 'BOB-X-120' },
    { input: { finish: 'galv', thickness: 0.45 }, expected: 'BOB-GALV-045' },
    { input: { finish: 'ALZ-AZUL', thickness: 0.45000000000001 }, expected: 'BOB-ALZAZUL-045' },
  ];

  for (const { input, expected } of cases) {
    it(`(${input.finish}, ${input.thickness}) -> ${expected}, igual en cliente y servidor`, () => {
      const serverResult = buildCoilTypeKey(input);
      const clientResult = clientBuildCoilTypeKey(input);
      expect(serverResult).toBe(expected);
      expect(serverResult).toBe(clientResult);
    });
  }

  it('finish vacío: lanza igual en ambas copias', () => {
    expect(() => buildCoilTypeKey({ finish: '', thickness: 0.45 })).toThrow();
    expect(() => clientBuildCoilTypeKey({ finish: '', thickness: 0.45 })).toThrow();
  });

  it('thickness <= 0: lanza igual en ambas copias', () => {
    expect(() => buildCoilTypeKey({ finish: 'GALV', thickness: 0 })).toThrow();
    expect(() => clientBuildCoilTypeKey({ finish: 'GALV', thickness: 0 })).toThrow();
  });
});
