import admin from 'firebase-admin';

// Check target projectId
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const fs = await import("fs");
  const serviceAccount = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf-8"));
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

async function runAudit() {
  const results = {};
  
  const addResult = (group, check, isConform, id) => {
    if (!results[group]) results[group] = {};
    if (!results[group][check]) results[group][check] = { conform: 0, nonConform: 0, nonConformIds: [] };
    
    if (isConform) {
      results[group][check].conform++;
    } else {
      results[group][check].nonConform++;
      if (results[group][check].nonConformIds.length < 3) {
        results[group][check].nonConformIds.push(id);
      }
    }
  };

  // FETCH DATA
  const logsSnap = await db.collection('production_logs').get();
  const salesSnap = await db.collection('sales').get();
  const coilsSnap = await db.collection('coils').get();
  const finishesSnap = await db.collection('coil_finishes').get();
  
  const validFinishes = finishesSnap.docs.map(d => d.id.toUpperCase()); // Using IDs or label? Usually finish field refers to label or ID. Let's assume label or ID.
  const validFinishLabels = finishesSnap.docs.map(d => (d.data().label || '').toUpperCase());
  
  results['D_FINISHES'] = { total: finishesSnap.size, data: finishesSnap.docs.map(d => d.data()) };

  // A) PRODUCTION LOGS
  let totalLogs = logsSnap.size;
  logsSnap.docs.forEach(doc => {
    const data = doc.data();
    const isDrywall = data.line === 'drywall' || (!data.line && data.costPerPiece !== undefined); // guess line if missing
    
    // 1. parentCoilIds array
    const hasArray = Array.isArray(data.parentCoilIds);
    addResult('A_LOGS', '1_parentCoilIds_array', hasArray, doc.id);
    
    // 2. parentCoilId null?
    const parentIdNull = data.parentCoilId === null;
    addResult('A_LOGS', '2_parentCoilId_null', !parentIdNull, doc.id);
    
    // 3. Spanglish fields
    // Conforme si NO tiene weightConsumedKg ni costoUnitarioPEN ni avgCostAfter
    const hasSpanglish = data.weightConsumedKg !== undefined || data.costoUnitarioPEN !== undefined || data.avgCostAfter !== undefined;
    addResult('A_LOGS', '3_spanglish_fields', !hasSpanglish, doc.id);
    
    // 4. perCoilBreakdown (only for metallic-roofing)
    if (data.line === 'metallic-roofing') {
      const hasBreakdown = Array.isArray(data.perCoilBreakdown);
      addResult('A_LOGS', '4_perCoilBreakdown', hasBreakdown, doc.id);
    }
    
    // 5. line field
    addResult('A_LOGS', '5_line_exists', !!data.line, doc.id);
  });

  // B) SALES
  let totalSales = salesSnap.size;
  salesSnap.docs.forEach(doc => {
    const data = doc.data();
    const items = data.items || [];
    
    // 6. items[].baseCost
    const missingBaseCost = items.some(item => item.baseCost === undefined || item.baseCost === null);
    addResult('B_SALES', '6_items_baseCost', !missingBaseCost, doc.id);
    
    // 7. weightSnapshot.colorFinish
    const metallicItems = items.filter(i => i.businessLine === 'metallic-roofing');
    let hasEmptyColor = false;
    metallicItems.forEach(i => {
      if (i.weightSnapshot && (!i.weightSnapshot.colorFinish || i.weightSnapshot.colorFinish === "")) {
        hasEmptyColor = true;
      }
    });
    // Only flag if it's a metallic item with weightSnapshot and empty colorFinish
    addResult('B_SALES', '7_weightSnapshot_color', !hasEmptyColor, doc.id);
    
    // 8. status
    addResult('B_SALES', '8_status_exists', !!data.status, doc.id);
  });

  // C) COILS
  let totalCoils = coilsSnap.size;
  coilsSnap.docs.forEach(doc => {
    const data = doc.data();
    
    // 9. densityFactor
    const df = data.coilDensityFactor || data.densityFactor;
    const hasValidDf = df === 0.00785 || df === 0.008;
    addResult('C_COILS', '9_densityFactor_valid', hasValidDf, doc.id);
    
    // 10. finish
    const f = (data.finish || '').toUpperCase();
    const finishExists = !!data.finish;
    const finishValid = validFinishes.includes(f) || validFinishLabels.includes(f);
    addResult('C_COILS', '10_finish_exists_and_valid', finishExists && finishValid, doc.id);
    
    // 11. required fields
    const hasReq = data.status !== undefined && data.currentWeight !== undefined && data.initialWeight !== undefined;
    addResult('C_COILS', '11_required_fields', hasReq, doc.id);
  });

  console.log(JSON.stringify({
    counts: { logs: totalLogs, sales: totalSales, coils: totalCoils },
    results
  }, null, 2));
}

runAudit().catch(console.error);
