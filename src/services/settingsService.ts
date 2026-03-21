import { db } from "@/lib/firebase/clientApp";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  writeBatch,
} from "firebase/firestore";

export interface SystemSettings {
  companyName: string;
  companyRuc: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  igvRate: number;
  nextSaleNumber: number;
  nextQuotationNumber: number;
  minMarginPercent: number;
  lowStockProduct: number;
  // --- NUEVO: INTEGRACIONES ---
  algoliaAppId: string;
  algoliaSearchKey: string;
  sunatApiToken: string;
}

const SETTINGS_DOC_ID = "general_settings";

export const getSystemSettings = async (): Promise<SystemSettings | null> => {
  try {
    const docRef = doc(db, "settings", SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as SystemSettings;
    }
    return null;
  } catch (error) {
    console.error("Error obteniendo configuración:", error);
    return null;
  }
};

export const updateSystemSettings = async (data: Partial<SystemSettings>) => {
  try {
    const docRef = doc(db, "settings", SETTINGS_DOC_ID);
    await setDoc(
      docRef,
      { ...data, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return { success: true };
  } catch (error) {
    console.error("Error guardando configuración:", error);
    throw new Error("No se pudo guardar la configuración.");
  }
};

export const resetDatabaseDevOnly = async (userEmail: string) => {
  // 1. CAPA DE SEGURIDAD ESTRICTA: Solo entorno de desarrollo
  if (process.env.NODE_ENV !== "development") {
    throw new Error(
      "⛔ ACCESO DENEGADO: Esta acción destruye datos y solo está permitida en entorno de desarrollo (localhost).",
    );
  }

  // Colecciones transaccionales que vamos a vaciar
  const collectionsToClear = [
    "coils",
    "inventory_stock",
    "production_logs",
    "sales",
    "audit_logs", // Opcional: puedes quitarla si quieres mantener el rastro de quién hizo el reset
  ];

  try {
    for (const colName of collectionsToClear) {
      const colRef = collection(db, colName);
      const snapshot = await getDocs(colRef);

      if (!snapshot.empty) {
        // Usamos writeBatch para borrar de forma más rápida y segura
        const batch = writeBatch(db);
        snapshot.docs.forEach((document) => {
          batch.delete(doc(db, colName, document.id));
        });

        // Firestore permite hasta 500 operaciones por batch.
        // Como es para desarrollo, asumimos que no habrá más de 500 docs por colección de prueba.
        await batch.commit();
      }
    }

    // Opcional: Dejar un registro en audit_logs de que se limpió el sistema
    const newAuditRef = doc(collection(db, "audit_logs"));
    await setDoc(newAuditRef, {
      action: "SYSTEM_RESET",
      entityId: "ALL",
      userEmail: userEmail,
      details:
        "Reinicio total de base de datos en DEV (Se mantuvieron catálogos y usuarios).",
      timestamp: serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error en resetDatabaseDevOnly:", error);
    throw new Error("No se pudo completar la limpieza: " + error.message);
  }
};
