import admin from 'firebase-admin';
import { readFileSync } from 'fs';

async function run() {
  console.log("=== APPLY: INICIANDO MIGRACIÓN ===");

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const serviceAccount = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf-8"));
    console.log(`[INIT] Target Project: ${serviceAccount.project_id}`);
    if (serviceAccount.project_id !== 'ayrsteel-test') {
      console.error("ABORT: Not pointing to ayrsteel-test!");
      process.exit(1);
    }
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'ayrsteel-test'
  });
  const db = admin.firestore();

  const galvDoc = await db.collection('coil_finishes').doc('GALV').get();
  if (!galvDoc.exists) {
    console.log("ERROR: El documento coil_finishes/GALV NO existe.");
    process.exit(1);
  }
  
  const targetDensityFactor = galvDoc.data().densityFactor;
  if (!targetDensityFactor) {
    console.log("ERROR: coil_finishes/GALV no tiene densityFactor.");
    process.exit(1);
  }

  const coilsSnap = await db.collection('coils').get();
  
  const batches = [];
  let currentBatch = db.batch();
  let opCount = 0;
  let affected = 0;
  let skipped = 0;

  coilsSnap.docs.forEach(doc => {
    const data = doc.data();
    const currentFinish = data.finish;
    const currentDensity = data.densityFactor;
    
    // Guard idempotente
    if (currentFinish === 'GALV' && currentDensity === targetDensityFactor) {
      skipped++;
      return;
    }

    affected++;
    currentBatch.update(doc.ref, {
      finish: 'GALV',
      densityFactor: targetDensityFactor,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    opCount++;
    if (opCount === 400) {
      batches.push(currentBatch);
      currentBatch = db.batch();
      opCount = 0;
    }
  });

  if (opCount > 0) {
    batches.push(currentBatch);
  }

  console.log(`Total a procesar: ${affected} | Skipped: ${skipped}`);
  console.log(`Ejecutando ${batches.length} batches...`);

  for (let i = 0; i < batches.length; i++) {
    await batches[i].commit();
    console.log(`Batch ${i + 1} commited.`);
  }

  console.log("=== MIGRACIÓN COMPLETADA ===");
}

run().catch(console.error);
