import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as serviceAccount from '../serviceAccountKeyTest.json';

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount as any),
  });
}
const db = getFirestore();

async function run() {
  const isDryRun = process.argv.includes('--apply') ? false : true;
  console.log(`[${isDryRun ? 'DRY RUN' : 'APPLY'}] Running backfill for colorFinish...`);

  const salesSnap = await db.collection('sales').get();
  const catalogSnap = await db.collection('metallic_roofing_catalog').get();

  const catalogMap = new Map();
  catalogSnap.forEach(doc => {
    catalogMap.set(doc.id, doc.data());
  });

  let toFix = 0;
  let unresolvable = 0;
  const unresolvableDetails: any[] = [];
  let updatedSalesCount = 0;

  for (const doc of salesSnap.docs) {
    const sale = doc.data();
    let needsUpdate = false;
    const newItems = [...(sale.items || [])];

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      if (item.businessLine === 'metallic-roofing' && item.weightSnapshot) {
        if (item.weightSnapshot.colorFinish === "") {
          const product = catalogMap.get(item.sku);
          if (product && (product.finish || product.color)) {
            const resolvedColor = product.finish ?? product.color;
            if (resolvedColor) {
              item.weightSnapshot.colorFinish = resolvedColor;
              needsUpdate = true;
              toFix++;
            } else {
              unresolvable++;
              unresolvableDetails.push({ saleId: doc.id, sku: item.sku, reason: "Product has no finish/color" });
            }
          } else {
            unresolvable++;
            unresolvableDetails.push({ saleId: doc.id, sku: item.sku, reason: "Product not found or no finish/color" });
          }
        }
      }
    }

    if (needsUpdate && !isDryRun) {
      await doc.ref.update({ items: newItems });
      updatedSalesCount++;
    }
  }

  console.log('--- RESUMEN ---');
  console.log(`Ventas a corregir (items): ${toFix}`);
  console.log(`Ventas actualizadas (documentos): ${updatedSalesCount}`);
  console.log(`Irresolubles (items): ${unresolvable}`);
  
  if (unresolvable > 0) {
    console.log('--- IRRESOLUBLES ---');
    console.table(unresolvableDetails);
  }

  if (!isDryRun && updatedSalesCount > 0) {
    // Audit log
    await db.collection('audit_logs').add({
      action: 'BACKFILL_COLOR_FINISH',
      timestamp: FieldValue.serverTimestamp(),
      details: `Reparados ${toFix} items en ${updatedSalesCount} ventas.`,
      user: 'system_script'
    });
  }
}

run().catch(console.error);
