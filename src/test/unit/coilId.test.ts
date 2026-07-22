import { describe, it, expect } from 'vitest';
import { generateCoilId } from '../../../functions/src/domain/coilId';

describe('generateCoilId (Domain Helper & Parity)', () => {
  it('1. Genera ID compuesto con formato canonical PROV-ACABADO-ESP-PESO-NNNNN', () => {
    const id = generateCoilId({
      provider: "REPRESENTACIONES JAVI",
      finish: "GALVANIZADO",
      thickness: 0.45,
      weight: 3708,
      counter: 1,
    });
    expect(id).toBe("REPRES-GALVANIZADO-045-3708-00001");
  });

  it('2. Mantiene guiones en el finish y provee provider fallback de 6 chars', () => {
    const id = generateCoilId({
      provider: "PROV SA",
      finish: "ALU-AZUL",
      thickness: 0.38,
      weight: 2000,
      counter: 42,
    });
    expect(id).toBe("PROV-ALU-AZUL-038-2000-00042");
  });

  it('3. Paridad con la lógica inline de registerCoil manual', () => {
    const provider = "REPRESENTACIONES JAVI";
    const finish = "ALU-AZUL";
    const thickness = 0.45;
    const weight = 3708;
    const currentCounter = 123;

    // Lógica inline vieja en coilRegistration.ts:
    const provParts = (provider || "PROV").toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
    const provCode = provParts.length > 0 ? provParts[0].substring(0, 6) : "PROV";
    const safeFinish = finish.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    const esp = Math.round(Number(thickness) * 100).toString().padStart(3, "0");
    const peso = Math.round(Number(weight)).toString();
    const nnnnn = currentCounter.toString().padStart(5, "0");
    const oldInlineId = `${provCode}-${safeFinish}-${esp}-${peso}-${nnnnn}`;

    // Helper nuevo:
    const newHelperId = generateCoilId({
      provider,
      finish,
      thickness,
      weight,
      counter: currentCounter,
    });

    expect(newHelperId).toBe(oldInlineId);
  });
});
