import { db } from "@/lib/firebase/clientApp";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { Coil } from "@/types";

export async function getInventory() {
  const coilsRef = collection(db, "coils");
  const q = query(coilsRef, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Coil[];
}
