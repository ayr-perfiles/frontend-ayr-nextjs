import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { StripStock } from "@/types";

export const listStripsStock = async () => {
  const collRef = collection(db, "strips_stock");
  const q = query(collRef, where("totalStrips", ">", 0), orderBy("widthMm", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as StripStock));
};
