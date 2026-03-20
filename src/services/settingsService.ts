import { db } from "@/lib/firebase/clientApp";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

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
