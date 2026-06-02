import { describe, it, expect } from "vitest";
// Nota: Para testear callables de v2 sin el SDK de test completo, 
// a veces es más fácil extraer la lógica pura a un servicio.
// Aquí simularemos el parsing básico.

function parseSireLine(line: string, delimiter: string, mapping: any) {
  const columns = line.split(delimiter).map(c => c.trim());
  const getVal = (field: any) => columns[field] || "";
  
  const fechaStr = getVal(mapping.fechaEmision);
  const [day, month, year] = fechaStr.split("/").map(Number);

  return {
    ruc: getVal(mapping.rucProveedor),
    razonSocial: getVal(mapping.razonSocialProveedor),
    fecha: new Date(year, month - 1, day),
    serie: getVal(mapping.serie),
    numero: getVal(mapping.numero),
    total: parseFloat(getVal(mapping.total)) || 0,
  };
}

describe("SIRE/RCE Parser", () => {
  const mapping = {
    fechaEmision: 2,
    serie: 5,
    numero: 6,
    rucProveedor: 8,
    razonSocialProveedor: 9,
    total: 12,
  };

  it("should parse a valid pipe-delimited line from RCE", () => {
    const line = "202405|20240501|15/05/2024||01|F001|00001234|6|20600000001|PROVEEDOR EJEMPLO S.A.C.|100.00|18.00|118.00|PEN|1.000";
    const result = parseSireLine(line, "|", mapping);

    expect(result.ruc).toBe("20600000001");
    expect(result.razonSocial).toBe("PROVEEDOR EJEMPLO S.A.C.");
    expect(result.serie).toBe("F001");
    expect(result.numero).toBe("00001234");
    expect(result.total).toBe(118.00);
    expect(result.fecha.getDate()).toBe(15);
    expect(result.fecha.getMonth()).toBe(4); // Mayo (0-based)
  });

  it("should handle CSV with semicolon delimiter", () => {
    const line = "202405;20240501;20/05/2024;;01;E001;555;6;20101010101;DISTRIBUIDORA ACERO;200;36;236;PEN;1";
    const result = parseSireLine(line, ";", mapping);

    expect(result.ruc).toBe("20101010101");
    expect(result.total).toBe(236);
    expect(result.serie).toBe("E001");
  });
});
