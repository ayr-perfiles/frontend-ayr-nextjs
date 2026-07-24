import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/clientApp';
import { getCustomerProfile } from '@/services/crmService';
import { setupIntegrationTest, clearFirestore, cleanupIntegrationTest } from './firestore-helpers';

vi.unmock('@/lib/firebase/clientApp');

describe('getCustomerProfile — cubre ventas legacy (documentNumber) y nuevas (customerDocument)', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest();
  });

  beforeEach(async () => {
    await clearFirestore();
  });

  it('devuelve TANTO ventas legacy (documentNumber == RUC) COMO ventas nuevas del POS (customerDocument == RUC, documentNumber vacío)', async () => {
    const RUC = '00075334';

    await setDoc(doc(db, 'customers', RUC), {
      name: 'Cliente Test',
      documentNumber: RUC,
    });

    // Venta legacy (pre-refactor): el RUC vivía en documentNumber
    await setDoc(doc(db, 'sales', 'C-000025'), {
      documentNumber: RUC,
      customerName: 'Cliente Test',
      status: 'QUOTATION',
      totalAmount: 100,
      timestamp: Timestamp.fromDate(new Date('2026-07-18T19:09:50.928Z')),
    });

    // Venta nueva del POS (post-refactor): RUC en customerDocument, documentNumber vacío
    await setDoc(doc(db, 'sales', 'V-000065'), {
      documentNumber: '',
      customerDocument: RUC,
      customerName: 'Cliente Test',
      status: 'COMPLETED',
      totalAmount: 200,
      timestamp: Timestamp.fromDate(new Date('2026-07-24T02:13:25.638Z')),
    });

    const profile = await getCustomerProfile(RUC);

    expect(profile).not.toBeNull();
    const ids = (profile!.salesHistory || []).map((s: any) => s.id);

    expect(ids).toContain('C-000025'); // legacy
    expect(ids).toContain('V-000065'); // nueva del POS — hoy invisible
    expect(ids.length).toBe(2);
  });
});
