import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { BusinessLine } from "@/types";

export interface CoilFinish {
  id: string;
  label: string;
  active: boolean;
  lines: BusinessLine[];
}

const COLLECTION_NAME = "coil_finishes";

export const listFinishes = async (onlyActive = true) => {
  const collRef = collection(db, COLLECTION_NAME);
  let q = query(collRef, orderBy("label", "asc"));
  
  if (onlyActive) {
    q = query(collRef, where("active", "==", true), orderBy("label", "asc"));
  }

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CoilFinish);
};

export const createFinish = async (finish: CoilFinish) => {
  const docRef = doc(db, COLLECTION_NAME, finish.id);
  await setDoc(docRef, {
    ...finish,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const updateFinish = async (id: string, updates: Partial<CoilFinish>) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const seedFinishes = async () => {
  const initialFinishes: CoilFinish[] = [
    { id: 'GALVANIZADO', label: 'GALVANIZADO', active: true, lines: ['drywall'] },
    { id: 'ALUZINC', label: 'ALUZINC', active: true, lines: ['metallic-roofing'] },
    { id: 'NATURAL', label: 'NATURAL', active: true, lines: ['metallic-roofing'] },
  ];

  for (const f of initialFinishes) {
    await createFinish(f);
  }
};
