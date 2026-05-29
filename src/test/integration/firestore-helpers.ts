import { 
  getFirestore, 
  connectFirestoreEmulator, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs,
  query,
  terminate,
  Firestore
} from "firebase/firestore";
import { initializeApp, deleteApp, getApps, FirebaseApp } from "firebase/app";

const PROJECT_ID = "test-project";

export async function setupIntegrationTest() {
  const config = {
    apiKey: "test-api-key",
    authDomain: `${PROJECT_ID}.firebaseapp.com`,
    projectId: PROJECT_ID,
    storageBucket: `${PROJECT_ID}.appspot.com`,
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123",
  };

  const app = initializeApp(config, `test-app-${Date.now()}`);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  
  return { app, db };
}

export async function clearFirestore(projectId: string = PROJECT_ID) {
  const url = `http://127.0.0.1:8080/emulator/v1/projects/${projectId}/databases/(default)/documents`;
  try {
    await fetch(url, { method: "DELETE" });
  } catch (error) {
    console.error("Error clearing Firestore emulator:", error);
  }
}

export async function cleanupIntegrationTest(app: FirebaseApp, db: Firestore) {
  await terminate(db);
  await deleteApp(app);
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
  await setDoc(finishRef, {
    active: true,
    label: data.id,
    lines: ["drywall"],
    ...data
  });
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
