import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  doc,
  getDoc,
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
  /** Factor densidad para conformado metallic-roofing (kg/mm²·m). 0.008 aluzinc (natural o prepintado) · 0.00785 galvanizado/drywall. */
  densityFactor?: number;
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
  // Firestore rejects undefined values — strip them before writing
  const clean = Object.fromEntries(Object.entries(finish).filter(([, v]) => v !== undefined));
  await setDoc(docRef, { ...clean, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
};

export const updateFinish = async (id: string, updates: Partial<CoilFinish>) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  const clean = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
  await updateDoc(docRef, { ...clean, updatedAt: serverTimestamp() });
};

/** Idempotente: establece densityFactor correcto en ALUZINC, NATURAL y GALVANIZADO. No pisa overrides manuales. */
export const migrateFinishDensityFactors = async () => {
  const rules: Record<string, { target: number; replaceIfEquals?: number }> = {
    ALUZINC:     { target: 0.008,   replaceIfEquals: 0.00785 },
    NATURAL:     { target: 0.008,   replaceIfEquals: 0.00785 },
    GALVANIZADO: { target: 0.00785 },
    AZUL:        { target: 0.008 },
    BLANCO:      { target: 0.008 },
    ROJO:        { target: 0.008 },
    VERDE:       { target: 0.008 },
  };

  for (const [id, { target, replaceIfEquals }] of Object.entries(rules)) {
    const ref = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;
    const current: number | undefined = snap.data().densityFactor;
    const shouldUpdate =
      current === undefined ||
      (replaceIfEquals !== undefined && current === replaceIfEquals);
    if (shouldUpdate) {
      await updateDoc(ref, { densityFactor: target, updatedAt: serverTimestamp() });
    }
  }
};

export const seedFinishes = async () => {
  const initialFinishes: CoilFinish[] = [
    { id: 'GALVANIZADO', label: 'GALVANIZADO', active: true, lines: ['drywall'], densityFactor: 0.00785 },
    { id: 'ALUZINC', label: 'ALUZINC', active: true, lines: ['metallic-roofing'], densityFactor: 0.008 },
    { id: 'NATURAL', label: 'NATURAL', active: true, lines: ['metallic-roofing'], densityFactor: 0.008 },
    { id: 'AZUL', label: 'AZUL', active: true, lines: ['metallic-roofing'], densityFactor: 0.008 },
    { id: 'BLANCO', label: 'BLANCO', active: true, lines: ['metallic-roofing'], densityFactor: 0.008 },
    { id: 'ROJO', label: 'ROJO', active: true, lines: ['metallic-roofing'], densityFactor: 0.008 },
    { id: 'VERDE', label: 'VERDE', active: true, lines: ['metallic-roofing'], densityFactor: 0.008 },
  ];

  for (const f of initialFinishes) {
    await createFinish(f);
  }
};
