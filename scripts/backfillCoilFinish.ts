/*
import { db } from "@/lib/firebase/clientApp";
import { collection, getDocs, writeBatch, query, where } from "firebase/firestore";

/ **
 * SPRINT 6A - BACKFILL DE ACABADO PARA BOBINAS
 * Marca todas las bobinas que no tienen 'finish' como 'GALVANIZADO' (Drywall).
 * Ejecutar solo si confirmas que el 100% de la materia prima histórica fue para drywall.
 * /
export const backfillCoilFinish = async () => {
  const collRef = collection(db, "coils");
  const q = query(collRef); // Podríamos filtrar por where("finish", "==", null) si Firestore lo permitiera fácil
  const snap = await getDocs(q);
  
  const batch = writeBatch(db);
  let count = 0;

  snap.docs.forEach(docSnap => {
    const data = docSnap.data();
    if (!data.finish) {
      batch.update(docSnap.ref, { finish: "GALVANIZADO" });
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
    console.log(`Backfill completado: ${count} bobinas actualizadas a GALVANIZADO.`);
  } else {
    console.log("No se encontraron bobinas sin acabado.");
  }
};
*/
