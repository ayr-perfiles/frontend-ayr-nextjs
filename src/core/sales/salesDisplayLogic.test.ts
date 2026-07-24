import { describe, it, expect } from "vitest";
import { resolveCustomerDoc } from "./salesDisplayLogic";

describe("salesDisplayLogic - resolveCustomerDoc", () => {
  it("Venta nueva del POS (customerDocument presente, documentNumber vacío) -> Extrae rucDni y comprobante es null", () => {
    const sale = {
      customerDocument: "72248284",
      documentNumber: "",
    };
    const result = resolveCustomerDoc(sale);
    expect(result.rucDni).toBe("72248284");
    expect(result.comprobante).toBeNull();
  });

  it("Venta legacy (documentNumber presente, SIN customerDocument) -> Fallback legacy extrae RUC y comprobante es null", () => {
    const sale = {
      customerDocument: undefined,
      documentNumber: "20608931156",
    };
    const result = resolveCustomerDoc(sale);
    expect(result.rucDni).toBe("20608931156");
    expect(result.comprobante).toBeNull();
  });

  it("Venta importada (customerDocument = RUC, documentNumber = BBV1-324) -> Extrae RUC y Comprobante correcto", () => {
    const sale = {
      customerDocument: "76334430",
      documentNumber: "BBV1-324",
    };
    const result = resolveCustomerDoc(sale);
    expect(result.rucDni).toBe("76334430");
    expect(result.comprobante).toBe("BBV1-324");
  });

  it("Venta con ambos vacíos -> rucDni es '---' y comprobante null", () => {
    const sale = {
      customerDocument: "",
      documentNumber: "",
    };
    const result = resolveCustomerDoc(sale);
    expect(result.rucDni).toBe("---");
    expect(result.comprobante).toBeNull();
  });
});
