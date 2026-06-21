import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp({ projectId: "ayrsteel-test" });
}

async function run() {
  const db = getFirestore();
  const validFinishes = new Set(["AZUL", "BLANCO", "NATURAL", "ROJO", "VERDE", "ALUZINC", "GALVANIZADO"]);
  const snap = await db.collection("metallic_roofing_catalog").get();
  
  const mismatches: string[] = [];
  
  snap.forEach(doc => {
    const data = doc.data();
    const f = data.finish?.toUpperCase();
    const c = data.color?.toUpperCase();
    // Finish from SKU: if color is specified, it usually implies prepainted, so color is the finish
    const effectiveFinish = (c && c !== "NATURAL" && c !== "") ? c : f;

    if (effectiveFinish && !validFinishes.has(effectiveFinish)) {
      mismatches.push(`${doc.id}: finish=${f}, color=${c}, effective=${effectiveFinish}`);
    }
  });

  console.log("Mismatches found:");
  mismatches.forEach(m => console.log(m));
}

run().catch(console.error);
