import { 
  collection, 
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  Firestore
} from "firebase/firestore";
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { db, auth } from "@/lib/firebase/clientApp";
import { vi } from 'vitest';

vi.unmock('@/lib/firebase/clientApp');

const PROJECT_ID = "test-project";

export async function setupIntegrationTest() {
  // Create and sign in a test user to satisfy firestore.rules (request.auth != null)
  const email = `test-integration@example.com`;
  const password = "password123";
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (e: any) {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e2: any) {
      // ignore
    }
  }

  return { app: null as any, db, auth };
}

import { execSync } from "child_process";

export async function clearFirestore(projectIdOrDb: string | Firestore = PROJECT_ID) {
  let actualProjectId = typeof projectIdOrDb === 'string' ? projectIdOrDb : PROJECT_ID;
  if (typeof projectIdOrDb !== 'string' && projectIdOrDb.app && projectIdOrDb.app.options.projectId) {
    actualProjectId = projectIdOrDb.app.options.projectId;
  }
  
  const url = `http://127.0.0.1:8080/emulator/v1/projects/${actualProjectId}/databases/(default)/documents`;
  try {
    // Usar curl para mayor fiabilidad en el entorno de Node/Vitest
    execSync(`curl -X DELETE "${url}"`);
  } catch (error) {
    console.error(`Error clearing Firestore emulator (${actualProjectId}) via curl:`, error);
    // fallback a fetch si curl falla
    try {
      await fetch(url, { method: "DELETE" });
    } catch (e) {
      console.error(`Error clearing Firestore emulator (${actualProjectId}) via fetch fallback:`, e);
    }
  }
}

export async function cleanupIntegrationTest(_app: any, _db: Firestore) {
  await signOut(auth);
}
// Fixtures
export async function seedCoil(db: any, data: any) {
  const id = data.id || `BOB-${Date.now()}`;
  const coilRef = doc(db, "coils", id);
  await setDoc(coilRef, {
    initialWeight: 5000,
    currentWeight: 5000,
    masterWidth: 1200,
    thickness: 0.45,
    pricePerKg: 3.5,
    status: "AVAILABLE",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...data,
    id
  });
  return id;
}

export async function seedFinish(db: any, data: any) {
  const finishRef = doc(db, "coil_finishes", data.id);
  const finishData = {
    active: true,
    label: data.id,
    lines: ["drywall"],
    densityFactor: 0.00785,
    ...data
  };
  if (finishData.densityFactor === null) {
    delete finishData.densityFactor;
  }
  await setDoc(finishRef, finishData);
}

export async function seedStock(db: any, collectionName: string, sku: string, data: any) {
  const stockRef = doc(db, collectionName, sku);
  await setDoc(stockRef, {
    sku,
    quantity: 0,
    totalWeight: 0,
    avgCost: 0,
    lastUpdate: new Date(),
    ...data
  });
  return stockRef;
}
