import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { setupIntegrationTest, clearFirestore, cleanupIntegrationTest } from './firestore-helpers';
import { db } from '@/lib/firebase/clientApp';
import { processSale } from '@/core/sales/services/salesService';
import { doc, getDoc, setDoc } from 'firebase/firestore';

vi.unmock('@/lib/firebase/clientApp');

describe('Sales Service with isClosed', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest(null, db);
  });

  beforeEach(async () => {
    await clearFirestore(db);
  });

  it('bobina isClosed=true -> venta (createSale) -> PASA (no bloqueada)', async () => {
    // Setup closed coil
    await setDoc(doc(db, 'coils', 'BOB-VENTA-CLOSED'), {
      id: 'BOB-VENTA-CLOSED',
      status: 'AVAILABLE',
      isClosed: true,
      currentWeight: 1000,
      initialWeight: 1000,
      pricePerKg: 10
    });

    const result = await processSale(
      'Test Customer',
      '12345678',
      [{
        sku: 'BOB-VENTA-CLOSED',
        name: 'Bobina Venta Closed',
        quantity: 1,
        unitPrice: 10000,
        baseCost: 10000,
        isCoil: true,
        businessLine: 'drywall' // fallback
      }],
      'seller-1'
    );

    expect(result.id).toBeDefined();

    // Verificamos que se actualizó el status a SOLD a pesar de estar cerrada
    const coilSnap = await getDoc(doc(db, 'coils', 'BOB-VENTA-CLOSED'));
    expect(coilSnap.data()?.status).toBe('SOLD');
  });
});
