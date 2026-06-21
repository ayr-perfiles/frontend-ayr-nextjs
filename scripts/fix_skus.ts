import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp({ projectId: "ayr-steel" });
}

async function main() {
  const db = getFirestore();
  const q2 = db.collection("metallic_roofing_catalog");
  const snap2 = await q2.get();
  
  let fixed = 0;
  for (const d of snap2.docs) {
    if (d.id === "COB030ROJO") {
      console.log("Fixing COB030ROJO in metallic_roofing_catalog...");
      await d.ref.update({ 
        color: "ROJO", 
        finish: "ROJO",
        updatedAt: FieldValue.serverTimestamp()
      });
      fixed++;
    }
    if (d.id === "COB035GALV") {
      console.log("Voiding COB035GALV in metallic_roofing_catalog...");
      await d.ref.update({ 
        status: "VOIDED", 
        active: false,
        updatedAt: FieldValue.serverTimestamp()
      });
      fixed++;
    }

    const data = d.data();
    if (data.family === "COBERTURA") {
      const finish = data.finish || "";
      const validFinishes = ["AZUL", "BLANCO", "NATURAL", "ROJO", "VERDE", "ALUZINC", "GALVANIZADO", "TRANSPARENTE", "ZINCALUM"];
      if (!validFinishes.includes(finish.toUpperCase())) {
        console.log(`WARNING: SKU ${d.id} has finish ${finish} outside expected range.`);
      }
    }
  }

  // Also check 'products'
  const q = db.collection("products");
  const snap = await q.get();
  for (const d of snap.docs) {
    if (d.id === "COB030ROJO") {
      console.log("Fixing COB030ROJO in products...");
      await d.ref.update({ color: "ROJO", finish: "ROJO" });
    }
    if (d.id === "COB035GALV") {
      console.log("Voiding COB035GALV in products...");
      await d.ref.update({ status: "VOIDED", active: false });
    }
  }

  console.log(`Done. Fixed ${fixed} docs.`);
  process.exit(0);
}

main().catch(console.error);
