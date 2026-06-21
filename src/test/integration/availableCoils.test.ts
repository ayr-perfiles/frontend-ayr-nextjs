import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = 'test-available-coils-' + Date.now();
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import { 
  setupIntegrationTest, 
  clearFirestore, 
  cleanupIntegrationTest, 
  seedCoil, 
  seedFinish
} from './firestore-helpers';
import { listAvailableCoils } from '@/core/coils/services/coilService';
import { db } from '@/lib/firebase/clientApp';

vi.unmock('@/lib/firebase/clientApp');

describe('listAvailableCoils Query (Integration)', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest(null, db);
  });

  beforeEach(async () => {
    await clearFirestore(db);
    // Seed acabados
    await seedFinish(db, { id: 'GALVANIZADO', active: true, lines: ['drywall'] });
    await seedFinish(db, { id: 'ALUZINC', active: true, lines: ['metallic-roofing'] });
    await seedFinish(db, { id: 'NATURAL', active: true, lines: ['metallic-roofing'] });
    await seedFinish(db, { id: 'INACTIVO', active: false, lines: ['drywall'] });
  });

  it('Filtra bobinas por compatibilidad de línea', async () => {
    // Bobinas para drywall
    await seedCoil(db, { id: 'C1', finish: 'GALVANIZADO', status: 'AVAILABLE', currentWeight: 100 });
    // Bobinas para metallic
    await seedCoil(db, { id: 'C2', finish: 'ALUZINC', status: 'AVAILABLE', currentWeight: 200 });
    await seedCoil(db, { id: 'C3', finish: 'NATURAL', status: 'AVAILABLE', currentWeight: 300 });
    // Inactiva
    await seedCoil(db, { id: 'C4', finish: 'INACTIVO', status: 'AVAILABLE', currentWeight: 400 });
    // Sin peso
    await seedCoil(db, { id: 'C5', finish: 'GALVANIZADO', status: 'AVAILABLE', currentWeight: 0 });
    // Ya procesada
    await seedCoil(db, { id: 'C6', finish: 'GALVANIZADO', status: 'PROCESSED', currentWeight: 50 });

    const drywallCoils = await listAvailableCoils('drywall');
    expect(drywallCoils).toHaveLength(1);
    expect(drywallCoils[0].id).toBe('C1');

    const metallicCoils = await listAvailableCoils('metallic-roofing');
    expect(metallicCoils).toHaveLength(2);
    const ids = metallicCoils.map(c => c.id);
    expect(ids).toContain('C2');
    expect(ids).toContain('C3');
  });

  it('No devuelve bobinas sin acabado (finish)', async () => {
    await seedCoil(db, { id: 'C-NO-FINISH', status: 'AVAILABLE', currentWeight: 100 });
    
    const drywallCoils = await listAvailableCoils('drywall');
    expect(drywallCoils.find(c => c.id === 'C-NO-FINISH')).toBeUndefined();
  });
});
