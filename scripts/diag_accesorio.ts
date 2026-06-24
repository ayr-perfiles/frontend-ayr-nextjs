import { db } from "../src/lib/firebase/clientApp";
import { getDocs, collection } from "firebase/firestore";

async function main() {
  const q = collection(db, "products");
  const snap = await getDocs(q);
  
  const accesorios: any[] = [];
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.family === "ACCESORIO") {
      accesorios.push({ id: d.id, name: data.displayName, line: data.businessLine });
    }
  });

  const q2 = collection(db, "metallic_roofing_catalog");
  const snap2 = await getDocs(q2);
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
