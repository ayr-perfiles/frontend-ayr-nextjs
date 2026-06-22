import admin from 'firebase-admin';
import { readFileSync } from 'fs';

async function run() {
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

  console.log("=== PASO 0.2: Verificando coil_finishes/GALV ===");
  const galvDoc = await db.collection('coil_finishes').doc('GALV').get();
  
  if (!galvDoc.exists) {
    console.log("ERROR: El documento coil_finishes/GALV NO existe.");
    return;
  }
  
  const galvData = galvDoc.data();
  console.log(`coil_finishes/GALV data: ${JSON.stringify(galvData)}`);
  
  if (galvData.densityFactor !== 0.00785) {
    console.log(`ERROR: coil_finishes/GALV tiene densityFactor = ${galvData.densityFactor}. Se esperaba 0.00785.`);
    return;
  }
  
  console.log("coil_finishes/GALV está correcto.");
  
  console.log("\n=== PASO 0.3 & 0.4: Evaluando coils ===");
  const coilsSnap = await db.collection('coils').get();
  
  let conformes = 0;
  let noConformes = 0;
  let changes = [];
  
  coilsSnap.docs.forEach(doc => {
    const data = doc.data();
    const currentFinish = data.finish;
    const currentDensity = data.coilDensityFactor !== undefined ? data.coilDensityFactor : data.densityFactor;
    
    if (currentFinish === 'GALV' && currentDensity === 0.00785) {
      conformes++;
    } else {
      noConformes++;
      if (changes.length < 5) {
        changes.push({
          id: doc.id,
          before_finish: currentFinish,
          before_density: currentDensity,
          hasCoilDensityFactor: data.coilDensityFactor !== undefined,
          hasDensityFactor: data.densityFactor !== undefined,
          after_finish: 'GALV',
          after_density: 0.00785
        });
      }
    }
  });
  
  console.log(`Total coils: ${coilsSnap.size}`);
  console.log(`Conformes (skip): ${conformes}`);
  console.log(`No conformes (afectadas): ${noConformes}`);
  console.log("\nMuestra de cambios (Dry-Run):");
  console.table(changes);
}

run().catch(console.error);
