import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.applicationDefault(), // we will pass GOOGLE_APPLICATION_CREDENTIALS
  projectId: 'ayrsteel-test'
});
const db = admin.firestore();

async function check() {
  const collections = ['coils', 'coil_finishes', 'production_logs', 'sales', 'metallic_roofing_catalog', 'metallic_roofing_stock'];
  const counts = {};
  for (const c of collections) {
    const snap = await db.collection(c).count().get();
    counts[c] = snap.data().count;
  }
  console.log("== CONTEOS ==");
  console.log(counts);

  // Finishes
  const finishesSnap = await db.collection('coil_finishes').get();
  console.log("\n== ACABADOS ==");
  console.log(finishesSnap.docs.map(d => d.data().label));

  // production_logs aluzinc
  const prodSnap = await db.collection('production_logs').where('line', '==', 'metallic-roofing').limit(5).get();
  console.log("\n== PROD LOGS METALLIC ==");
  console.log(`Logs encontrados: ${prodSnap.size}`);

  // ventas USD sin TC
  const usdSnap = await db.collection('sales').get();
  const badUsd = usdSnap.docs.filter(d => d.id === 'FFA1-912' || d.id === 'FFA1-913' || d.id === 'FFA1-933' || d.data().metadata?.exchangeRate == null).map(d => d.id);
  console.log("\n== VENTAS USD == ");
  console.log(`Ventas totales (todas): ${usdSnap.size}`);
  
  // Also dry-run simulations:
  // 1. migrate-cobertura
  const cobSnap = await db.collection('metallic_roofing_catalog').where('family', 'in', ['COBERTURA', 'PLANCHA']).get();
  let cobAlready = 0, cobPending = 0;
  for(const d of cobSnap.docs) {
    if(d.data().widthMm !== undefined) cobAlready++;
    else cobPending++;
  }
  console.log(`\n== SIMULATION migrate-cobertura ==`);
  console.log(`Total: ${cobSnap.size}, Ya migrados: ${cobAlready}, Pendientes: ${cobPending}`);

  // 2. fix-density-factor-natural
  const natSnap = await db.collection('metallic_roofing_catalog')
    .where('family', 'in', ['COBERTURA', 'PLANCHA'])
    .where('metaSource', '==', 'parser')
    .where('densityFactor', '==', 0.00785)
    .get();
  console.log(`\n== SIMULATION fix-density-factor-natural ==`);
  console.log(`Afectados: ${natSnap.size}`);

  // 3. fix_skus
  const skusSnap = await db.collection('metallic_roofing_catalog').get();
  let fixSkus = [];
  let cob035 = skusSnap.docs.find(d => d.id === 'COB035GALV');
  for(const d of skusSnap.docs) {
    const data = d.data();
    if(data.family === "BOBINA") fixSkus.push(d.id);
  }
  console.log(`\n== SIMULATION fix_skus ==`);
  console.log(`SKUs familia BOBINA: ${fixSkus.join(', ')}`);
  console.log(`COB035GALV existe: ${cob035 ? 'SI' : 'NO'}`);
}

check().catch(console.error);
