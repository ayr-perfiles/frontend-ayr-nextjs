import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  writeBatch,
} from "firebase/firestore";

export const resetDatabase = async () => {
  const collections = ["coils", "inventory_stock", "production_logs", "sales"];

  try {
    for (const collectionName of collections) {
      const querySnapshot = await getDocs(collection(db, collectionName));
      const batch = writeBatch(db);

      querySnapshot.forEach((document) => {
        batch.delete(doc(db, collectionName, document.id));
      });

      await batch.commit();
      console.log(`Colección ${collectionName} eliminada.`);
    }
    return { success: true };
  } catch (error) {
    console.error("Error al resetear la base de datos:", error);
    throw error;
  }
};
