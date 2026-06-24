import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKeyTest.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

async function main() {
  const db = getFirestore();
  const catalogSnap = await db.collection('metallic_roofing_catalog').get();
  console.log(`Total documents in catalog: ${catalogSnap.size}`);
  process.exit(0);
}

main().catch(console.error);
