import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';
import { processSale, createQuotation } from '@/core/sales/services/salesService';
import { buildImportWrites } from '@/core/import/salesImportLogic';
import { setupIntegrationTest, clearFirestore, cleanupIntegrationTest } from './firestore-helpers';

vi.unmock('@/lib/firebase/clientApp');

describe('Sales Writers Root Fields (RED PHASE)', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest();
  });

  beforeEach(async () => {
    await clearFirestore();
  });


  it('Los 3 escritores (processSale, createQuotation, buildImportWrites) deben producir el mismo set de campos raíz', async () => {
    // 1. processSale
    const saleResult = await processSale(
      'Test Customer',
      '20123456789',
      '',   // documentNumber (empty for POS sales)
      [
        { sku: 'CAL-001', quantity: 1, unitPrice: 100, baseCost: 50, businessLine: 'metallic-roofing', name: 'Cal', unit: 'UND' }
      ],
      'SELLER1'
    );
    
    // 2. createQuotation
    const quoteResult = await createQuotation(
      'Test Customer',
      '20123456789',
      '',   // documentNumber (empty for POS quotations)
      [
        { sku: 'CAL-001', quantity: 1, unitPrice: 100, baseCost: 50, businessLine: 'metallic-roofing', name: 'Cal', unit: 'UND' }
      ],
      'SELLER1'
    );

    // 3. buildImportWrites (con payload idéntico a import/page.tsx:471)
    const baseDate = new Date("2026-06-15T12:00:00.000Z");
    const importInput = {
      customerName: 'Test Customer',
      customerDocument: '20123456789',
      documentNumber: 'COT-FFA1-1292',
      documentType: 'FACTURA',
      currency: 'PEN',
      exchangeRateApplied: 0,
      sellerId: 'vendedor@ayrsteel.com',
      adjustedDocument: '',
      ncStockAction: 'NONE',
      originalCurrencyAmount: 0,
      paymentStatus: 'PAID',
      businessLines: ['metallic-roofing'],
      allFlags: [],
      skus: ['CAL-001'],
      items: [
        { sku: 'CAL-001', quantity: 1, unitPrice: 100, baseCost: 50, businessLine: 'metallic-roofing', flags: [] }
      ],
      totalAmount: 100,
      totalCost: 50,
      totalProfit: 50,
      totalWeight: 10,
      metadata: { isReplacement: false, uploadedBy: 'test@example.com' },
      timestamp: baseDate
    };
    const { saleDoc: importSaleDoc } = buildImportWrites(importInput, new Date());

    // Fetch from Firestore
    const saleSnap = await getDoc(doc(db, 'sales', saleResult.id));
    const quoteSnap = await getDoc(doc(db, 'sales', quoteResult.id));

    const saleData = saleSnap.data() || {};
    const quoteData = quoteSnap.data() || {};

    const saleKeys = Object.keys(saleData).sort();
    const quoteKeys = Object.keys(quoteData).sort();
    const importKeys = Object.keys(importSaleDoc).sort();

    // Allowlist explícita y justificada de campos exclusivos
    const quoteAllowedExtras = [
      'productionStatus' // Exclusivo de cotizaciones para tracking de pase a producción
    ];
    
    const importAllowedExtras = [
      'metadata',           // Tracking del origen de la importación (archivo, usuario)
      'allFlags',           // Agregación de flags de los items importados
      'relatedQuotationId', // Vinculación a la cotización generada
      'uploadedAt',         // Timestamp de la importación
      'currency',           // Moneda original del documento importado
      'exchangeRateApplied',// Tipo de cambio aplicado en la importación
      'documentType'        // Tipo de comprobante importado
    ];

    const expectedQuoteKeys = [...new Set([...saleKeys, ...quoteAllowedExtras])].sort();
    const expectedImportKeys = [...new Set([...saleKeys, ...importAllowedExtras])].sort();

    expect(quoteKeys).toEqual(expectedQuoteKeys);
    expect(importKeys).toEqual(expectedImportKeys);
  });
});
