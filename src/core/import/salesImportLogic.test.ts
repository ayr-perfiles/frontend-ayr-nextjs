import { describe, it, expect } from "vitest";
import { buildImportWrites, isImportedQuotation } from "./salesImportLogic";


describe("buildImportWrites - Cotización Aluzinc en Importador (RED PHASE)", () => {
  const sampleMetallicSale = {
    documentNumber: "FFA1-1262",
    customerName: "MADICOP S.A.C.",
    customerDocument: "20601234567",
    status: "COMPLETED",
    sellerId: "SISTEMA",
    currency: "PEN",
    exchangeRateApplied: 1,
    documentType: "FACTURA",
    adjustedDocument: "",
    ncStockAction: "MONEY_ONLY",
    originalCurrencyAmount: 0,
    timestamp: new Date("2026-06-05T17:00:00.000Z"),
    items: [
      {
        sku: "COB030ROJO",
        productName: "COBERTURA ALUZINC 0.30MM ROJO",
        quantity: 100,
        unitPrice: 12,
        unitValue: 10.169,
        baseCost: 0,
        unitWeight: 0,
        calculatedWeight: 0,
        unitOfMeasure: "METRO LINEAL",
        businessLine: "metallic-roofing",
        isCoil: false,
        flags: ["sin costo"],
      },
    ],
    totalAmount: 1200,
    totalCost: 0,
    totalProfit: 0, // sin costo -> profit 0 (no asumir 100% margen), no 10.169*100
    totalWeight: 0,
    paymentStatus: "PAID",
    businessLines: ["metallic-roofing"],
    allFlags: ["sin costo"],
  };

  const sampleMixedSale = {
    documentNumber: "BBV1-316",
    customerName: "QUIROZ CARRANZA CRISTOBAL ELEAZAR",
    customerDocument: "09475275",
    status: "COMPLETED",
    sellerId: "SISTEMA",
    currency: "PEN",
    exchangeRateApplied: 1,
    documentType: "BOLETA",
    adjustedDocument: "",
    ncStockAction: "MONEY_ONLY",
    originalCurrencyAmount: 0,
    timestamp: new Date("2026-06-04T17:00:00.000Z"),
    items: [
      {
        sku: "P25GALV",
        productName: "PARANTE 25 GALV",
        quantity: 50,
        unitPrice: 10,
        unitValue: 8.47,
        baseCost: 5,
        unitWeight: 1.2,
        calculatedWeight: 60,
        unitOfMeasure: "UNIDAD",
        businessLine: "drywall",
        isCoil: false,
        flags: [],
      },
      {
        sku: "COB030ROJO",
        productName: "COBERTURA ALUZINC 0.30MM ROJO",
        quantity: 30,
        unitPrice: 12,
        unitValue: 10.169,
        baseCost: 0,
        unitWeight: 0,
        calculatedWeight: 0,
        unitOfMeasure: "METRO LINEAL",
        businessLine: "metallic-roofing",
        isCoil: false,
        flags: ["sin costo"],
      },
    ],
    totalAmount: 860,
    totalCost: 250,
    totalProfit: 173.5, // drywall (8.47-5)*50=173.5 + aluzinc sin costo 0
    totalWeight: 60,
    paymentStatus: "PAID",
    businessLines: ["drywall", "metallic-roofing"],
    allFlags: ["sin costo"],
  };

  const sampleDrywallOnlySale = {
    documentNumber: "FFA1-1000",
    customerName: "CONSTRUCTORA PERU S.A.C.",
    customerDocument: "20100000000",
    status: "COMPLETED",
    sellerId: "SISTEMA",
    currency: "PEN",
    exchangeRateApplied: 1,
    documentType: "FACTURA",
    timestamp: new Date("2026-06-01T17:00:00.000Z"),
    items: [
      {
        sku: "P25GALV",
        productName: "PARANTE 25 GALV",
        quantity: 100,
        unitPrice: 10,
        unitValue: 8.47,
        baseCost: 5,
        unitWeight: 1.2,
        calculatedWeight: 120,
        unitOfMeasure: "UNIDAD",
        businessLine: "drywall",
        isCoil: false,
        flags: [],
      },
    ],
    totalAmount: 1000,
    totalCost: 500,
    totalProfit: 347,
    totalWeight: 120,
    paymentStatus: "PAID",
    businessLines: ["drywall"],
    allFlags: [],
  };

  // 1. Factura con >= 1 item metallic-roofing -> quotationDoc NO null
  it("1. Factura con >= 1 item metallic-roofing devuelve quotationDoc NO null", () => {
    const result = buildImportWrites(sampleMetallicSale);
    expect(result.quotationDoc).not.toBeNull();
  });

  // 2. Tabla de casos para predicado hasMetallicItem (recorre TODO items[])
  it("2. Predicado de detección de aluzinc recorre TODO items[]", () => {
    const drywallOnly = { ...sampleDrywallOnlySale, items: [{ sku: "P25", businessLine: "drywall" }] };
    const roofingOnly = { ...sampleDrywallOnlySale, items: [{ sku: "ROOF1", businessLine: "roofing" }] };
    const tradingOnly = { ...sampleDrywallOnlySale, items: [{ sku: "TRAD1", businessLine: "trading" }] };
    const servicesOnly = { ...sampleDrywallOnlySale, items: [{ sku: "SERV1", businessLine: "services" }] };

    expect(buildImportWrites(drywallOnly).quotationDoc).toBeNull();
    expect(buildImportWrites(roofingOnly).quotationDoc).toBeNull();
    expect(buildImportWrites(tradingOnly).quotationDoc).toBeNull();
    expect(buildImportWrites(servicesOnly).quotationDoc).toBeNull();

    // Metallic en PRIMERA posición -> quotationDoc NO null
    const metallicFirst = {
      ...sampleDrywallOnlySale,
      items: [
        { sku: "COB030ROJO", businessLine: "metallic-roofing" },
        { sku: "P25", businessLine: "drywall" },
      ],
    };
    expect(buildImportWrites(metallicFirst).quotationDoc).not.toBeNull();

    // Metallic en ÚLTIMA posición -> quotationDoc NO null (demuestra que no solo lee items[0])
    const metallicLast = {
      ...sampleDrywallOnlySale,
      items: [
        { sku: "P25", businessLine: "drywall" },
        { sku: "COB030ROJO", businessLine: "metallic-roofing" },
      ],
    };
    expect(buildImportWrites(metallicLast).quotationDoc).not.toBeNull();
  });


  // 3. Ningún documento (saleDoc / quotationDoc) incluye el campo 'id' en el payload
  it("3. Ningún documento (saleDoc / quotationDoc) incluye el campo 'id' en el payload", () => {
    const result1 = buildImportWrites(sampleMetallicSale);
    expect(result1.saleDoc).not.toHaveProperty("id");
    expect(result1.quotationDoc).not.toHaveProperty("id");
  });


  // 4. quotationDoc.status === "QUOTATION"; saleDoc.status === "COMPLETED"
  it("4. quotationDoc.status es QUOTATION y saleDoc.status es COMPLETED", () => {
    const result = buildImportWrites(sampleMetallicSale);
    expect(result.quotationDoc?.status).toBe("QUOTATION");
    expect(result.saleDoc?.status).toBe("COMPLETED");
  });

  // 5. FACTURA COMPLETA: quotationDoc.items.length === saleDoc.items.length
  it("5. FACTURA COMPLETA: quotationDoc conserva todos los ítems de la venta (caso mixto)", () => {
    const result = buildImportWrites(sampleMixedSale);
    expect(result.quotationDoc?.items?.length).toBe(sampleMixedSale.items.length);
    expect(result.quotationDoc?.items?.length).toBe(2);
  });

  // 6. quotationDoc.businessLines incluye "metallic-roofing"
  it("6. quotationDoc.businessLines incluye metallic-roofing", () => {
    const result = buildImportWrites(sampleMetallicSale);
    expect(result.quotationDoc?.businessLines).toContain("metallic-roofing");
  });

  // 7. Vínculo bidireccional: saleDoc.relatedQuotationId === quotationDoc.id Y quotationDoc.relatedSaleId === saleDoc.id
  it("7. Vínculo bidireccional entre saleDoc y quotationDoc", () => {
    const result = buildImportWrites(sampleMetallicSale);
    expect(result.saleDoc?.relatedQuotationId).toBe("COT-FFA1-1262");
    expect(result.quotationDoc?.relatedSaleId).toBe("FFA1-1262");
  });

  // 8. Timestamp histórico preservado
  it("8. Timestamp de quotationDoc preserva la fecha histórica de la venta", () => {
    const fixedTs = new Date("2026-06-05T17:00:00.000Z");
    const result = buildImportWrites(sampleMetallicSale, fixedTs);
    expect(result.quotationDoc?.timestamp).toEqual(fixedTs);
  });

  // 9. NO consumo de correlativo: NO contiene quotationNumber ni referencia a nextQuotationNumber
  it("9. Cotización devuelta NO contiene quotationNumber ni referencia a nextQuotationNumber", () => {
    const result = buildImportWrites(sampleMetallicSale);
    expect(result.quotationDoc).not.toHaveProperty("quotationNumber");
    expect(result.quotationDoc).not.toHaveProperty("nextQuotationNumber");
  });

  // 10. Flag 'sin peso' en items con weight 0
  it("10. Item metallic con weight 0 genera flag 'sin peso' en item y allFlags", () => {
    const result = buildImportWrites(sampleMetallicSale);
    const metallicItem = result.saleDoc?.items?.find((i: any) => i.businessLine === "metallic-roofing");
    expect(metallicItem?.flags).toContain("sin peso");
    expect(result.saleDoc?.allFlags).toContain("sin peso");
  });

  // 11. Profit por ítem: item sin costo aporta 0 profit; aluzinc puro profit === 0
  it("11. Ítem sin costo (baseCost 0 / 'sin costo') aporta 0 profit (totalProfit puro aluzinc === 0)", () => {
    const resultPure = buildImportWrites(sampleMetallicSale);
    expect(resultPure.saleDoc?.totalProfit).toBe(0);

    const resultMixed = buildImportWrites(sampleMixedSale);
    // Caso mixto: drywall (valor 8.47 * 50 = 423.5, costo 5 * 50 = 250 -> profit 173.5)
    // metallic aluzinc sin costo -> profit 0
    // Total profit esperado = 173.5
    expect(resultMixed.saleDoc?.totalProfit).toBeCloseTo(173.5, 2);
  });

  // 12. Cotización NO descuenta stock
  it("12. quotationDoc NO posee instrucciones de decremento de stock", () => {
    const { quotationDoc } = buildImportWrites(sampleMetallicSale);

    expect(quotationDoc?.decrementsStock).not.toBe(true);
    expect(quotationDoc?.stockAction).toBeUndefined();
  });


  // RED TEST 1: saleDoc y quotationDoc NO deben tener la propiedad 'id' en su payload interno
  it("RED 1: saleDoc y quotationDoc NO contienen la propiedad 'id' en el payload", () => {
    const { saleDoc, quotationDoc } = buildImportWrites(sampleMetallicSale);

    expect(saleDoc).not.toHaveProperty("id"); // FAILS IN RED! Currently saleDoc has id: "FFA1-1262"
    expect(quotationDoc).not.toHaveProperty("id"); // FAILS IN RED! Currently quotationDoc has id: "COT-FFA1-1262"
  });

  // RED TEST 2: Predicado isImportedQuotation(sale) tabla de casos
  it("RED 2: isImportedQuotation(sale) identifica cotizaciones importadas vs comerciales", () => {
    // Caso 1: Cotización importada con relatedSaleId
    expect(isImportedQuotation({ relatedSaleId: "BBV1-316", status: "QUOTATION" })).toBe(true);

    // Caso 2: Cotización importada con metadata.isQuotation
    expect(isImportedQuotation({ metadata: { isQuotation: true }, status: "QUOTATION" })).toBe(true);

    // Caso 3: Cotización comercial normal (C-000024, sin relatedSaleId ni metadata.isQuotation)
    expect(isImportedQuotation({ documentNumber: "72248285", status: "QUOTATION", sellerId: "demo@cliente.com" })).toBe(false);

    // Caso 4: Venta directa normal (sin status QUOTATION ni relatedSaleId)
    expect(isImportedQuotation({ documentNumber: "V-000061", status: "COMPLETED" })).toBe(false);

    // Caso 5: Objetos nulos / indefinidos
    expect(isImportedQuotation(null)).toBe(false);
    expect(isImportedQuotation(undefined)).toBe(false);
  });

  // RED TEST 3 (Frente 1 - productionStatus): la cotización COT- nace CONFIRMED, no PENDING
  it("RED 3: quotationDoc.productionStatus es CONFIRMED (la venta ya existe, nada que confirmar)", () => {
    const result = buildImportWrites(sampleMetallicSale);

    expect(result.quotationDoc).not.toBeNull();
    // FAILS IN RED! buildImportWrites todavía no escribe el campo productionStatus.
    expect(result.quotationDoc?.productionStatus).toBe("CONFIRMED");
  });
});
