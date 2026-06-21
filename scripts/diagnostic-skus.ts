import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as serviceAccount from '../serviceAccountKeyTest.json';

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount as any),
  });
}
const db = getFirestore();

async function run() {
  console.log(`Conectado a ${serviceAccount.project_id}`);
  const catalogSnap = await db.collection('metallic_roofing_catalog').get();
  const salesSnap = await db.collection('sales').get();

  const salesItems = salesSnap.docs.map(d => d.data().items || []).flat();
  const salesSkus = new Set(salesItems.map((i: any) => i.sku));

  const validColors = ['AZUL', 'BLANCO', 'NATURAL', 'ROJO', 'VERDE'];

  const familyBobina: any[] = [];
  const invalidColor: any[] = [];
  let cob035galv: any = null;

  catalogSnap.forEach((doc) => {
    const data = doc.data();
    if (data.family === 'BOBINA') {
      familyBobina.push({ id: doc.id, displayName: data.displayName, hasSales: salesSkus.has(doc.id) });
    }
    if (data.colorFinish && !validColors.includes(data.colorFinish)) {
      invalidColor.push({ id: doc.id, colorFinish: data.colorFinish });
    }
    if (doc.id === 'COB035GALV') {
      cob035galv = { id: doc.id, hasSales: salesSkus.has(doc.id) };
    }
  });

  console.log('\n--- SKU con family === "BOBINA" ---');
  console.table(familyBobina);

  console.log('\n--- SKU con colorFinish anómalo ---');
  console.table(invalidColor);

  console.log('\n--- COB035GALV ---');
  console.log(cob035galv ? `Existe. Ventas: ${cob035galv.hasSales}` : 'No existe');
}

run().catch(console.error);
