import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { StripStock, StripMovement } from "@/types";

export const listStripsStock = async () => {
  const collRef = collection(db, "strips_stock");
  const q = query(collRef, where("totalStrips", ">", 0), orderBy("widthMm", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as StripStock));
};

export const getStripStock = async (widthMm: number) => {
  const docRef = doc(db, "strips_stock", widthMm.toString());
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as StripStock;
};

export const adjustStripStock = async (params: {
  widthMm: number;
  deltaQuantity: number;
  deltaWeight: number;
  reason: string;
  userEmail: string;
}) => {
  const { widthMm, deltaQuantity, deltaWeight, reason, userEmail } = params;

  try {
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, "strips_stock", widthMm.toString());
      const snap = await transaction.get(docRef);

      if (!snap.exists()) throw new Error("No existe stock para este ancho de fleje.");
      const stock = snap.data() as StripStock;

      const newTotalStrips = stock.totalStrips + deltaQuantity;
      const newTotalWeight = stock.totalWeight + deltaWeight;

      if (newTotalStrips < 0) throw new Error("El stock de flejes no puede ser negativo.");

      transaction.update(docRef, {
        totalStrips: newTotalStrips,
        totalWeight: newTotalWeight,
        lastUpdate: serverTimestamp()
      });

      const moveRef = doc(collection(db, "strips_movements"));
      transaction.set(moveRef, {
        type: 'AJUSTE',
        widthMm,
        quantity: deltaQuantity,
        weight: deltaWeight,
        costPerKg: stock.avgCostPerKg,
        referenceId: 'ADJUSTMENT',
        description: reason,
        timestamp: serverTimestamp(),
        user: userEmail
      });
    });
    return { success: true };
  } catch (error: any) {
    console.error("Error adjusting strip stock:", error);
    throw new Error(error.message || "Error al ajustar stock de flejes.");
  }
};
