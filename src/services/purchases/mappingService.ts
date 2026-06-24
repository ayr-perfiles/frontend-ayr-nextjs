import { db } from "@/lib/firebase/clientApp";
import { collection, query, where, getDocs, limit, doc, getDoc } from "firebase/firestore";

/**
 * Busca una sugerencia de SKU para una descripción de proveedor específica
 */
export async function getSkuSuggestion(rucProveedor: string, description: string): Promise<string | null> {
  const mapId = `${rucProveedor}_${Buffer.from(description).toString("hex").substring(0, 50)}`;
  const docRef = doc(db, "supplier_sku_map", mapId);
  
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data().skuAYR;
    }
  } catch (error) {
    console.error("Error fetching SKU suggestion:", error);
  }
  return null;
}
