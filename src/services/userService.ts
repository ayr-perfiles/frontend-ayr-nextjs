import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

// 1. Definimos tus roles reales
export interface AppUser {
  id: string; // El UID de Firebase Auth
  email: string;
  name?: string;
  role: "ADMIN" | "SUPERVISOR" | "OPERATOR";
  createdAt?: any;
  lastLogin?: any;
}

/**
 * Obtiene la lista de todos los usuarios registrados en el sistema
 */
export const getUsers = async (): Promise<AppUser[]> => {
  try {
    const snapshot = await getDocs(collection(db, "users"));
    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as AppUser,
    );
  } catch (error) {
    console.error("Error obteniendo usuarios:", error);
    return [];
  }
};

/**
 * Actualiza el rol de un usuario específico usando tus roles oficiales
 */
export const updateUserRole = async (
  userId: string,
  newRole: "ADMIN" | "SUPERVISOR" | "OPERATOR",
) => {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      role: newRole,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error actualizando rol:", error);
    throw new Error("No se pudo actualizar el rol del usuario.");
  }
};
