import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const TEST_PROJECT_ID = "ayrsteel-test";
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', TEST_PROJECT_ID);

import {
  setupIntegrationTest,
  clearFirestore,
  cleanupIntegrationTest,
  seedCoil,
  seedFinish,
} from './firestore-helpers';
import { produceFromCoils, voidProductionFromCoils } from '@/modules/metallic-roofing/services/productionService';
import { db } from '@/lib/firebase/clientApp';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';

vi.unmock('@/lib/firebase/clientApp');

describe('multi-cut misma bobina (bug fix) - Integration', () => {
  beforeAll(async () => {
    await setupIntegrationTest();
  });

  afterAll(async () => {
    await cleanupIntegrationTest(null, db);
  });

  beforeEach(async () => {
    await clearFirestore(db);
    await seedFinish(db, {
      id: 'ALU-ROJO',
      label: 'ALU-ROJO',
      active: true,
      lines: ['metallic-roofing'],
      densityFactor: 0.00785,
    });
  });

  it('produceFromCoils: resta acumulado y kardex progresivo, no pisa el ultimo update', async () => {
    const initialWeight = 4786;
    const coilId = await seedCoil(db, {
      id: 'TREAM-ALU-ROJO-BUG',
      finish: 'ALU-ROJO',
      initialWeight,
      currentWeight: initialWeight,
      masterWidth: 1220,
      thickness: 0.28,
      pricePerKg: 2.87,
      status: 'AVAILABLE',
    });

    const cut1 = { coilId, declared: 250, reportedWeightKg: 683.2 };
    const cut2 = { coilId, declared: 200, reportedWeightKg: 546.56 };
    const cut3 = { coilId, declared: 300, reportedWeightKg: 819.84 };
    
    const sumConsumed = cut1.reportedWeightKg + cut2.reportedWeightKg + cut3.reportedWeightKg;

    await produceFromCoils({
      targetSku: 'COB030ROJO',
      requestId: "req-multi-" + Date.now(),
      productKind: 'COBERTURA_ML',
      lengthM: null,
      coilInputs: [cut1, cut2, cut3],
      source: { type: 'QUOTE', id: 'COT-TEST' }
    });

    const coilSnap = await getDoc(doc(db, "coils", coilId));
    const coilData = coilSnap.data()!;
    
    expect(coilData.currentWeight).toBeCloseTo(initialWeight - sumConsumed, 4);

    const kSnap = await getDocs(query(collection(db, "kardex_movements"), where("sku", "==", coilId)));
    const movs = kSnap.docs.map(d => d.data());
    expect(movs.length).toBe(3);
    
    const balances = movs.map(m => m.balance).sort((a, b) => b - a);
    
    expect(balances[0]).toBeCloseTo(4102.8, 4);
    expect(balances[1]).toBeCloseTo(3556.24, 4);
    expect(balances[2]).toBeCloseTo(2736.4, 4);
  });

  it('voidProductionFromCoils: suma acumulado y kardex progresivo, no pisa el ultimo update', async () => {
    const initialWeight = 4786;
    const currentBeforeVoid = 2736.4; 
    const coilId = await seedCoil(db, {
      id: 'TREAM-ALU-ROJO-BUG-VOID',
      finish: 'ALU-ROJO',
      initialWeight,
      currentWeight: currentBeforeVoid,
      masterWidth: 1220,
      thickness: 0.28,
      pricePerKg: 2.87,
      status: 'IN_PROGRESS',
    });

    const logId = "LOG-MULTI";
    await (await import('firebase/firestore')).setDoc(doc(db, "production_logs", logId), {
      sku: 'COB030ROJO',
      line: 'metallic-roofing',
      parentCoilIds: [coilId, coilId, coilId],
      parentCoilId: coilId,
      status: 'ACTIVE',
      timestamp: (await import('firebase/firestore')).serverTimestamp(),
      perCoilBreakdown: [
        { coilId, mlFromCoil: 250, weightConsumedKg: 683.2, costPEN: 1000 },
        { coilId, mlFromCoil: 200, weightConsumedKg: 546.56, costPEN: 800 },
        { coilId, mlFromCoil: 300, weightConsumedKg: 819.84, costPEN: 1200 },
      ],
      piecesProduced: 750,
      costPerPiece: 4
    });

    await (await import('firebase/firestore')).setDoc(doc(db, "metallic_roofing_stock", 'COB030ROJO'), {
      quantity: 1000,
      totalValue: 4000,
      avgCost: 4
    });

    await voidProductionFromCoils(logId);

    const coilSnap = await getDoc(doc(db, "coils", coilId));
    const coilData = coilSnap.data()!;
    
    expect(coilData.currentWeight).toBeCloseTo(4786, 4);
    expect(coilData.status).toBe('AVAILABLE');

    const kSnap = await getDocs(query(collection(db, "kardex_movements"), where("sku", "==", coilId)));
    const movs = kSnap.docs.map(d => d.data());
    expect(movs.length).toBe(3); 
    
    const balances = movs.map(m => m.balance).sort((a, b) => a - b); 
    
    expect(balances[0]).toBeCloseTo(3419.6, 4);
    expect(balances[1]).toBeCloseTo(3966.16, 4);
    expect(balances[2]).toBeCloseTo(4786, 4);
  });
  
  it('status de agotamiento en produceFromCoils: agotar a cero da PROCESSED', async () => {
      const initialWeight = 100;
      const coilId = await seedCoil(db, {
          id: 'TREAM-STATUS',
          finish: 'ALU-ROJO',
          initialWeight,
          currentWeight: initialWeight,
          masterWidth: 1220,
          thickness: 0.28,
          pricePerKg: 2.87,
          status: 'AVAILABLE',
      });
      await produceFromCoils({
          targetSku: 'COB030ROJO',
          requestId: "req-status-" + Date.now(),
          productKind: 'COBERTURA_ML',
          lengthM: null,
          coilInputs: [
              { coilId, declared: 50, reportedWeightKg: 40 },
              { coilId, declared: 50, reportedWeightKg: 60 }
          ],
          source: { type: 'QUOTE', id: 'COT-TEST' }
      });
      const coilSnap = await getDoc(doc(db, "coils", coilId));
      expect(coilSnap.data()?.status).toBe('PROCESSED');
      expect(coilSnap.data()?.currentWeight).toBeCloseTo(0, 4);
  });

  it('status en reversa: bobina PROCESSED que se revierte parcialmente queda IN_PROGRESS', async () => {
      const initialWeight = 1000;
      const coilId = await seedCoil(db, {
          id: 'TREAM-STATUS-REV',
          finish: 'ALU-ROJO',
          initialWeight,
          currentWeight: 0,
          masterWidth: 1220,
          thickness: 0.28,
          pricePerKg: 2.87,
          status: 'PROCESSED',
      });

      const logId = "LOG-STATUS-REV";
      await (await import('firebase/firestore')).setDoc(doc(db, "production_logs", logId), {
          sku: 'COB030ROJO',
          line: 'metallic-roofing',
          parentCoilIds: [coilId],
          parentCoilId: coilId,
          status: 'ACTIVE',
          timestamp: (await import('firebase/firestore')).serverTimestamp(),
          perCoilBreakdown: [
              { coilId, mlFromCoil: 100, weightConsumedKg: 200, costPEN: 1000 },
          ],
          piecesProduced: 100,
          costPerPiece: 10
      });

      await (await import('firebase/firestore')).setDoc(doc(db, "metallic_roofing_stock", 'COB030ROJO'), {
          quantity: 1000,
          totalValue: 4000,
          avgCost: 4
      });

      await voidProductionFromCoils(logId);
      
      const coilSnap = await getDoc(doc(db, "coils", coilId));
      expect(coilSnap.data()?.status).toBe('IN_PROGRESS');
      expect(coilSnap.data()?.currentWeight).toBeCloseTo(200, 4);
  });

  it('voidProductionFromCoils: guard de sobre-restauracion levanta warning', async () => {
      const initialWeight = 1000;
      const currentBeforeVoid = 900;
      const coilId = await seedCoil(db, {
          id: 'TREAM-WARNING',
          finish: 'ALU-ROJO',
          initialWeight,
          currentWeight: currentBeforeVoid,
          masterWidth: 1220,
          thickness: 0.28,
          pricePerKg: 2.87,
          status: 'IN_PROGRESS',
      });

      const logId = "LOG-WARNING";
      await (await import('firebase/firestore')).setDoc(doc(db, "production_logs", logId), {
          sku: 'COB030ROJO',
          line: 'metallic-roofing',
          parentCoilIds: [coilId],
          parentCoilId: coilId,
          status: 'ACTIVE',
          timestamp: (await import('firebase/firestore')).serverTimestamp(),
          perCoilBreakdown: [
              { coilId, mlFromCoil: 100, weightConsumedKg: 200, costPEN: 1000 },
          ],
          piecesProduced: 100,
          costPerPiece: 10
      });

      await (await import('firebase/firestore')).setDoc(doc(db, "metallic_roofing_stock", 'COB030ROJO'), {
          quantity: 1000,
          totalValue: 4000,
          avgCost: 4
      });

      const result = await voidProductionFromCoils(logId);
      
      // Debe levantar el warning porque 900 + 200 = 1100 > 1000 (initialWeight)
      expect((result as any).hasOverRestoreWarning).toBe(true);

      const coilSnap = await getDoc(doc(db, "coils", coilId));
      expect(coilSnap.data()?.currentWeight).toBeCloseTo(1100, 4);
  });

  it('ida-y-vuelta (round-trip): produce multi-corte y luego revierte la misma produccion', async () => {
      const initialWeight = 4786;
      const coilId = await seedCoil(db, {
          id: 'TREAM-ROUNDTRIP',
          finish: 'ALU-ROJO',
          initialWeight,
          currentWeight: initialWeight,
          masterWidth: 1220,
          thickness: 0.28,
          pricePerKg: 2.87,
          status: 'AVAILABLE',
      });

      const cut1 = { coilId, declared: 250, reportedWeightKg: 683.2 };
      const cut2 = { coilId, declared: 200, reportedWeightKg: 546.56 };
      const cut3 = { coilId, declared: 300, reportedWeightKg: 819.84 };

      // 1. Producir
      const produceResult = await produceFromCoils({
          targetSku: 'COB030ROJO',
          requestId: "req-roundtrip-" + Date.now(),
          productKind: 'COBERTURA_ML',
          lengthM: null,
          coilInputs: [cut1, cut2, cut3],
          source: { type: 'QUOTE', id: 'COT-TEST' }
      });
      const logId = (produceResult as any).data?.id || (produceResult as any).id; // En callable, si devuelve el id

      // Buscamos el log creado porque produceFromCoils devuelve el ID en la respuesta (depende de cómo esté envuelto en el test)
      // Como estamos llamando a la callable wrapper de frontend, no devuelve data.id, devuelve { success: true }.
      // Vamos a buscar el log creado ordenando por timestamp
      const logsSnap = await getDocs(query(collection(db, "production_logs"), where("parentCoilIds", "array-contains", coilId)));
      const theLogId = logsSnap.docs[0].id;

      // Verificamos estado intermedio
      const coilSnapMid = await getDoc(doc(db, "coils", coilId));
      expect(coilSnapMid.data()?.currentWeight).toBeCloseTo(2736.4, 4);
      expect(coilSnapMid.data()?.status).toBe('IN_PROGRESS');

      // 2. Revertir
      await voidProductionFromCoils(theLogId);

      // Verificamos estado final
      const coilSnapEnd = await getDoc(doc(db, "coils", coilId));
      expect(coilSnapEnd.data()?.currentWeight).toBeCloseTo(initialWeight, 4);
      expect(coilSnapEnd.data()?.status).toBe('AVAILABLE');
  });
});
