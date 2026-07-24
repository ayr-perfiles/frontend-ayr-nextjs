import { describe, it, expect } from 'vitest';
import { buildSaleDoc, buildQuotationDoc, CanonicalSaleDoc, CanonicalQuotationDoc } from './saleDocBuilder';

describe('Canonical Sale Doc Builders (RED PHASE)', () => {
  it('1. buildSaleDoc con RUC en el input -> documentNumber === "" y customerDocument === el RUC', () => {
    const input = {
      documentNumber: '20123456789', // Input legacy simulating RUC
      items: [],
    };
    const result = buildSaleDoc(input, null);
    expect(result.customerDocument).toBe('20123456789');
    expect(result.documentNumber).toBe('');
  });

  it('2. businessLines derivado de items siempre presente y no vacío, incluso si el ítem no trae businessLine explícito', () => {
    const input = {
      items: [
        { sku: 'COB040ROJO', productName: 'Cobertura Roja' }, 
        { sku: 'PL030NT6M', productName: 'Plancha' }, 
        { sku: 'P64GALV045', productName: 'Parante' }
      ],
    };
    const sale = buildSaleDoc(input, null);
    const quote = buildQuotationDoc(input, null);

    expect(sale.businessLines).toContain('metallic-roofing');
    expect(sale.businessLines).toContain('drywall');
    expect(quote.businessLines).toContain('metallic-roofing');
    expect(quote.businessLines).toContain('drywall');
  });

  it('3. profit por ítem: baseCost 0 -> profit 0; baseCost real -> margen correcto. Caso mixto.', () => {
    const input = {
      items: [
        { sku: 'A', quantity: 2, unitPrice: 100, baseCost: 0 }, // Profit 0 (sin costo)
        { sku: 'B', quantity: 3, unitPrice: 150, baseCost: 100 }, // Profit (150-100)*3 = 150
      ],
    };
    const result = buildSaleDoc(input, null);
    
    expect(result.items[0].profit).toBe(0);
    expect(result.items[1].profit).toBe(150);
    expect(result.totalProfit).toBe(150);
  });

  it('4. ítem sin weightSnapshot -> flag "sin peso"; con weightSnapshot -> sin flag', () => {
    const input = {
      items: [
        { sku: 'A', weightSnapshot: 10, businessLine: 'metallic-roofing' },
        { sku: 'B', businessLine: 'metallic-roofing' }, // Sin weightSnapshot
      ],
    };
    const result = buildSaleDoc(input, null);

    expect(result.items[0].flags ?? []).not.toContain('sin peso');
    expect(result.items[1].flags).toContain('sin peso'); // Wait, only for metallic-roofing
  });

  it('5. buildQuotationDoc -> productionStatus PENDING; buildSaleDoc -> sin ese campo', () => {
    const quote = buildQuotationDoc({}, null);
    const sale = buildSaleDoc({}, null);

    expect(quote.productionStatus).toBe('PENDING');
    expect((sale as any).productionStatus).toBeUndefined();
  });

  it('6. Tipado: debe ser imposible construir omitiendo un campo obligatorio', () => {
    const validSale: CanonicalSaleDoc = {
      status: 'COMPLETED',
      customerName: 'A',
      customerDocument: '1',
      documentNumber: '',
      contactName: '',
      contactPhone: '',
      customerAddress: '',
      businessLines: ['drywall'],
      skus: ['A'],
      items: [],
      totalAmount: 0,
      totalCost: 0,
      totalProfit: 0,
      totalWeight: 0,
      allFlags: [],
      paymentStatus: 'PAID',
      sellerId: 'V1',
      timestamp: null,
    };
    expect(validSale).toBeDefined();
  });

  it('7. NC: input.totalAmount/totalCost/totalProfit/totalWeight negativos se RESPETAN aunque los items sean positivos', () => {
    const input = {
      items: [
        { sku: 'A', quantity: 10, unitPrice: 118, unitValue: 100, baseCost: 80, calculatedWeight: 50 },
      ],
      totalAmount: -1180,
      totalCost: -800,
      totalProfit: -200,
      totalWeight: 0,
    };
    const result = buildSaleDoc(input, null);

    expect(result.totalAmount).toBe(-1180);
    expect(result.totalCost).toBe(-800);
    expect(result.totalProfit).toBe(-200);
    expect(result.totalWeight).toBe(0);
  });

  it('8. Sin totales en el input (caso POS) -> se calculan desde items (anti-regresión)', () => {
    const input = {
      items: [
        { sku: 'A', quantity: 2, unitPrice: 100, baseCost: 60, calculatedWeight: 5 },
        { sku: 'B', quantity: 1, unitPrice: 50, baseCost: 30, calculatedWeight: 2 },
      ],
    };
    const result = buildSaleDoc(input, null);

    expect(result.totalAmount).toBe(250); // 2*100 + 1*50
    expect(result.totalCost).toBe(150);   // 2*60 + 1*30
    expect(result.totalProfit).toBe(100); // (100-60)*2 + (50-30)*1
    expect(result.totalWeight).toBe(7);   // 5 + 2
  });

  it('9. totalAmount = 0 explícito se RESPETA (0 es un total legítimo, no ausencia)', () => {
    const input = {
      items: [
        { sku: 'A', quantity: 1, unitPrice: 999, baseCost: 0 },
      ],
      totalAmount: 0,
      totalCost: 0,
      totalProfit: 0,
      totalWeight: 0,
    };
    const result = buildSaleDoc(input, null);

    expect(result.totalAmount).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.totalProfit).toBe(0);
    expect(result.totalWeight).toBe(0);
  });

  it('10. RUC movido de documentNumber a customerDocument -> allFlags incluye "documento reubicado"', () => {
    const input = {
      documentNumber: '20123456789',
      items: [],
    };
    const result = buildSaleDoc(input, null);

    expect(result.customerDocument).toBe('20123456789');
    expect(result.documentNumber).toBe('');
    expect(result.allFlags).toContain('documento reubicado');
  });

  it('10b. Sin heurístico RUC disparado -> allFlags NO incluye "documento reubicado"', () => {
    const input = {
      documentNumber: 'FFA1-1262',
      customerDocument: '20123456789',
      items: [],
    };
    const result = buildSaleDoc(input, null);

    expect(result.allFlags).not.toContain('documento reubicado');
  });

  it('11. NC: item.profit firmado (negativo) en el input se respeta, no se recalcula', () => {
    const input = {
      items: [
        { sku: 'A', quantity: 10, unitPrice: 118, unitValue: 100, baseCost: 80, profit: -200 },
      ],
    };
    const result = buildSaleDoc(input, null);

    expect(result.items[0].profit).toBe(-200);
    expect(result.totalProfit).toBe(-200);
  });

  it('12. item.profit ausente -> se calcula como antes (anti-regresión)', () => {
    const input = {
      items: [
        { sku: 'B', quantity: 3, unitPrice: 150, baseCost: 100 }, // Profit (150-100)*3 = 150
      ],
    };
    const result = buildSaleDoc(input, null);

    expect(result.items[0].profit).toBe(150);
    expect(result.totalProfit).toBe(150);
  });
});
