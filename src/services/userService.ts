import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  where,
  getCountFromServer,
} from "firebase/firestore";

export interface AppUser {
  id: string; 
  email: string;
  name?: string;
  role: "ADMIN" | "SUPERVISOR" | "OPERATOR";
  isActive?: boolean;
  createdAt?: any;
  lastLogin?: any;
}

export interface FetchUsersParams {
  pageSize: number;
  searchTerm: string;
  roleFilter: string;
  statusFilter: string;
  direction?: "first" | "next" | "prev";
  cursorDoc?: any;
}

export const fetchUsersPaginated = async (params: FetchUsersParams) => {
  const { pageSize, searchTerm, roleFilter, statusFilter, direction = "first", cursorDoc } = params;

  try {
    const collRef = collection(db, "users");
    let baseConstraints: any[] = [];

    // 1. FILTROS
    if (roleFilter !== "ALL") baseConstraints.push(where("role", "==", roleFilter));
    
    if (statusFilter === "ACTIVE") baseConstraints.push(where("isActive", "==", true));
    if (statusFilter === "INACTIVE") baseConstraints.push(where("isActive", "==", false));

    // Búsqueda por Prefijo de Email (Ej: "juan" encontrará "juan@correo.com")
    if (searchTerm && searchTerm.trim().length > 0) {
      const term = searchTerm.trim().toLowerCase();
      baseConstraints.push(where("email", ">=", term));
      baseConstraints.push(where("email", "<=", term + '\uf8ff'));
      // Cuando usamos desigualdad (>=) en Firebase, el orderBy primario debe ser el mismo campo
      baseConstraints.push(orderBy("email", "asc")); 
    } else {
      baseConstraints.push(orderBy("createdAt", "desc"));
    }

    // 2. CONTEO GLOBAL (Cuesta 1 lectura)
    const baseQuery = query(collRef, ...baseConstraints);
    const countSnapshot = await getCountFromServer(baseQuery);
    const totalCount = countSnapshot.data().count;

    // 3. PAGINACIÓN
    let paginationConstraints = [...baseConstraints];
    if (direction === "next" && cursorDoc) {
      paginationConstraints.push(startAfter(cursorDoc));
      paginationConstraints.push(limit(pageSize));
    } else if (direction === "prev" && cursorDoc) {
      paginationConstraints.push(endBefore(cursorDoc));
      paginationConstraints.push(limitToLast(pageSize));
    } else {
      paginationConstraints.push(limit(pageSize));
    }

    const finalQuery = query(collRef, ...paginationConstraints);
    const snapshot = await getDocs(finalQuery);

    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      isActive: doc.data().isActive !== undefined ? doc.data().isActive : true, // Fallback
    })) as AppUser[];

    return {
      users,
      firstDoc: snapshot.docs.length > 0 ? snapshot.docs[0] : null,
      lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
      totalCount,
    };
  } catch (error) {
    console.error("Error obteniendo usuarios:", error);
    throw new Error("No se pudo cargar el listado de personal.");
  }
};

export const updateUserRole = async (userId: string, newRole: "ADMIN" | "SUPERVISOR" | "OPERATOR") => {
  try {
    await updateDoc(doc(db, "users", userId), {
      role: newRole,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    throw new Error("No se pudo actualizar el rol del usuario.");
  }
};

export const updateUserStatus = async (userId: string, newStatus: boolean) => {
  try {
    await updateDoc(doc(db, "users", userId), {
      isActive: newStatus,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    throw new Error("No se pudo actualizar el estado del usuario.");
  }
};