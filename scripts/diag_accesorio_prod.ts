import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp({ projectId: "ayr-steel" });
}

async function main() {
  const db = getFirestore();
  const q = db.collection("products");
  const snap = await q.get();
  
  const accesorios: any[] = [];
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.family === "ACCESORIO") {
      accesorios.push({ id: d.id, name: data.displayName, line: data.businessLine });
    }
  });

  const q2 = db.collection("metallic_roofing_catalog");
  const snap2 = await q2.get();
  snap2.docs.forEach(d => {
    const data = d.data();
    if (data.family === "ACCESORIO") {
      accesorios.push({ id: d.id, name: data.displayName, line: "metallic-roofing (direct)" });
    }
  });

  console.log("Accesorios encontrados:", accesorios);
  process.exit(0);
}

main().catch(console.error);
