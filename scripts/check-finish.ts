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
  const catalogSnap = await db.collection('metallic_roofing_catalog').get();
  const finishes = new Set();
  catalogSnap.forEach((doc) => {
    finishes.add(doc.data().finish);
  });
  console.log(Array.from(finishes));
}
run().catch(console.error);
