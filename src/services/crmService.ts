import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  updateDoc,
} from "firebase/firestore";

// 1. OBTENER TODOS LOS CLIENTES (Para la tabla principal)
export const getAllCustomers = async () => {
  try {
    const snap = await getDocs(collection(db, "customers"));
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error obteniendo clientes:", error);
    return [];
  }
};

// 2. OBTENER EL PERFIL COMPLETO DEL CLIENTE (Datos, Contactos e Historial)
export const getCustomerProfile = async (documentNumber: string) => {
  try {
    // A. Datos de la empresa
    const customerRef = doc(db, "customers", documentNumber);
    const customerSnap = await getDoc(customerRef);
    if (!customerSnap.exists()) throw new Error("Cliente no encontrado");
    const customerData = { id: customerSnap.id, ...customerSnap.data() };

    // B. Contactos asociados
    const contactsQuery = query(
      collection(db, "contacts"),
      where("associatedCompanyIds", "array-contains", documentNumber),
    );
    const contactsSnap = await getDocs(contactsQuery);
    const contacts = contactsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // C. Historial de Ventas y Cotizaciones
    const salesQuery = query(
      collection(db, "sales"),
      where("documentNumber", "==", documentNumber),
      // Firebase requiere un índice compuesto si usas where + orderBy en distintos campos,
      // así que ordenaremos en memoria (frontend) para evitar que tengas que crear índices manuales ahora.
    );
    const salesSnap = await getDocs(salesQuery);
    const salesHistory = salesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Ordenamos cronológicamente (del más reciente al más antiguo)
    salesHistory.sort((a: any, b: any) => {
      const dateA = a.timestamp?.toMillis() || 0;
      const dateB = b.timestamp?.toMillis() || 0;
      return dateB - dateA;
    });

    return { customerData, contacts, salesHistory };
  } catch (error) {
    console.error("Error obteniendo perfil del cliente:", error);
    return null;
  }
};

// 3. ACTUALIZAR ESTADO DE PAGO (Cuentas por Cobrar)
export const updatePaymentStatus = async (
  saleId: string,
  status: "PAID" | "PENDING",
) => {
  try {
    const saleRef = doc(db, "sales", saleId);
    await updateDoc(saleRef, { paymentStatus: status });
    return { success: true };
  } catch (error) {
    console.error("Error actualizando pago:", error);
    throw new Error("No se pudo actualizar el estado de pago.");
  }
};
