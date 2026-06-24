import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKeyTest.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

async function main() {
  const db = getFirestore();
  
  // 1. Fetch all sales to check associations
  const salesSnap = await db.collection('sales').get();
  const salesMap = new Map<string, number>(); // sku -> count of sales
  salesSnap.docs.forEach(d => {
    const data = d.data();
    if (Array.isArray(data.items)) {
      data.items.forEach((item: any) => {
        if (item.sku) {
          salesMap.set(item.sku, (salesMap.get(item.sku) || 0) + 1);
        }
      });
    }
  });

  const catalogSnap = await db.collection('metallic_roofing_catalog').get();
  
  console.log("=== SKU con family === 'BOBINA' ===");
  const bobinas: any[] = [];
  const invalidColors: any[] = [];
  let cob035 = null;

  const validColors = ["AZUL", "BLANCO", "NATURAL", "ROJO", "VERDE", "ALUZINC", "TRANSPARENTE", "GALVANIZADO", "PREPINTADO"];
  
  catalogSnap.docs.forEach(d => {
    const data = d.data();
    const sku = d.id;
    const salesCount = salesMap.get(sku) || 0;

    if (data.family === 'BOBINA') {
      bobinas.push({ sku, displayName: data.displayName, sales: salesCount });
    }

    if (data.family === 'COBERTURA') {
      const c = (data.color || "").toUpperCase();
      const f = (data.finish || "").toUpperCase();
      if (c && !validColors.includes(c)) {
        invalidColors.push({ sku, field: 'color', value: data.color });
      }
      if (f && !validColors.includes(f)) {
        invalidColors.push({ sku, field: 'finish', value: data.finish });
      }
    }

    if (sku === 'COB035GALV') {
      cob035 = { sku, status: data.status, active: data.active, sales: salesCount };
    }
  });

  console.table(bobinas);

  console.log("\n=== SKU con color/finish anómalo ===");
  console.table(invalidColors);

  console.log("\n=== COB035GALV ===");
  console.table(cob035 ? [cob035] : []);

  process.exit(0);
}

main().catch(console.error);
