import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

export interface ProductConfig {
  sku: string;
  name: string;
  stripWidth: number; // Ancho de banda (mm)
  standardWeight: number; // Peso logístico/estándar (kg)
  isActive: boolean; // Para poder desactivar productos viejos sin borrarlos
}

/**
 * Obtiene todo el catálogo de productos desde Firebase
 */
export const getCatalog = async (): Promise<ProductConfig[]> => {
  try {
    const snapshot = await getDocs(collection(db, "products"));
    return snapshot.docs.map(
      (doc) => ({ sku: doc.id, ...doc.data() }) as ProductConfig,
    );
  } catch (error) {
    console.error("Error obteniendo catálogo:", error);
    return [];
  }
};

/**
 * Guarda o actualiza un producto en el catálogo
 */
export const saveProduct = async (product: ProductConfig) => {
  try {
    const docRef = doc(db, "products", product.sku);
    await setDoc(
      docRef,
      {
        name: product.name,
        stripWidth: product.stripWidth,
        standardWeight: product.standardWeight,
        isActive: product.isActive,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return { success: true };
  } catch (error) {
    console.error("Error guardando producto:", error);
    throw new Error("No se pudo guardar el producto.");
  }
};

/**
 * Elimina un producto definitivamente
 */
export const deleteProduct = async (sku: string) => {
  try {
    await deleteDoc(doc(db, "products", sku));
    return { success: true };
  } catch (error) {
    console.error("Error eliminando producto:", error);
    throw new Error("No se pudo eliminar el producto.");
  }
};
