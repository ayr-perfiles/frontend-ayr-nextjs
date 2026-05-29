import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { 
  setupIntegrationTest, 
  clearFirestore, 
  cleanupIntegrationTest, 
  seedCoil, 
  seedFinish
} from './firestore-helpers';
import { listAvailableCoils } from '@/core/coils/services/coilService';

vi.unmock('@/lib/firebase/clientApp');

describe('listAvailableCoils Query (Integration)', () => {
  let testApp: any;
  let testDb: any;

  beforeAll(async () => {
    const { app, db } = await setupIntegrationTest();
    testApp = app;
    testDb = db;
    process.env.NODE_ENV = 'development';
  });

  afterAll(async () => {
    await cleanupIntegrationTest(testApp, testDb);
    process.env.NODE_ENV = 'test';
  });

  beforeEach(async () => {
    await clearFirestore();
    // Seed acabados
    await seedFinish(testDb, { id: 'GALVANIZADO', active: true, lines: ['drywall'] });
    await seedFinish(testDb, { id: 'ALUZINC', active: true, lines: ['metallic-roofing'] });
    await seedFinish(testDb, { id: 'NATURAL', active: true, lines: ['metallic-roofing'] });
    await seedFinish(testDb, { id: 'INACTIVO', active: false, lines: ['drywall'] });
  });

  it('Filtra bobinas por compatibilidad de línea', async () => {
    // Bobinas para drywall
    await seedCoil(testDb, { id: 'C1', finish: 'GALVANIZADO', status: 'AVAILABLE', currentWeight: 100 });
    // Bobinas para metallic
    await seedCoil(testDb, { id: 'C2', finish: 'ALUZINC', status: 'AVAILABLE', currentWeight: 200 });
    await seedCoil(testDb, { id: 'C3', finish: 'NATURAL', status: 'AVAILABLE', currentWeight: 300 });
    // Inactiva
    await seedCoil(testDb, { id: 'C4', finish: 'INACTIVO', status: 'AVAILABLE', currentWeight: 400 });
    // Sin peso
    await seedCoil(testDb, { id: 'C5', finish: 'GALVANIZADO', status: 'AVAILABLE', currentWeight: 0 });
    // Ya procesada
    await seedCoil(testDb, { id: 'C6', finish: 'GALVANIZADO', status: 'PROCESSED', currentWeight: 50 });

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
    await seedCoil(testDb, { id: 'C-NO-FINISH', status: 'AVAILABLE', currentWeight: 100 });
    
    const drywallCoils = await listAvailableCoils('drywall');
    expect(drywallCoils.find(c => c.id === 'C-NO-FINISH')).toBeUndefined();
  });
});
