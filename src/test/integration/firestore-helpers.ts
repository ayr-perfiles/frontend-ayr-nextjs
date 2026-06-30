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
import * as admin from "firebase-admin";

vi.unmock('@/lib/firebase/clientApp');

const PROJECT_ID = "ayrsteel-test";

export async function setupIntegrationTest() {
  const currentProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || PROJECT_ID;
  let adminApp: admin.app.App;
  try {
    adminApp = admin.app(currentProjectId);
  } catch {
    adminApp = admin.initializeApp({ projectId: currentProjectId }, currentProjectId);
  }

  const email = `test-integration@example.com`;
  const password = "password123";
  let uid: string | undefined;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
  } catch {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      uid = cred.user.uid;
    } catch {
      // ignore
    }
  }

  // Set ADMIN claim so firestore.rules (claim-only) permits writes from this user
  if (uid) {
    await adminApp.auth().setCustomUserClaims(uid, { role: 'ADMIN' });
    await auth.currentUser?.getIdToken(true);
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
  // Sin-op para dejar el emulador limpio
}

export async function setTestUserAdmin(email: string) {
  const currentProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || PROJECT_ID;
  let adminApp: admin.app.App;
  try {
    adminApp = admin.app(currentProjectId);
  } catch {
    adminApp = admin.initializeApp({ projectId: currentProjectId }, currentProjectId);
  }
  const user = await adminApp.auth().getUserByEmail(email);
  await adminApp.auth().setCustomUserClaims(user.uid, { role: 'ADMIN' });
  await auth.currentUser?.getIdToken(true);
}
// Fixtures
export async function seedCoil(db: any, data: any) {
  const id = data.id || `BOB-${Date.now()}`;
  const coilRef = doc(db, "coils", id);
  const coilData = {
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
  };
  
  if (data.masterWidth === null) {
    delete coilData.masterWidth;
  }

  await setDoc(coilRef, coilData);
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
